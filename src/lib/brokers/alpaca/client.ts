import { AnnouncementResponseSchema, type GetMultiBarsParams } from "./types";

export class AlpacaClient {
  private url: string;
  private accessToken: string;

  constructor(accessToken: string, paper: boolean = true) {
    this.url = paper
      ? "https://paper-api.alpaca.markets"
      : "https://api.alpaca.markets";
    this.accessToken = accessToken;
  }

  private get headers() {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async isAccountActive() {
    const response = await fetch(`${this.url}/v2/account`, {
      headers: this.headers,
    });
    const json = await response.json();
    return json?.status === "ACTIVE";
  }

  async getAnnouncements(types: string[], start?: string, end?: string) {
    const params = new URLSearchParams();
    if (types.length > 0) {
      params.append("ca_types", types.join(","));
    }
    if (start) {
      params.append("since", start);
    }
    if (end) {
      params.append("until", end);
    }

    const response = await fetch(
      `${this.url}/v2/corporate_actions/announcements?${params.toString()}`,
      {
        headers: this.headers,
        cache: "no-store",
      }
    );
    const json = await response.json();
    const obj = AnnouncementResponseSchema.parse(json);
    return obj;
  }

  async getMultiBars({
    symbols,
    timeframe,
    start,
    end,
    limit = 10000,
    adjustment = "all",
  }: GetMultiBarsParams) {
    const urlParams = new URLSearchParams();
    urlParams.append("symbols", symbols.join(","));
    urlParams.append("timeframe", timeframe);
    if (start) {
      urlParams.append("start", start);
    }
    if (end) {
      urlParams.append("end", end);
    }
    urlParams.append("limit", limit.toString());
    urlParams.append("adjustment", adjustment);

    const response = await fetch(
      `https://data.alpaca.markets/v2/stocks/bars?${urlParams.toString()}`,
      {
        headers: this.headers,
        cache: "no-store",
      }
    );
    const json = await response.json();
    return json;
  }
}
