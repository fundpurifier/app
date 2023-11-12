/**
 * Upgraded version of [financialModelingPrep] that uses smarter
 * caching logic to ensure that we get pricing data back as fast
 * as possible.
 */

import { Mock } from "@/decorators/mock";
import { requireEnv } from "../../helpers";
import { QuoteResponseSchema, SymbolChangeResponseSchema } from "./types";

const BASE_URL = "https://financialmodelingprep.com/api";
const API_KEY = requireEnv("FINANCIAL_MODELING_PREP_KEY");
const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export class FMP {
  @Mock()
  async getSymbolChanges() {
    const response = await fetch(
      `${BASE_URL}/v4/symbol_change?apikey=${API_KEY}`,
      {
        headers,
        cache: "no-store", // prevents caching
      }
    );
    const json = await response.json();
    const obj = SymbolChangeResponseSchema.parse(json);
    return obj;
  }

  @Mock((json, symbols: string[]) => symbols.map(symbol => ({ ...json[Math.floor(Math.random() * json.length)], symbol })))
  async getBulkPrices(symbols: string[]) {
    symbols = symbols.map(translateSymbol);
    const response = await fetch(
      `${BASE_URL}/v3/quote/${symbols.join(",")}?apikey=${API_KEY}`,
      {
        headers,
        next: { revalidate: 30 }, // seconds
      }
    );
    const json = await response.json();
    const obj = QuoteResponseSchema.parse(json);
    obj.forEach((quote) => {
      quote.symbol = revertSymbol(quote.symbol);
    });
    return obj;
  }
}

function translateSymbol(symbol: string) {
  return symbol.replace(".", "-");
}

function revertSymbol(symbol: string) {
  return symbol.replace("-", ".");
}

export default new FMP();
