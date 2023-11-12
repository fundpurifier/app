import { Queues } from "../queues";
import connection from "../connection";
import { MetricsTime, Worker } from "bullmq";
import { prisma } from "@/initializers/prisma";
import _ from "lodash";
import { fetchShariahData } from "@/services/shariah/fetch";
import { refreshUser } from "@/services/fund/refresh";

export default new Worker<void, void>(
  Queues.refreshShariahStatus,
  async (job) => {
    const updatedAssetIds = await bulkRefreshShariahStatus();
    if (!updatedAssetIds.length) return;

    // Get all users
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        alpacaToken: { not: null },
        Portfolio: {
          some: {
            deleted: false,
            fundIsin: { not: "MIGRATED" } // TODO: remove to keep monitoring old funds
          },
        },
      },
    });

    // Refresh all users, since we have no way of targeting only users that own
    // the specific assets that changed
    // TODO: There's gotta be a better way, figure this out
    for (const user of users) {
      await refreshUser(user.id, 'shariah-compliance-update')
    }
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

export async function bulkRefreshShariahStatus(): Promise<string[]> {
  const assets = await prisma.listedAsset.findMany({
    where: { isStock: true },
  });
  const assetsBySymbol = _.keyBy(assets, "symbol");

  const MAX_MUSAFFA_BATCH = 100;
  let curBatch = 0;
  const numBatches = Math.floor(assets.length / MAX_MUSAFFA_BATCH);

  const updatedAssetIds: string[] = [];

  for (const batch of _.chunk(assets, MAX_MUSAFFA_BATCH)) {
    console.log(`⚡️ ${++curBatch}/${numBatches} (${updatedAssetIds.length})`);

    const symbols = batch.map((la) => la.symbol);
    const results = _.map(await fetchShariahData(symbols), (value, symbol) => ({
      symbol,
      ...value,
    }));

    // Find the companies whose reports have changed
    const changed = results.filter((latest) => {
      const asset = assetsBySymbol[latest.symbol];
      return hasChanged(latest.details, asset.shariahDetailsCurrent ?? "{}");
    });

    if (!changed.length) continue;

    // Musaffa has some weird cases where all of the reports return 'unknown'
    // In this case, we don't want to update the database
    if (changed.every((result) => result.status === "not_covered")) {
      console.error(`❌ All ${changed.length} reports unknown, skipping`);
      break; // bail
    }

    // Bulk update changed reports
    await prisma.$transaction(
      changed.map((change) =>
        prisma.listedAsset.update({
          where: { id: assetsBySymbol[change.symbol].id },
          data: {
            shariahStatus: change.status,
            shariahDetailsCurrent: change.details,
            shariahDetailsPrevious:
              assetsBySymbol[change.symbol].shariahDetailsCurrent,
          },
        })
      )
    );

    updatedAssetIds.push(...changed.map(change => assetsBySymbol[change.symbol].id));
  }

  return updatedAssetIds;
}

function hasChanged(a: string, b: string) {
  /**
   * Compares two Shariah details objects, taking into consideration only
   * the specific fields we care about. (Note: we store current and & previous
   * reports in order to support the 'wait' feature when liquidating)
   */

  // Parse the JSON strings
  const parsedA = JSON.parse(a);
  const parsedB = JSON.parse(b);

  // Compare the keys of interest
  const keysOfInterest = ["shariahComplianceStatus", "reportDate"];

  for (const key of keysOfInterest) {
    if (parsedA[key] !== parsedB[key]) return true;
  }

  // If none of the keys of interest are different, the objects are considered the same
  return false;
}
