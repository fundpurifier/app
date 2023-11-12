import { prisma } from "@/initializers/prisma";
import { FundHoldings, HoldingWithListedAsset } from "@/lib/finnhub/types";
import { ListedAsset } from "@prisma/client";

export type FilterSettings = {
  // User settings
  whitelist: ListedAsset[];
  blacklist: ListedAsset[];

  // Fund settings
  allowDoubtful: boolean;
  allowUnrated: boolean;
};

export async function mapHoldingsToListedAssets(allHoldings: FundHoldings) {
  /**
   * Maps a list of fund holdings to listedAssets, excluding non-tradable holdings.
   */
  const holdings = allHoldings.filter(
    (holding) => holding.assetType === "Equity" && holding.isin !== null && holding.symbol !== null
  );
  if (!holdings.length) {
    console.warn(`No holdings found`);
    return [];
  }

  // 2. Map to ListedAsset
  const isins = holdings.map((holding) => holding.isin!);
  const symbols = holdings.map((holding) => holding.symbol!);
  const listedAssets = await prisma.listedAsset.findMany({
    where: {
      OR: [
        {
          isin: {
            in: isins,
          },
        },
        {
          symbol: {
            in: symbols,
          },
        },
      ],
    },
  });

  const holdingsWithListedAssets: HoldingWithListedAsset[] = holdings
    .map((holding) => {
      let listedAsset = listedAssets.find((la) => la.isin == holding.isin);

      if (!listedAsset) {
        listedAsset = listedAssets.find((la) => la.symbol == holding.symbol);
        if (listedAsset) {
          console.warn(
            `Found listedAsset for ${holding.symbol} by symbol ${holding.symbol}, since ISIN didn't match`
          );
        }
      }

      if (!listedAsset) {
        console.error(
          `Unable to find listedAsset for ${holding.symbol} by ISIN# ${holding.isin}`
        );
        return null;
      }

      return {
        ...holding,
        listedAsset,
      };
    })
    .filter((e) => e) as HoldingWithListedAsset[];

  return holdingsWithListedAssets;
}