import { playbackOrdersAndActionsAt } from "./playback";
import { Order, Position } from "./types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { Big } from "big.js";
import { CASH } from "./constants";
import { prisma } from "@/initializers/prisma";
import { tradingDaysInPeriod } from "@/helpers";
import _ from "lodash";

export default async function getPerformance(orders: Order[], toDate: Date) {
  /**
   * Prepares chart points for the portfolio's *actual* performance over time. This
   * is different from the portfolio's *backtested* performance.
   */
  const oneMonthAgo = dayjs(toDate).subtract(1, "month").toDate();
  const costSeries = [] as [number, number][];
  const valueSeries = [] as [number, number][];
  let latestDividends = 0;

  for await (const [positions, dividends, date] of playbackOrdersAndActionsAt(
    orders,
    tradingDaysInPeriod(oneMonthAgo, toDate)
  )) {
    try {
      const [value, cost] = await getPortfolioValueAtDate(positions, date);
      costSeries.push([date.getTime(), cost]);
      valueSeries.push([date.getTime(), value]);
      latestDividends = dividends;
    } catch (err) {
      console.log(err);
    }
  }

  return {
    cost: costSeries,
    value: valueSeries,
    dividends: latestDividends,
  };
}

async function getPortfolioValueAtDate(
  allPositions: Position[],
  dateObj: Date
) {
  const positions = allPositions.filter((p) => p.qty > 0);
  const positionsBySymbol = _.keyBy(positions, "symbol");

  // Fetch prices from SQLite
  const date = dayjs(dateObj).toDate();
  const symbols = positions.map((p) => p.symbol);
  if (!symbols.length) {
    throw "No positions";
  }

  const results = await prisma.historicalPrice.findMany({
    where: {
      symbol: {
        in: symbols,
      },
      date,
    },
  });

  if (!results.length) {
    // Likely means it was a holiday, since we don't have any data for this day
    throw `Missing prices: ${date.toISOString().split('T')[0]} / ${symbols.length} stocks`;
  }

  // Compute portfolio value and const basis
  let marketValue = Big(0);
  let cost = Big(0);
  for (const symbol of symbols) {
    const price = results.find((el) => el.symbol == symbol)?.close;
    if (!price && symbol !== CASH)
      console.error(`${date} / Missing price for ${symbol}`);

    const qty = positionsBySymbol[symbol].qty;
    marketValue = marketValue.add(Big(qty).mul(price ?? 0));
    cost = cost.add(positionsBySymbol[symbol].costBasis);
  }
  return [+marketValue, +cost];
}
