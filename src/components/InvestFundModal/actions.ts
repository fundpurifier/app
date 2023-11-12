"use server"

import _ from "lodash"
import Big from "big.js"
import { getSignedInUser, portfolioGuard } from "@/helpers.server"
import Alpaca from "@/lib/brokers/alpaca"
import { PortfolioWithSlices } from "@/types"
import { previewOrders } from "@/services/portfolio/order"
import { getPositions } from "@/services/portfolio/playback"
import { addMarketValues } from "@/services/portfolio/value"

import { Queues } from "@/workers/queues"
import { Queue } from "bullmq"
import connection from "@/workers/connection"

export async function getCash() {
  const user = await getSignedInUser()
  if (!user.alpacaToken) throw "You don't have a valid Alpaca token."

  const alpaca = new Alpaca(user.alpacaToken, false)
  const account = await alpaca.getAccount()
  return account.cash
}

export async function isMarketOpen() {
  const user = await getSignedInUser()
  const alpaca = new Alpaca(user!.alpacaToken!, false)
  const { is_open } = await alpaca.getClock()

  return is_open
}

export async function getPortfolioValue(portfolio: PortfolioWithSlices) {
  const user = await getSignedInUser()
  if (!user.alpacaToken) throw "You don't have a valid Alpaca token."
  await portfolioGuard(user, portfolio.id)

  // Find portfolio value
  const [_positions] = await getPositions(portfolio.slices, user.alpacaToken)
  const positions = await addMarketValues(_positions)

  const value = positions.reduce((sum, p) => sum.add(p.marketValue), Big(0))
  return +value
}

export async function previewInvestment(
  portfolioId: string,
  amount: number,
  isLiquidation = false
) {
  const user = await getSignedInUser()
  if (!user.alpacaToken) throw "You don't have a valid Alpaca token."
  await portfolioGuard(user, portfolioId)

  const [orders] = await previewOrders(
    user.alpacaToken,
    portfolioId,
    amount,
    isLiquidation
  )
  return orders
}

export async function execute(
  portfolioId: string,
  amount: number,
  isLiquidation = false
) {
  const user = await getSignedInUser()
  if (!user.alpacaToken) throw "You don't have a valid Alpaca token."
  await portfolioGuard(user, portfolioId)

  // Queue a job to execute the orders
  const queue = new Queue(Queues.executePortfolioOrders, { connection })
  await queue.add(Queues.executePortfolioOrders, {
    portfolioId,
    amount,
    isLiquidation,
    trigger: "manual",
  })
}
