/**
 * Upgraded version of [financialModelingPrep] that uses smarter
 * caching logic to ensure that we get pricing data back as fast
 * as possible.
 */

import { requireEnv } from "@/helpers"
import {
  FundHoldingsSchema,
  FundsResponseSchema,
  QuoteResponseSchema,
  SymbolsResponseSchema,
} from "./types"
import { Mock } from "@/decorators/mock"

const API_KEY = requireEnv("FINNHUB_API_KEY")
const FREE_KEY = requireEnv("FINNHUB_FREE_KEY")

const BASE_URL = "https://finnhub.io/api/v1"
const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Finnhub-Token": API_KEY,
}

export class Finnhub {
  @Mock()
  async getAllUSSymbols() {
    const response = await fetch(`${BASE_URL}/stock/symbol?exchange=US`, {
      headers,
      next: { revalidate: 60 * 60 * 24 }, // 1 day in seconds
    })
    const json = await response.json()
    const obj = SymbolsResponseSchema.parse(json)
    return obj
  }

  @Mock()
  async getETFs() {
    const response = await fetch(
      `${BASE_URL}/etf/list?exchange=US&currency=USD`,
      {
        headers,
        next: { revalidate: 60 * 60 * 24 * 5 }, // seconds
      }
    )
    const json = await response.json()
    const obj = FundsResponseSchema.parse(json)
    return obj
  }

  @Mock()
  async getMutualFunds() {
    const response = await fetch(
      `${BASE_URL}/mutual-fund/list?exchange=US&currency=USD`,
      {
        headers,
        next: { revalidate: 60 * 60 * 24 * 5 }, // seconds
      }
    )
    const json = await response.json()
    const obj = FundsResponseSchema.parse(json)
    return obj
  }

  @Mock(json => [FundHoldingsSchema.parse(json.holdings), json.atDate])
  async getFundHoldings(
    type: "mutual-fund" | "etf",
    isin: string,
    date?: string
  ) {
    const response = await fetch(
      `${BASE_URL}/${type}/holdings?isin=${isin}${date ? `&date=${date}` : ""}`,
      {
        headers,
        next: { revalidate: 60 * 60 * 24 }, // seconds
      }
    )
    const json = await response.json()
    const holdings = FundHoldingsSchema.parse(json.holdings)
    const { atDate } = json // "2023-06-30"
    if (!atDate || !holdings.length) throw new Error("No date/holdings found")
    return [holdings, atDate] as [typeof holdings, string]
  }

  @Mock()
  async getQuote(symbol: string) {
    const response = await fetch(`${BASE_URL}/quote?symbol=${symbol}`, {
      headers: { ...headers, "X-Finnhub-Token": FREE_KEY },
      next: { revalidate: 30 }, // seconds
    })
    const json = await response.json()
    const obj = QuoteResponseSchema.parse(json)
    return obj
  }
}

export default new Finnhub()
