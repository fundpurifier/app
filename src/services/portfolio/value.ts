import Big from "big.js";
import { Position, PositionWithMarketValue } from "./types";
import fmp from "@/lib/fmp";
import finnhub from "@/lib/finnhub";
import _ from "lodash";
import { CASH } from "./constants";

export async function addMarketValues(allPositions: Position[]) {
  // Filter out symbols we don't support (crypto, etc)
  // Note: Do not filter out *qty=0* since we need the prices in the preview
  const positions = allPositions.filter((p) => fmpSupportedSymbol(p.symbol));

  // Find latest market value for each symbol
  const symbols = positions.map((p) => p.symbol);
  const prices = await getBulkQuotes(symbols);
  const pricesBySymbol = _.keyBy(prices, "symbol");

  // Compute additional keys for each portfolio position
  const positionsWithMarketValues: PositionWithMarketValue[] = [];
  positions.forEach((position) => {
    const price = pricesBySymbol[position.symbol]?.price ?? 0; // Missing prices handled below
    const qty = position.qty;
    const marketValue = Big(qty).mul(price);

    positionsWithMarketValues.push({
      ...position,
      sharePrice: +Big(price),
      marketValue: +marketValue,
      unrealizedPnl: +marketValue.minus(position.costBasis),
    });
  });

  // Any missing quotes?
  const missing = symbols.filter((s) => !pricesBySymbol[s]);
  if (missing.length > 0) {
    console.error(`⚠️ Missing quotes for ${missing.join(", ")}`);
  }

  return positionsWithMarketValues;
}

export async function getBulkQuotes(symbols: string[]) {
  /**
   * FMP offers a bulk endpoint we can use to retrieve prices for an (unlimited)
   * number of stocks. However, it's not perfect. They are sometimes late processing
   * symbol changes, so we fallback to requesting quotes from Finnhub for those.
   */
  if (symbols.length === 0) return [];

  const prices = (await fmp.getBulkPrices(symbols)).map((p) => ({
    symbol: p.symbol,
    price: p.price,
  }));

  // FMP has a bunch of missing symbols due to e.g. delays in processing symbol
  // changes. We fallback to Finnhub for those.
  const missing = symbols.filter((s) => !prices.find((p) => p.symbol == s));
  const missingQuotes = await Promise.all(missing.map(finnhub.getQuote));
  missingQuotes.forEach(({ c }, i) =>
    prices.push({ symbol: missing[i], price: c })
  );

  return prices;
}

function fmpSupportedSymbol(symbol: string) {
  /**
   * FMP doesn't support all the symbols we do, so we need to filter them out
   * before we can fetch the latest market value for each symbol.
   *
   * We currently filter out crypto and CASH ('$')
   */
  if (symbol === CASH) return false;
  if (symbol.length >= 6 && symbol.endsWith("USD")) return false; // e.g. BTCUSD, ETH/USD

  return true;
}
