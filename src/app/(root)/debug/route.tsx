import { prisma } from "@/initializers/prisma";
import { triggerWorker } from "@/workers/src/helpers/jobs";
export const dynamic = "force-dynamic"; // avoid pre-rendering errors
import { updateSliceId } from "@/seed/migrateUserPositionsBeforeCutoff";
import finnhub from "@/lib/finnhub";
import musaffa from "@/lib/musaffa";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;

  // Do we have a 'worker' param?
  if (searchParams.has("worker")) {
    const worker = searchParams.get("worker")!;
    let data = {};
    if (searchParams.has("data")) {
      data = JSON.parse(searchParams.get("data")!);
    }
    const job = await triggerWorker(worker, 'manual', data);
    return new Response(JSON.stringify(job));
  }

  // Run the 'debug'
  const result = await musaffa.getStockReportBatch(['MSFT']);
  console.log(result);
  return new Response("DONE");
}