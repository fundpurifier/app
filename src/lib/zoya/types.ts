import { z } from "zod";
import { toMusaffaStatus } from "./mappers"

const OverallStatus = z.enum([
  "COMPLIANT",
  "NON_COMPLIANT",
  "QUESTIONABLE",
  "UNRATED",
]);

export type OverallStatus = z.infer<typeof OverallStatus>;

export const StockReportSchema = z.object({
  // <BasicStockReport>
  symbol: z.string(), // "AAPL"
  name: z.string().optional(), // "Apple Inc"
  exchange: z.string().optional(), // "XNAS"
  status: OverallStatus,
  reportDate: z.string().optional(), // "2023-12-10:08:03.420Z"
  // </BasicStockReport>

  // <AdvancedStockReport>
  rawSymbol: z.string(), // "0R0K"
  figi: z.string().optional(), // "BBG00QDG6DB5"
  businessScreen: OverallStatus.optional(),
  financialScreen: OverallStatus.exclude([OverallStatus.Enum.QUESTIONABLE]).optional(),
  compliantRevenue: z.number().optional(), // 98.34
  nonCompliantRevenue: z.number().optional(), // 1.66
  questionableRevenue: z.number().optional(), // 0
  // </AdvancedStockReport>

  // <AAOIFIStockReport>
  debtToMarketCapRatio: z.number().optional(), // 0.0416
  securitiesToMarketCapRatio: z.number().optional(), // 0.1145
  // </AAOIFIStockReport>
}).transform<import("../musaffa/types").StockReport>((report) => {
  console.log("report.debtToMarketCapRatio", report.debtToMarketCapRatio);
  console.log("report.securitiesToMarketCapRatio", report.securitiesToMarketCapRatio);
  return ({
    symbol: report.symbol,
    shariahComplianceStatus: toMusaffaStatus(report.status),
    companyName: report.name,
    lastUpdate: report.reportDate,
    revenueBreakdown: {
      halalRatio: report.compliantRevenue,
      notHalalRatio: report.nonCompliantRevenue,
      doubtfulRatio: report.questionableRevenue,
    },
    interestBearingSecuritiesAndAssets: {
      ratio: report.securitiesToMarketCapRatio ? report.securitiesToMarketCapRatio * 100 : undefined,
    },
    interestBearingDebt: {
      ratio: report.debtToMarketCapRatio ? report.debtToMarketCapRatio * 100 : undefined,
    },
    reportDate: report.reportDate,
  })
});

export type StockReport = z.infer<typeof StockReportSchema>;
