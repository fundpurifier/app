import { z } from "zod";

const OverallStatus = z.enum([
  "COMPLIANT",
  "NON_COMPLIANT",
  "QUESTIONABLE",
  "UNRATED",
]);

export type OverallStatus = z.infer<typeof OverallStatus>;

export const BasicStockReportSchema = z.object({
  symbol: z.string(), // "AAPL"
  name: z.string().optional(), // "Apple Inc"
  exchange: z.string().optional(), // "XNAS"
  status: OverallStatus,
  reportDate: z.string().optional(), // "2023-12-10:08:03.420Z"
});

export type BasicStockReport = z.infer<typeof BasicStockReportSchema>;

export const AdvancedStockReportSchema = BasicStockReportSchema.extend({
  rawSymbol: z.string(), // "0R0K"
  figi: z.string().optional(), // "BBG00QDG6DB5"
  businessScreen: OverallStatus.optional(),
  financialScreen: OverallStatus.exclude([OverallStatus.Enum.QUESTIONABLE]).optional(),
  compliantRevenue: z.number().optional(), // 98.34
  nonCompliantRevenue: z.number().optional(), // 1.66
  questionableRevenue: z.number().optional(), // 0
});

export type AdvancedStockReport = z.infer<typeof AdvancedStockReportSchema>;

export const AAOIFIStockReportSchema = AdvancedStockReportSchema.extend({
  debtToMarketCapRatio: z.number().optional(), // 0.0416
  securitiesToMarketCapRatio: z.number().optional(), // 0.1145
});

export type AAOIFIStockReport = z.infer<typeof AAOIFIStockReportSchema>;
