import Alpaca from "@/lib/brokers/alpaca"
import { PlaceOrder } from "@master-chief/alpaca"

import { Queues } from "../queues"
import { MetricsTime, Worker } from "bullmq"
import connection from "../connection"
import {
  createSlicesForPositions,
  previewOrders,
} from "@/services/portfolio/order"
import { prisma } from "@/initializers/prisma"
import { generateId } from "@/helpers"
import { RebalanceActionDetails, TradeActionDetails } from "@/models/actionLog"
import Big from "big.js"
import { Order } from "@master-chief/alpaca/@types/entities"

interface JobInput {
  portfolioId: string
  amount: number
  isLiquidation: boolean
  trigger: "manual" | "recurring-buy" | "reinvest-on-sell"
}

export default new Worker<JobInput, void>(
  Queues.executePortfolioOrders,
  async (job) => {
    const { isLiquidation, amount, portfolioId, trigger } = job.data
    const isRebalance = amount === 0

    // Get alpacaToken from user
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { user: true },
    })
    if (!portfolio) throw "Portfolio not found"

    const [preview, pcDetails] = await previewOrders(
      portfolio.user.alpacaToken!,
      portfolioId,
      amount,
      isLiquidation
    )

    // Create slices for non-slice positions, and add new slices to [preview]
    const nonSlicePositions = preview.filter((p) => !p.slice)
    const newSlices = await createSlicesForPositions(
      nonSlicePositions.map((p) => p.position!),
      portfolioId
    )
    nonSlicePositions.forEach(
      (p) =>
      (p.slice = newSlices.find(
        (slc) => slc.listedAsset.symbol === p.listedAsset.symbol
      ))
    )

    // Submit the orders
    const draftOrders: PlaceOrder[] = preview.map((order) => ({
      symbol: order.listedAsset.symbol,
      ...(order.orderType === "notional"
        ? {
          notional: Math.abs(order.notional),
          side: order.notional > 0 ? "buy" : "sell",
        }
        : {
          // Liquidation
          qty: Math.abs(order.qty),
          side: "sell",
        }),
      type: "market",
      time_in_force: "day",
      client_order_id: `${order.slice!.id}|${generateId("")}`,
    }))
    const results = await submitOrders(portfolio.user.alpacaToken!, draftOrders)

    // Parse response
    const orders = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "fulfilled") as {
        result: PromiseFulfilledResult<Order>
        index: number
      }[]
    const rawOrders = orders.map(({ result }) => result.value.raw())

    const errors = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "rejected") as {
        result: PromiseRejectedResult
        index: number
      }[]

    // Add to ActionLog
    const actualAmount = +orders.reduce((acc, { index, result }) => {
      const ps = preview[index]
      const value =
        ps.orderType === "notional" ? ps.notional : ps.qty * ps.sharePrice
      const side = result.value.side === "buy" ? 1 : -1

      return acc.add(side * value)
    }, Big(0))

    const detailsData: TradeActionDetails = {
      requestedAmount: amount,
      actualAmount,
      isLiquidation,
      trigger,
      trades: preview.map((order, i) => ({
        symbol: order.listedAsset.symbol,
        ...(order.orderType === "notional"
          ? {
            amount: order.notional,
          }
          : {
            amount: order.qty * order.sharePrice,
          }),
        beforePc: pcDetails[i]?.beforePc ?? 0, // [pcDetails] not set for liquidations
        afterPc: pcDetails[i]?.afterPc ?? 0,
        targetPc: order.slice!.percent,
      })),
      errors: errors.map(({ result, index }) => {
        const p = preview[index]

        return {
          symbol: p.listedAsset.symbol,
          ...(p.orderType === "notional"
            ? {
              notional: p.notional,
            }
            : {
              qty: p.qty,
            }),
          reason: JSON.stringify(result.reason),
        }
      }),
    }
    const details = JSON.stringify(
      isRebalance
        ? RebalanceActionDetails.parse(detailsData)
        : TradeActionDetails.parse(detailsData))

    await prisma.actionLog.create({
      data: {
        portfolioId,
        action: isRebalance ? "rebalance" : "trade",
        isAutomated: trigger !== "manual",
        details,
        ActionOrder: {
          create: rawOrders.map((order) => ({
            id: order.id,
            portfolioSliceId: order.client_order_id.split("|")[0],
            raw: JSON.stringify(order),
          })),
        },
      },
    })
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
)

async function submitOrders(alpacaToken: string, draftOrders: PlaceOrder[]) {
  /**
   * Submits orders to Alpaca, respecting the API rate limit.
   */
  const alpaca = new Alpaca(alpacaToken, false)
  const maxOrdersPerMinute = 200 - 25 // 25 is a buffer
  let i = 0
  const results = []

  while (i < draftOrders.length) {
    const batch = draftOrders.slice(i, i + maxOrdersPerMinute)
    results.push(
      ...(await Promise.allSettled(
        batch.map((order) => alpaca.createOrder(order))
      ))
    )
    i += maxOrdersPerMinute

    if (i < draftOrders.length) {
      // Wait for 60 seconds before sending the next batch of orders
      await new Promise((resolve) => setTimeout(resolve, 60000))
    }
  }

  return results
}
