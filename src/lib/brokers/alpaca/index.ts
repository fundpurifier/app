import {
  AlpacaClient,
  GetAccountActivities,
  GetOrders,
  PlaceOrder,
  type Order,
} from "@master-chief/alpaca"
import { AlpacaClient as FallbackAlpacaClient } from "./client"
import { AssetResponseSchema, GetMultiBarsParams } from "./types"
import { prisma } from "@/initializers/prisma"
import { alpacaOrderToDb } from "./mappers"
import { Mock } from "@/decorators/mock"

export default class Alpaca {
  private client
  private fallback
  private accessToken
  private paper

  constructor(accessToken: string, paper = true) {
    this.accessToken = accessToken
    this.paper = paper
    this.client = new AlpacaClient({
      credentials: {
        access_token: accessToken,
        paper,
      },
      rate_limit: true,
    })
    this.fallback = new FallbackAlpacaClient(accessToken, paper)
  }

  async getAccount() {
    return this.client.getAccount()
  }

  async getClock() {
    return this.client.getClock()
  }

  async getOrder(orderId: string) {
    return this.client.getOrder({ order_id: orderId })
  }

  async isAccountActive() {
    return this.fallback.isAccountActive()
  }

  async getPortfolioHistory(
    period: string = "1M",
    timeframe: "1Min" | "5Min" | "15Min" | "1H" | "1D"
  ) {
    return this.client.getPortfolioHistory({ period, timeframe })
  }

  async getAnnouncements(start?: string, end?: string) {
    return this.fallback.getAnnouncements(
      ["dividend", "merger", "spinoff", "split"], // all types
      start,
      end
    )
  }

  async getClosedOrders() {
    return this.getAllClosedOrdersAndSaveToDB()
  }

  async getPositions() {
    return this.client.getPositions()
  }

  async getMultiBars(params: GetMultiBarsParams) {
    return this.fallback.getMultiBars(params)
  }

  async getAccountActivites(params: GetAccountActivities) {
    return this.client.getAccountActivities(params)
  }

  @Mock()
  async getAssets() {
    const assets = await this.client.getAssets({ asset_class: "us_equity" })
    return AssetResponseSchema.parse(assets)
  }

  async createOrder(params: PlaceOrder) {
    if (process.env.NODE_ENV === "development" && !this.paper) {
      console.log("🚨 Not placing order in development mode", params)
      throw new Error("Not placing order in development mode")
    }
    return this.client.placeOrder(params)
  }

  /**
   * Fetch all closed orders from Alpaca and save them to DB and save them to the database
   * (as we rely heavily on order playback for computing fund performance)
   */
  private async getAllClosedOrdersAndSaveToDB() {
    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        alpacaToken: this.accessToken,
      },
    })
    if (!user)
      throw new Error(
        `Unable to save closed orders in DB for user. User with this 'alpacaToken' not found`
      )

    // Find the last order we saved
    const lastOrderSaved = await prisma.closedOrder.findFirst({
      where: {
        userId: user.id,
      },
      orderBy: {
        orderSubmittedAt: "desc",
      },
    })
    const after = lastOrderSaved?.orderSubmittedAt || new Date(0)

    // Fetch all orders since the last one we saved
    const LIMIT = 500
    let params: GetOrders = {
      status: "closed",
      direction: "asc",
      limit: LIMIT,
      after,
    }
    let keepGoing = true

    while (keepGoing) {
      let orders = await this.client.getOrders(params) // TODO: Make sure this is using `fetch()` with invalidation set to at least 1 min to avoid repeated (expensive) remote calls

      // Filter out any orders with symbols that end with "/USD" since these are (unsupported) crypto orders
      orders = orders.filter(
        (o) =>
          !o.symbol.endsWith("/USD") && // BTC/USD, ETH/USD
          !(o.symbol.length === 6 && o.symbol.endsWith("USD")) // BTCUSD, ETHUSD
      )

      if (!orders.length) break

      // Alpaca returns the last order in our DB even though we've specified `after` -- so we need to filter it out
      if (orders[0].created_at < after) {
        orders.shift()
        if (!orders.length) break
      }

      // Save to DB
      await Promise.allSettled(
        orders.map((o) =>
          // Don't upsert! 🙅 That'll override the sliceIds we've previously set during the migration from the old app version (see [scripts/migrateUserPositionsBeforeCutoff])
          prisma.closedOrder.create({
            data: {
              ...alpacaOrderToDb(o.raw()),
              userId: user.id,
            },
          })
        )
      )

      params.after = orders[orders.length - 1].submitted_at
      keepGoing = orders.length === LIMIT
    }

    // Return all closed orders
    return prisma.closedOrder.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        orderSubmittedAt: "asc",
      },
    })
  }
}
