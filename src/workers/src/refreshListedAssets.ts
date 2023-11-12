import { Queues } from "../queues";
import { MetricsTime, Worker } from "bullmq";
import connection from "../connection";
import Alpaca from "@/lib/brokers/alpaca";
import { requireEnv } from "@/helpers";
import { ListedAsset } from "@prisma/client";
import { AssetResponse } from "@/lib/brokers/alpaca/types";
import { prisma } from "@/initializers/prisma";
import { alpacaAssetToDb } from "@/lib/brokers/alpaca/mappers";
import finnhub from "@/lib/finnhub";
import _ from "lodash";
import { fetchShariahData } from "@/services/shariah/fetch";
import { getToken } from "./helpers/db";

type AlpacaAssetWithISIN = AssetResponse[0] & { isin: string };

export default new Worker<void, void>(
  Queues.refreshListedAssets,
  async (job) => {
    await refreshListedAssets();
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

export async function refreshListedAssets() {
  const [assets, { toAdd, toRemove, toChange }] = await prepareAssetUpdate();
  if (toRemove.length) await remove(toRemove);
  if (toChange.length) await change(toChange, assets);
  if (toAdd.length) await add(toAdd);

  return {
    added: toAdd.length,
    removed: toRemove.length,
    changed: toChange.length,
  };
}

const hasChanged = (
  alpacaAsset: AssetResponse[0],
  listedAsset: ListedAsset
) => {
  return (
    alpacaAsset.symbol !== listedAsset.symbol ||
    cleanUpName(alpacaAsset.name) !== listedAsset.name
  );
};

async function prepareAssetUpdate() {
  const assets = (await fetchActiveAssetsFromAlpaca()) as AlpacaAssetWithISIN[];

  // Alpaca's asset names are 💩 and they don't provide ISINs, so we're
  // using Finnhub to get the ISINs and names.
  const symbols = await finnhub.getAllUSSymbols();

  // Extend Alpaca assets with ISINs and names
  assets.map((asset) => {
    const details = symbols.find((s) => s.symbol === asset.symbol);
    if (!details) return;

    // Assign the details
    asset.isin = details.isin;
    asset.name = details.description;
  });

  const existingAssets = await prisma.listedAsset.findMany();
  return [assets, calculateChanges(assets, existingAssets)] as [
    AlpacaAssetWithISIN[],
    ReturnType<typeof calculateChanges>
  ];
}

async function fetchActiveAssetsFromAlpaca() {
  const assets = await new Alpaca(
    await getToken(),
    false
  ).getAssets();

  const activeAssets = assets.filter(
    (asset) => asset.tradable && asset.status === "active"
  );

  // Include non-fractionable assets, but mark them as inactive
  activeAssets.forEach(asset => {
    if (!asset.fractionable) asset.status = "inactive"
  })

  return activeAssets
}

function calculateChanges(
  tradable: AlpacaAssetWithISIN[],
  existingAssets: ListedAsset[]
) {
  const tradableIds = new Set(tradable.map((asset) => asset.id));
  const existingIds = new Set(existingAssets.map((asset) => asset.id));

  const toAdd = tradable.filter((a) => !existingIds.has(a.id));
  const toRemove = existingAssets.filter((a) => !tradableIds.has(a.id));
  const toChange = existingAssets.filter(
    (asset) =>
      tradableIds.has(asset.id) &&
      hasChanged(tradable.find((a) => a.id === asset.id)!, asset)
  );

  return {
    toAdd,
    toRemove,
    toChange,
  };
}

async function remove(toRemove: ListedAsset[]) {
  // Set the assets as inactive
  const ids = toRemove.map((asset) => asset.id);
  await prisma.listedAsset.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  });

  // Technically you're just updating the portfolio definitions, since these
  // assets are no longer active (and can't be traded). They'd be removed
  // eventually anyway, but this is "cleaner" and more immediate.
  // TODO: rescaleSliceAcrossAllPortfolios(toRemove)
}

async function change(toChange: ListedAsset[], assets: AlpacaAssetWithISIN[]) {
  const ids = toChange.map((asset) => asset.id);
  const newAssets = assets.filter((asset) => ids.includes(asset.id));

  // Update the assets
  await prisma.$transaction(
    newAssets.map((asset) =>
      prisma.listedAsset.update({
        where: { id: asset.id },
        data: {
          symbol: asset.symbol,
          name: cleanUpName(asset.name),
        },
      })
    )
  );
}

async function add(toAdd: AlpacaAssetWithISIN[]) {
  // Retrieve Shariah compliance data for the new stocks before adding them
  const allFunds = await prisma.fund.findMany({ select: { isin: true } });
  const fundIds = allFunds.map((f) => f.isin);
  const stockSymbols = toAdd
    .filter(({ isin }) => !fundIds.includes(isin))
    .map((a) => a.symbol);
  const shariahData = await fetchShariahData(stockSymbols);

  const UNRATED: Pick<
    ListedAsset,
    "shariahStatus" | "shariahDetailsCurrent" | "shariahDetailsPrevious"
  > = {
    shariahStatus: "unrated",
    shariahDetailsCurrent: null,
    shariahDetailsPrevious: null,
  };

  // Add the assets in batches
  const withISINs = toAdd.filter((a) => a.isin);
  for (const batch of _.chunk(withISINs, 1)) {
    const upsertOps = batch.map((asset) => {
      const shariahFields =
        fundIds.includes(asset.isin) || !shariahData[asset.symbol]
          ? UNRATED
          : {
            shariahStatus: shariahData[asset.symbol].status,
            shariahDetailsCurrent: shariahData[asset.symbol].details,
            shariahDetailsPrevious: null,
          };

      const data = {
        ...alpacaAssetToDb(asset),
        ...shariahFields,
        name: cleanUpName(asset.name),
        isStock: !fundIds.includes(asset.isin),
      };

      // Note: Using 'upsert' instead of 'create' since we have some old ISIN
      // numbers that we got from Leeway that were wrong and needed to be corrected.
      return prisma.listedAsset.upsert({
        where: { id: asset.id },
        create: data,
        update: data,
      });
    });

    try {
      await prisma.$transaction(upsertOps);
    } catch (e: any) {
      if (e.code == "P2002" && e.meta.target[0] == "isin") {
        console.warn(`🐞 The ISIN ${batch[0].isin} already exists`, batch);
        continue;
      }
    }
  }
}

export const cleanUpName = (name: string) => {
  interface Rule {
    pattern: RegExp;
    replacement: string;
  }

  // Check if any of the exceptions match
  const exceptions = [
    { fullMatch: "Some Random Company, Inc.", replace: "Random" },
  ];
  if (exceptions.some((e) => e.fullMatch === name)) {
    return exceptions.find((e) => e.fullMatch === name)!.replace;
  }

  // List of rules, applied sequentially (so place the longer matchers at the top)
  const rules: Rule[] = [
    {
      pattern: /\bAmerican Depositary Receipts\b/g,
      replacement: "ADR",
    },
    {
      pattern: /\b(American )?Depositary Shares\b/g,
      replacement: "ADS",
    },
    { pattern: /\bPreferred Series B\b/gi, replacement: "" },
    {
      pattern: /\bThe (.*?) (Corporation|Company|Companies)\b/i,
      replacement: "$1",
    },
    {
      pattern: /\b(Ordinary|Common) (Shares?|Stock).*/gi,
      replacement: "",
    },
    { pattern: /\bClass (A|B|C).*/gi, replacement: "" },
    { pattern: /(& )?\b(Co|Corp|Ltd|Inc)\.?\b/gi, replacement: "" },
    { pattern: /\bCorporation\b/gi, replacement: "" },
    { pattern: /\bCompan(y|ies)(\b|$)/i, replacement: "" },
    { pattern: /\.com(\b|$)/, replacement: "" },
  ];

  for (const rule of rules) {
    name = name.replace(rule.pattern, rule.replacement);
  }

  // Replace stray characters
  name = name.replace(/([A-Za-z]|\s)[\.\,]+(\b|\s|$)/g, "$1 ");
  name = name.replace(/([A-Za-z]|\s)\.(\b|\s|$)/g, "$1 ");
  name = name.replace(/([A-Za-z]|\s)\,(\b|\s|$)/g, "$1 ");

  // Squeeze whitespace
  name = name.replace(/ +/g, " ");
  name = name.trim();

  return name;
};
