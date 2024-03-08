"use server"
import "server-only"

import { getSignedInUser, isAdmin, portfolioGuard } from "@/helpers.server"
import { FormType } from "./EditSettingsModal"
import { prisma } from "@/initializers/prisma"
import { getPortfolioValue } from "@/components/InvestFundModal/actions"

import { getRepeatableJob } from "@/workers/src/helpers/jobs"
import { DEFAULT_TIMEZONE } from "@/workers/scheduler"
import { Queue } from "bullmq"
import { Queues } from "@/workers/queues"
import connection from "@/workers/connection"
import {
  FundChangeActionDetails,
  RecurringBuyCreatedActionDetails,
} from "@/models/actionLog"
import { ActionOrder } from "@prisma/client"
import { OPEN_ORDER_STATES } from "@/lib/brokers/alpaca/types"
import { refreshSinglePortfolio } from "@/services/fund/refresh"
import { ADMIN_EMAIL } from "@/services/portfolio/constants"

export interface RecurringBuy {
  amount: number
  frequency: "daily" | "weekly" | "monthly"
  startDate: Date
}

export async function getPortfolio(portfolioId: string) {
  const user = await getSignedInUser()
  await portfolioGuard(user, portfolioId)

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      slices: true,
      fund: true,
      RecurringBuy: {
        where: { isDeleted: false },
      },
    },
  })

  if (!portfolio) throw new Error("Portfolio not found")
  return portfolio
}

export async function getActionLog(portfolioId: string) {
  const user = await getSignedInUser()
  await portfolioGuard(user, portfolioId)

  const retrieveActionLogs = () =>
    prisma.actionLog.findMany({
      where: { portfolioId },
      orderBy: { createdAt: "desc" },
      include: { ActionOrder: true },
    })

  const actionLog = await retrieveActionLogs()

  // Resolve any open orders against the closedOrders table
  const status = (o: ActionOrder) => JSON.parse(o.raw).status
  const openOrderIds = actionLog
    .flatMap((log) => log.ActionOrder)
    .filter((o) => OPEN_ORDER_STATES.includes(status(o)))
    .map((o) => o.id)

  if (openOrderIds.length === 0) return actionLog

  // Update the ActionOrders table with the latest status
  const closedOrders = await prisma.closedOrder.findMany({
    where: { id: { in: openOrderIds } },
  })
  await prisma.$transaction(
    closedOrders.map((closedOrder) =>
      prisma.actionOrder.update({
        where: { id: closedOrder.id },
        data: { raw: JSON.stringify(closedOrder) },
      })
    )
  )

  // Return the updated action log
  return retrieveActionLogs()
}

export async function updateFund(
  portfolioId: string,
  settings: Partial<FormType>
) {
  // Make sure the user has access to this portfolio
  const user = await getSignedInUser()
  const previous = await portfolioGuard(user, portfolioId)

  // Update settings
  const portfolio = await prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      ...settings,
    },
    include: {
      slices: true,
      fund: true,
      user: {
        include: {
          whitelist: true,
          blacklist: true,
        },
      },
    },
  })

  // Save to the actionLog
  const details: FundChangeActionDetails = FundChangeActionDetails.parse({
    before: previous,
    after: settings,
  })
  await prisma.actionLog.create({
    data: {
      portfolioId,
      action: "settings_adjusted",
      details: JSON.stringify(details),
      isAutomated: false,
    },
  })

  // Refresh the portfolio if necessary
  const shouldTriggerRefresh =
    settings.allowUnrated !== previous.allowUnrated ||
    settings.onNonCompliance !== previous.onNonCompliance ||
    settings.allowDoubtful !== previous.allowDoubtful

  if (shouldTriggerRefresh) {
    console.log(`Triggering refresh for portfolio ${portfolioId}`)
    await refreshSinglePortfolio(portfolio, "fund-settings-change")
  }

  return shouldTriggerRefresh
}

export async function deleteFund(portfolioId: string) {
  // Make sure the user has access to this portfolio
  const user = await getSignedInUser()
  await portfolioGuard(user, portfolioId)

  // Make sure the portfolio is empty
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { slices: true },
  })
  const value = await getPortfolioValue(portfolio!)
  if (value > 0 && !isAdmin()) return false

  // Delete the portfolio
  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: { deleted: true },
  })
  return true
}

export async function getRecurringInvestment(
  portfolioId: string
): Promise<RecurringBuy | undefined> {
  const user = await getSignedInUser()
  if (!user.alpacaToken) throw "You don't have a valid Alpaca token."
  await portfolioGuard(user, portfolioId)

  const recurringBuy = await prisma.recurringBuy.findFirst({
    where: { portfolioId, isDeleted: false },
  })

  if (!recurringBuy) return

  const { amount, frequency, startDate } = recurringBuy
  return {
    amount,
    frequency: frequency as "daily" | "weekly" | "monthly",
    startDate,
  }
}

interface CreateRecurringInvestmentParams {
  portfolioId: string
  amount: number
  frequency: "daily" | "weekly" | "monthly"
  startDate: Date
}

export async function createRecurringInvestment({
  portfolioId,
  amount,
  frequency,
  startDate,
}: CreateRecurringInvestmentParams) {
  const user = await getSignedInUser()
  if (!user.alpacaToken) throw "You don't have a valid Alpaca token."
  await portfolioGuard(user, portfolioId)

  // Does this user already have a recurring investment for this portfolio?
  const jobName = `recurring:${user.id}:${portfolioId}`
  const queue = new Queue(Queues.recurringInvestment, { connection })
  const job = await getRepeatableJob(queue, jobName)
  if (job) throw "You already have a recurring investment for this portfolio."

  // Generate cron expression based on the start date, frequency
  const pattern = (() => {
    const day = startDate.getDate()
    const dayOfWeek = startDate.getDay()

    switch (frequency) {
      case "daily":
        return `30 9 * * 1-5`
      case "weekly":
        return `30 9 * * ${dayOfWeek}`
      case "monthly":
        return `30 9 ${day > 30 ? 30 : day} * *`
    }
  })() as string

  // Create the job
  await queue.add(
    jobName,
    { portfolioId, amount },
    {
      repeat: {
        pattern,
        startDate,
        tz: DEFAULT_TIMEZONE,
      },
    }
  )

  // Update the database
  await prisma.recurringBuy.create({
    data: {
      portfolioId,
      amount,
      frequency,
      startDate,
    },
  })

  // Add to the action log
  const details: RecurringBuyCreatedActionDetails = {
    startDate,
    amount,
    frequency,
  }
  await prisma.actionLog.create({
    data: {
      portfolioId,
      action: "recurring_buy_created",
      details: JSON.stringify(details),
      isAutomated: false,
    },
  })
}

export async function cancelRecurringInvestment(portfolioId: string) {
  const user = await getSignedInUser()
  if (!user.alpacaToken) throw "You don't have a valid Alpaca token."
  await portfolioGuard(user, portfolioId)

  // Remove the repeatable job
  const jobName = `recurring:${user.id}:${portfolioId}`
  const queue = new Queue(Queues.recurringInvestment, { connection })
  const job = await getRepeatableJob(queue, jobName)
  await queue.removeRepeatableByKey(job!.key)

  // Remove the delayed job(s)
  const delayedJobs = await queue.getDelayed()
  await Promise.all(
    delayedJobs.filter((j) => j.name === jobName).map((j) => j.remove())
  )

  await prisma.recurringBuy.updateMany({
    where: { portfolioId, isDeleted: false },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  })

  // Add to the action log
  await prisma.actionLog.create({
    data: {
      portfolioId,
      action: "recurring_buy_cancelled",
      isAutomated: false,
      details: "{}",
    },
  })
}
