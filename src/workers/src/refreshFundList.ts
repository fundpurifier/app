import { Queues } from "../queues";
import { MetricsTime, Worker } from "bullmq";
import connection from "../connection";
import finnhub from "@/lib/finnhub";
import { prisma } from "@/initializers/prisma";
import _ from "lodash";

export default new Worker<void, void>(
  Queues.refreshFundList,
  async (job) => {
    await refreshFundList();
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

export async function refreshFundList() {
  const etfs = await finnhub.getETFs();
  const mutualFunds = await finnhub.getMutualFunds();

  const allFunds = [
    ...etfs.map((f) => ({ ...f, type: "etf" })),
    ...mutualFunds.map((f) => ({ ...f, type: "mutual_fund" })),
  ];

  const relevantFunds = allFunds
    .filter((fund) => fund.isin.startsWith("US")) // only US-listed funds
    .filter((fund) => fund.symbol.length <= 6); // skip the weird long ones no one cares about

  // Update the databasea
  let batchProcessed = 0;
  for (const batch of _.chunk(relevantFunds, 10000)) {
    console.log(`Processing batch #${batchProcessed++}`);
    await prisma.$transaction(
      batch.map((f) =>
        prisma.fund.upsert({
          where: { isin: f.isin },
          update: { ...f },
          create: { ...f },
        })
      )
    );
  }
  console.log(`Upserted ${relevantFunds.length} funds`);

  // Remove funds that are no longer listed
  const fundsToDelete = await prisma.fund.deleteMany({
    where: {
      NOT: {
        isin: {
          in: ["MIGRATED", ...relevantFunds.map((f) => f.isin)],
        },
      },
    },
  });
  console.log(`Deleted ${fundsToDelete.count} funds`);
}
