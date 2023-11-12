import musaffa from "@/lib/musaffa";
import { toShariahStatus } from "@/lib/musaffa/mappers";
import _ from "lodash";

export async function fetchShariahData(symbols: string[]) {
  const BATCH_SIZE = 100;
  const data = {} as Record<
    string,
    {
      status: "compliant" | "non_compliant" | "doubtful" | "not_covered";
      details: string;
    }
  >;

  for (const batch of _.chunk(symbols, BATCH_SIZE)) {
    const batchResponse = await musaffa.getStockReportBatch(batch);
    for (const response of batchResponse) {
      data[response.symbol] = {
        status: toShariahStatus(response.shariahComplianceStatus),
        details: JSON.stringify(response),
      };
    }
  }

  return data;
}
