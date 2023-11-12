import { requireEnv } from "@/helpers";
import { BulkLastDayResponseSchema } from "./types";
import { Mock } from "@/decorators/mock";

const API_KEY = requireEnv("EOD_HISTORICAL_DATA_API_KEY");
const BASE_URL = "https://eodhistoricaldata.com/api";

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export class EOD {
  @Mock()
  async getBulkLastDay(exchange: string, date: Date = new Date()) {
    const dateStr = date.toISOString().split("T")[0];
    const response = await fetch(
      `${BASE_URL}/eod-bulk-last-day/${exchange}?api_token=${API_KEY}&fmt=json&date=${dateStr}`,
      {
        headers,
        cache: "no-store", // prevents caching since this is MASSIVE
      }
    );
    const json = await response.json();
    const data = BulkLastDayResponseSchema.parse(json);
    return data;
  }
}

export default new EOD();