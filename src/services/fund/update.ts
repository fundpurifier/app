import { generateId } from "@/helpers";
import { PortfolioSlice } from "@prisma/client";
import Big from "big.js";
import _ from "lodash";

export const mergeUpdatedHoldings = (
  portfolioId: string,
  existing: PortfolioSlice[],
  updates: [string, number][], // [listedAssetId, percent]
  nonCompliantAssetIds: string[],
) => {
  /**
   * This function takes in a list of existing holdings and a list of updates
   * and returns a list of updated holdings. It updates the weights of existing
   * holdings, adds new holdings and removes dropped holdings.
   */

  // Find the scale factor
  const newTotal = updates.reduce((acc, cur) => acc.add(cur[1]), Big(0));
  const scaleFactor = Big(100).div(newTotal);

  // Keep track of the breakdown of changes
  const newlyRemoved: PortfolioSlice[] = [];
  const newlyModified: PortfolioSlice[] = [];
  let newlyAdded: PortfolioSlice[] = [];

  // Prepare lookup objects
  const existingByListedAssetId = _.keyBy(existing, 'listedAssetId');
  const updatesByListedAssetId = _.keyBy(updates, (h) => h[0]);

  const updatedSlices = existing.map((slice) => {
    const updated = updatesByListedAssetId[slice.listedAssetId];

    if (updated) {
      // It was changed
      const updatedSlice: PortfolioSlice = {
        ...slice,
        percent: +scaleFactor.mul(updated[1]),

        // Remove these, just in case the slice was previously deleted
        isDeleted: false,
        deletedAt: null,
      };

      if (slice.isDeleted) {
        // Was deleted, now restored
        newlyAdded.push(updatedSlice);
      } else if (!isAlmostEqual(slice.percent, updatedSlice.percent)) {
        newlyModified.push(updatedSlice);
      }

      return updatedSlice;
    } else {
      // It was removed
      const deletedReason = nonCompliantAssetIds.includes(slice.listedAssetId) ? 'non-compliant' : 'removed-from-fund'
      const updatedSlice: PortfolioSlice = {
        ...slice,
        percent: 0,
        isDeleted: true,
        deletedAt: new Date(),
        deletedReason,
      };

      if (slice.percent !== 0 && !slice.isDeleted)
        newlyRemoved.push(updatedSlice);

      return updatedSlice;
    }
  });

  // Handle new holdings
  newlyAdded = updates
    .filter(([listedAssetId, pc]) => !existingByListedAssetId[listedAssetId] && pc > 0)
    .map(
      ([listedAssetId, pc]) =>
      ({
        id: generateId("slc"),
        portfolioId,
        listedAssetId,
        percent: +scaleFactor.mul(pc),
      } as PortfolioSlice)
    );

  return {
    updatedSlices: [...updatedSlices, ...newlyAdded],
    newlyRemoved,
    newlyAdded,
    newlyModified,
  };
};

function isAlmostEqual(num1: number, num2: number) {
  const THRESHOLD = 0.1;
  return Math.abs(num1 - num2) < THRESHOLD;
}
