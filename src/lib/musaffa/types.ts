import { z } from "zod";
import { isSimpleDate } from "@/helpers";

const OverallStatus = z.enum([
  "HALAL",
  "NOT HALAL",
  "DOUBTFUL",
  "NOT COVERED",
  "NOT_UNDER_COVERAGE",
]);

export type OverallStatus = z.infer<typeof OverallStatus>;

export const StockReportSchema = z.object({
  symbol: z.string(), // 'AAPL',
  shariahComplianceStatus: OverallStatus,
  companyName: z.string().optional(), // 'Apple Inc',
  lastUpdate: z.string().optional(), // "2022-08-24T07:24:03.919643"
  complianceRanking: z.number().gte(0).lte(5).optional(), // 1,
  revenueBreakdown: z.any().optional(),
  interestBearingSecuritiesAndAssets: z.any().optional(),
  interestBearingDebt: z.any().optional(),
  reportDate: z.string().refine(isSimpleDate).optional(),
  reportSource: z.string().optional(),
});

export type StockReport = z.infer<typeof StockReportSchema>;
