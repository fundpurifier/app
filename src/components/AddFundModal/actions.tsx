"use server";

import { generateId } from "@/helpers";
import { getSignedInUser } from "@/helpers.server";
import { prisma } from "@/initializers/prisma";
import finnhub from "@/lib/finnhub";
import { mapHoldingsToListedAssets } from "@/services/fund/map";
import { isCompliant } from "@/services/shariah/filter";
import Big from "big.js";

interface CreateFundParams {
  symbol: string;
  trackChanges: boolean;
  // rebalanceOnChange: boolean;
  allowUnrated: boolean;
  allowDoubtful: boolean;
  reinvestOnSell: boolean;
  onNonCompliance: "sell" | "wait" | "notify";
}

export async function createPortfolio(params: CreateFundParams) {
  const user = await getSignedInUser({
    include: {
      whitelist: true,
      blacklist: true,
    },
  });
  const { symbol, ...data } = params;

  // Retrieve the fund
  const fund = await prisma.fund.findFirst({
    where: {
      symbol,
    },
  });
  if (!fund) throw new Error(`Unable to find a fund with symbol ${symbol}`);

  // Retrieve holdings
  const [allHoldings, holdingsDate] = await finnhub.getFundHoldings(
    fund.type == "etf" ? "etf" : "mutual-fund",
    fund.isin
  );
  if (allHoldings.length === 0) {
    throw new Error(
      `${fund.symbol} doesn't have any holdings that are publicly traded equities on the US stock market.\n\nThis may be because:\n- it's a physically backed ETF (e.g. a commodities or precious metals ETF)\n- it's an options-based ETF\n- it invests in non-public securities (e.g. private companies)`
    );
  }

  // Map & filter them
  const holdings = await mapHoldingsToListedAssets(allHoldings)
  const filteredHoldings = holdings
    .filter(h => isCompliant(h.listedAsset, {
      allowDoubtful: params.allowDoubtful,
      allowUnrated: params.allowUnrated,
      blacklist: (user as any).blacklist,
      whitelist: (user as any).whitelist,
    }))

  if (!filteredHoldings.length) {
    throw new Error(
      `No holdings found for fund ${symbol} after filtering.\n\nThis may be because:\n- All the stocks in this fund are non-compliant with your filters\n- it's a physically backed ETF (e.g. a commodities or precious metals ETF)\n- it's an options-based ETF\n- it invests solely in non-public securities (e.g. private companies)`
    );
  }

  // Rescale weights to 100%
  const totalWeight = filteredHoldings.reduce(
    (acc, holding) => acc.add(holding.percent),
    Big(0)
  );
  filteredHoldings.forEach((holding) => {
    holding.percent = +Big(holding.percent).div(totalWeight).mul(100);
  });

  // Create portfolio
  const portfolio = await prisma.portfolio.create({
    data: {
      id: generateId("pf"),
      title: `Filtered ${symbol}`,
      fundIsin: fund.isin,
      userId: user.id,
      // We need to set these dates regardless of whether it's a tracked portfolio or not
      // so we can apply filtering settings against the full holdings list when on change
      latestChangeSeen: new Date(holdingsDate),
      latestChangeMerged: new Date(holdingsDate),
      ...data,
      ActionLog: {
        create: [
          {
            action: "fund_created",
            isAutomated: false,
            details: JSON.stringify(params),
          },
        ],
      },
    },
  });

  // Map holdings to [PortfolioSlice]s
  const portfolioSlices = filteredHoldings.map((holding) => ({
    id: generateId("slc"),
    portfolioId: portfolio.id,
    listedAssetId: holding.listedAsset.id,
    percent: holding.percent,
  }));

  // Create [PortfolioSlice]s
  const createOps = portfolioSlices.map((slice) =>
    prisma.portfolioSlice.create({
      data: slice,
    })
  );
  await prisma.$transaction(createOps);

  return portfolio;
}