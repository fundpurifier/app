import { ListedAsset } from "@prisma/client";
import { z } from "zod";

export const FundsResponseSchema = z.array(
  z.object({
    isin: z.string(),
    name: z.string(),
    symbol: z.string(),
  })
);

export const FundHoldingsSchema = z.array(
  z.object({
    assetType: z.string().nullable(),
    cusip: z.string().nullable(),
    isin: z.string().nullable(),
    name: z.string(),
    percent: z.number(),
    share: z.number().nullable(),
    symbol: z.string().nullable().transform((val) => val?.trim() ?? null), // non-listed assets don't have a symbol
    value: z.number(),
  })

);

export type FundHoldings = z.infer<typeof FundHoldingsSchema>;

export type HoldingWithListedAsset = FundHoldings[0] & {
  listedAsset: ListedAsset;
};

export const SymbolsResponseSchema = z.array(
  z.object({
    currency: z.string(),
    description: z.string(),
    displaySymbol: z.string(),
    figi: z.string(),
    isin: z.string(),
    mic: z.string(),
    shareClassFIGI: z.string(),
    symbol: z.string(),
    symbol2: z.string(),
    type: z.string(),
  })
);

// [2023/07/25] Not sure how useful the 'type' field is, but here's the breakdown
// showing the type and count of each type of asset in the Finnhub response:
//
//   [ 'ETP', 3639 ],
//   [ 'Common Stock', 15630 ],
//   [ 'ADR', 1883 ],
//   [ 'Closed-End Fund', 505 ],
//   [ 'Ltd Part', 18 ],
//   [ 'PUBLIC', 716 ],
//   [ 'Equity WRT', 852 ],
//   [ 'REIT', 369 ],
//   [ 'Unit', 409 ],
//   [ '', 328 ],
//   [ 'Royalty Trst', 22 ],
//   [ 'Right', 76 ],
//   [ 'Open-End Fund', 17 ],
//   [ 'CDI', 19 ],
//   [ 'NVDR', 26 ],
//   [ 'GDR', 23 ],
//   [ 'Foreign Sh.', 31 ],
//   [ 'Preference', 16 ],
//   [ 'MLP', 42 ],
//   [ 'NY Reg Shrs', 10 ],
//   [ 'Receipt', 4 ],
//   [ 'Stapled Security', 8 ],
//   [ 'Tracking Stk', 6 ],
//   [ 'Misc.', 3 ],
//   [ 'SDR', 1 ],
//   [ 'PRIVATE', 1 ],
//   [ 'Savings Share', 1 ],
//   [ 'Dutch Cert', 1 ]

export const QuoteResponseSchema = z.object({
  c: z.number().nonnegative(),
  d: z.number(),
  dp: z.number(),
  h: z.number().nonnegative(),
  l: z.number().nonnegative(),
  o: z.number().nonnegative(),
  pc: z.number().nonnegative(),
  t: z.number().int().nonnegative(),
});
