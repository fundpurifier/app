import { z } from "zod";
import { isSimpleDate } from "@/helpers";

export const SymbolChangeResponseSchema = z.array(
  z.object({
    date: z.string().refine(isSimpleDate), // "2022-10-20"
    name: z.string(), // "Elme Communities Common Stock"
    oldSymbol: z.string(), // "WRE"
    newSymbol: z.string(), // "ELME"
  })
);

export const QuoteResponseSchema = z.array(
  z.object({
    symbol: z.string(),
    name: z.string(),
    price: z.number(),
    changesPercentage: z.number(),
    change: z.number(),
    dayLow: z.number(),
    dayHigh: z.number(),
    yearHigh: z.number().nullable(),
    yearLow: z.number().nullable(),
    marketCap: z.number(),
    priceAvg50: z.number().nullable(),
    priceAvg200: z.number().nullable(),
    exchange: z.string(),
    volume: z.number().nullable(),
    avgVolume: z.number().nullable(),
    open: z.number().nullable(), // sometimes null, not sure why
    previousClose: z.number().nullable(),
    eps: z.number().nullable(),
    pe: z.number().nullable(),
    earningsAnnouncement: z.string().nullable(),
    sharesOutstanding: z.number(),
    timestamp: z.number(),
  })
);
