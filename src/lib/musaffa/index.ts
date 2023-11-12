import crypto from "crypto"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
dayjs.extend(customParseFormat)

import { requireEnv } from "@/helpers"
import { StockReportSchema } from "./types"
import { Mock } from "@/decorators/mock"

const BASE_URL = "https://platform.musaffa.com/b2b/api"
const CLIENT_ID = requireEnv("MUSAFFA_CLIENT_ID")
const SECRET_KEY = requireEnv("MUSAFFA_SECRET_KEY")

export class Musaffa {
  getHeaders(body: any) {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      clientId: CLIENT_ID,
      ...this.getToken(body, SECRET_KEY),
    }
  }

  @Mock((json, stocks: string[]) => stocks.map(stock => ({ ...json[Math.floor(Math.random() * json.length)], symbol: stock })))
  async getStockReportBatch(stocks: string[]) {
    const body = JSON.stringify({ stocks })
    try {
      const response = await fetch(
        `${BASE_URL}/v2/musaffa/stocks/screening-list`,
        {
          method: "POST",
          body,
          headers: this.getHeaders(body),
          cache: "no-store", // prevents caching
        }
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch with status ${response.status}`)
      }

      const json: any[] = await response.json()
      const obj = json.map((el) => StockReportSchema.parse(el))
      return obj
    } catch (error) {
      console.error("Fetch failed:", error)
      throw error
    }
  }

  getToken(data: string, secretKey: string) {
    const time = dayjs().format("YYYYMMDDHHmmss")
    const body = secretKey + time + data
    const hash = crypto.createHash("sha512")
    const token = hash.update(body, "utf-8").digest("base64")

    return { token, time }
  }
}

export default new Musaffa()
