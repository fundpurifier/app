import { requireEnv } from "@/helpers"
import { StockReportSchema } from "./types"
import { Mock } from "@/decorators/mock"

const BASE_URL = "https://api.zoya.finance/graphql"
const API_KEY = requireEnv("ZOYA_API_KEY")

export class Zoya {
  private getHeaders() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: API_KEY,
    }
  }

  @Mock((json, stocks: string[]) => stocks.map(stock => ({ ...json[Math.floor(Math.random() * json.length)], symbol: stock })))
  async getStockReportBatch(stocks: string[]) {
    const dedupedStocks = Array.from(new Set(stocks))
    return Promise.all(dedupedStocks.map(async stock => {
      const query = `
query {
  advancedCompliance {
    report(input: {
      symbol: "${stock}",
      methodology: AAOIFI
    }) {
      symbol
      rawSymbol
      name
      figi
      exchange
      status
      reportDate
      businessScreen
      financialScreen
      compliantRevenue
      nonCompliantRevenue
      questionableRevenue
      ... on AAOIFIReport {
        securitiesToMarketCapRatio
        debtToMarketCapRatio
      }
    }
  }
}
`
      try {
        const response = await fetch(
          BASE_URL,
          {
            method: "POST",
            body: JSON.stringify({ query }),
            headers: this.getHeaders(),
            cache: "no-store", // prevents caching
          }
        )
        if (!response.ok) {
          throw new Error(`Failed to fetch with status ${response.status}`)
        }

        const json: any = await response.json()
        const obj = StockReportSchema.parse(json.data.advancedCompliance.report)
        return obj
      } catch (error) {
        console.error("Fetch failed:", error)
        throw error
      }
    }))
  }
}

export default new Zoya()
