import { z } from "zod";

const CorporateActionType = z.enum([
  "dividend",
  "split",
  "spinoff",
  "merger",
  "symbol_change",
]);
export type CorporateActionType = z.infer<typeof CorporateActionType>;

const BaseCorporateAction = z.object({
  id: z.string(),
  type: CorporateActionType,
  date: z.date(),
  symbol: z.string(),
  isin: z.string().nullable(),
});

const toNumber = z.preprocess((str) => Number(str), z.number());

// Dividends
export const DividendAction = BaseCorporateAction.extend({
  type: z.literal("dividend"),
  details: z.object({
    subtype: z.enum(["cash", "stock"]),
    cash: toNumber,
    shares: toNumber,
  }),
});

export type DividendAction = z.infer<typeof DividendAction>;

// Splits
export const SplitAction = BaseCorporateAction.extend({
  type: z.literal("split"),
  details: z.object({
    subtype: z.enum([
      "reverse_split",
      "unit_split",
      "stock_split",
      "recapitalization",
    ]),
    newRate: toNumber,
    oldRate: toNumber,
  }),
});

export type SplitAction = z.infer<typeof SplitAction>;

// Mergers
export const MergerAction = BaseCorporateAction.extend({
  type: z.literal("merger"),
  details: z.object({
    subtype: z.enum(["merger_update", "merger_completion"]),
    newSymbol: z.string(),
    cash: toNumber,
    shares: toNumber,
  }),
});

export type MergerAction = z.infer<typeof MergerAction>;

// Spinoffs
export const SpinoffAction = BaseCorporateAction.extend({
  type: z.literal("spinoff"),
  details: z.object({
    newSymbol: z.string(),
    cash: toNumber,
    shares: toNumber,
  }),
});

export type SpinoffAction = z.infer<typeof SpinoffAction>;

// Symbol change
export const SymbolChange = BaseCorporateAction.extend({
  type: z.literal("symbol_change"),
  details: z.object({
    newSymbol: z.string(),
  }),
});

export type SymbolChange = z.infer<typeof SymbolChange>;

// Union
export const CorporateAction = z.union([
  DividendAction,
  SplitAction,
  MergerAction,
  SpinoffAction,
  SymbolChange,
]);
export type CorporateAction = z.infer<typeof CorporateAction>;
