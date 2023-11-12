import { ListedAsset, Portfolio, PortfolioSlice, Prisma, User } from "@prisma/client";
import { FilterSettings, mapHoldingsToListedAssets } from "./map";
import { mergeUpdatedHoldings } from "./update";
import { FundHoldings } from "@/lib/finnhub/types";
import { prisma } from "@/initializers/prisma";
import _ from "lodash";
import { getPositions } from "@/services/portfolio/playback";
import { addMarketValues } from "@/services/portfolio/value";
import { Position, PositionWithMarketValue } from "@/services/portfolio/types";
import { isCompliant, wasPreviouslyNonCompliant } from "@/services/shariah/filter";
import { queueSliceLiquidation } from "@/workers/src/autoSliceLiquidation";

import finnhub from "@/lib/finnhub";
import { sendEmail } from "@/lib/resend";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { UserWithWhitelistAndBlacklist } from "@/types";
dayjs.extend(customParseFormat);

export type Trigger =
    'user-settings-change' | // 📧 liquidate-non-compliant-assets
    'shariah-compliance-update' | // 📧 liquidate-non-compliant-assets
    'fund-settings-change' | // 📧 liquidate-non-compliant-assets, ✅ single email
    'holdings-update'; // ✅ single email

export interface Liquidation {
    portfolio: Portfolio;
    listedAsset: ListedAsset;
    position: Position | PositionWithMarketValue;
}

export async function refreshUser(userId: string, trigger: Trigger) {
    const user = await getUser(userId);
    const portfolios = await getPortfolios(user);

    const liquidations: Liquidation[] = [];
    const jobNamesByPortfolioId: Record<string, string> = {}

    for (const portfolio of portfolios) {
        const filters = getFilterSettings(user, portfolio);
        const [holdings, holdingsAtDate] = await getHoldings(portfolio);
        const updatedSlices = await refreshFundHoldingsForPortfolio(portfolio, [holdings, holdingsAtDate]);
        if (!updatedSlices) throw "No holdings remaining in portfolio, skipping";

        const removedSlices = getRemovedSlices(updatedSlices);
        const removedAssets = await getRemovedAssets(removedSlices);
        const [_positions] = await getPositions(portfolio.slices, user.alpacaToken!);
        const positions = await addMarketValues(_positions);

        if (!hasPositionsInRemovedSlices(removedSlices, positions, removedAssets)) continue;

        const [removedFromFund, nonCompliant] = getRemovedAndNonCompliantSlices(removedSlices);

        if (removedFromFund.length > 0) {
            // gets liquidated regardless of 'onFail' setting
            await handleRemovedFromFundSlices(user, portfolio, removedFromFund, removedAssets, positions);
        }
        // Holdings updates shouldn't trigger non-compliance liquidations
        if (trigger === 'holdings-update') continue;

        if (nonCompliant.length) {
            await handleNonCompliantSlices(user, portfolio, nonCompliant, removedAssets, filters, positions, liquidations, jobNamesByPortfolioId);
        }
    }

    if (liquidations.length) {
        await sendEmail('liquidate-non-compliant-asset', { liquidations, jobNamesByPortfolioId, trigger }, user.email);
    }
}

export async function refreshSinglePortfolio(portfolio: PortfolioWithSlicesFundAndUserWhitelistBlacklist, trigger: Trigger, holdingsDate?: string) {
    const user = portfolio.user as UserWithWhitelistAndBlacklist;
    const filters = getFilterSettings(user, portfolio);

    const [holdings, holdingsAtDate] = await getHoldings(portfolio, holdingsDate);
    const updatedSlices = await refreshFundHoldingsForPortfolio(portfolio, [holdings, holdingsAtDate]);
    if (!updatedSlices) {
        console.error(`No holdings remaining in portfolio ${portfolio.id}, skipping`);
        return;
    }

    const removedSlices = getRemovedSlices(updatedSlices);
    const removedAssets = await getRemovedAssets(removedSlices);
    const [_positions] = await getPositions(portfolio.slices, user.alpacaToken!);
    const positions = await addMarketValues(_positions);

    if (!hasPositionsInRemovedSlices(removedSlices, positions, removedAssets)) return;

    const [removedFromFund, nonCompliant] = getRemovedAndNonCompliantSlices(removedSlices);

    if (removedFromFund.length) {
        await handleRemovedFromFundSlices(user, portfolio, removedFromFund, removedAssets, positions);
    }
    if (trigger === 'holdings-update') return;

    if (nonCompliant.length) {
        const liquidations: Liquidation[] = [];
        const jobNamesByPortfolioId: Record<string, string> = {}
        await handleNonCompliantSlices(user, portfolio, nonCompliant, removedAssets, filters, positions, liquidations, jobNamesByPortfolioId);

        if (liquidations.length) {
            await sendEmail('liquidate-non-compliant-asset', { liquidations, jobNamesByPortfolioId, trigger }, user.email);
        }
    }
}

async function refreshFundHoldingsForPortfolio(
    portfolio: PortfolioWithSlicesFundAndUserWhitelistBlacklist,
    _holdings: [FundHoldings, string],
) {
    const [holdings, holdingsAtDate] = _holdings;

    // Filter the new holdings based on the user and portfolio settings
    const filters: FilterSettings = {
        allowDoubtful: portfolio.allowDoubtful,
        allowUnrated: portfolio.allowUnrated,
        blacklist: (portfolio.user as any).blacklist,
        whitelist: (portfolio.user as any).whitelist,
    };
    const mappedHoldings = await mapHoldingsToListedAssets(holdings);
    const compliantHoldingsSet = new Set(mappedHoldings.filter(h => isCompliant(h.listedAsset, filters)));
    const nonCompliantAssetIds = mappedHoldings.filter(h => !compliantHoldingsSet.has(h)).map(h => h.listedAsset.id);
    const filteredHoldings = Array.from(compliantHoldingsSet);

    if (filteredHoldings.length === 0) {
        console.log(`No tradable holdings found for ${portfolio.id}, skipping`);
        return;
    }

    // Merge the new holdings with the existing holdings
    const { updatedSlices } = mergeUpdatedHoldings(
        portfolio.id,
        portfolio.slices,
        filteredHoldings.map((h) => [h.listedAsset.id, h.percent]),
        nonCompliantAssetIds
    );

    // Update portfolio slices
    await prisma.$transaction(updatedSlices.map((slice) =>
        prisma.portfolioSlice.upsert({
            where: {
                id: slice.id,
            },
            update: slice,
            create: slice,
        })
    ));

    // Done, update the portfolio's latest change date
    await prisma.portfolio.update({
        where: {
            id: portfolio.id,
        },
        data: {
            latestChangeMerged: new Date(holdingsAtDate),
            latestChangeSeen: new Date(holdingsAtDate),
        },
    });

    return updatedSlices;
}

const portfolioWithSlicesFundAndUserWhitelistBlacklist = Prisma.validator<Prisma.PortfolioArgs>()({
    include: {
        slices: true,
        fund: true,
        user: {
            include: {
                whitelist: true,
                blacklist: true,
            },
        },
    },
});
type PortfolioWithSlicesFundAndUserWhitelistBlacklist = Prisma.PortfolioGetPayload<
    typeof portfolioWithSlicesFundAndUserWhitelistBlacklist
>;

async function getUser(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { whitelist: true, blacklist: true },
    });
    return user!;
}

async function getPortfolios(user: User) {
    return await prisma.portfolio.findMany({
        where: { userId: user.id, deleted: false, fundIsin: { not: "MIGRATED" } },
        include: { slices: true, fund: true, user: { include: { whitelist: true, blacklist: true } } },
    });
}

function getFilterSettings(user: UserWithWhitelistAndBlacklist, portfolio: Portfolio) {
    return {
        allowDoubtful: portfolio.allowDoubtful,
        allowUnrated: portfolio.allowUnrated,
        blacklist: user.blacklist,
        whitelist: user.whitelist,
    };
}

async function getHoldings(portfolio: PortfolioWithSlicesFundAndUserWhitelistBlacklist, date: string = dayjs(portfolio.latestChangeSeen).format('YYYY-MM-DD')) {
    return await finnhub.getFundHoldings(
        portfolio.fund.type == "etf" ? "etf" : "mutual-fund",
        portfolio.fundIsin,
        date
    );
}

function getRemovedSlices(updatedSlices: PortfolioSlice[]) {
    return updatedSlices.filter(s => s.isDeleted);
}

async function getRemovedAssets(removedSlices: PortfolioSlice[]) {
    return await prisma.listedAsset.findMany({
        where: {
            id: {
                in: removedSlices.map((s) => s.listedAssetId),
            },
        },
    });
}

function hasPositionsInRemovedSlices(removedSlices: PortfolioSlice[], positions: Position[], removedAssets: ListedAsset[]) {
    const positionsBySymbol = _.keyBy(positions, 'symbol');
    const removedAssetsById = _.keyBy(removedAssets, "id");
    const removedWithPositions = removedSlices
        .filter((s) => {
            const { symbol } = removedAssetsById[s.listedAssetId]
            return positionsBySymbol[symbol]?.qty > 0
        });

    return removedWithPositions.length > 0;
}

function getRemovedAndNonCompliantSlices(removedSlices: PortfolioSlice[]) {
    const removedFromFund = removedSlices.filter(s => s.deletedReason === "removed-from-fund")
    const nonCompliant = removedSlices.filter(s => s.deletedReason === "non-compliant")

    return [removedFromFund, nonCompliant];
}

async function handleRemovedFromFundSlices(user: User, portfolio: PortfolioWithSlicesFundAndUserWhitelistBlacklist, removedFromFund: PortfolioSlice[], assets: ListedAsset[], positions: Position[]) {
    const positionsBySymbol = _.keyBy(positions, 'symbol');
    const removedAssetsById = _.keyBy(assets, "id");

    const removedFromFundWithPositions = removedFromFund.filter((s) => {
        const { symbol } = removedAssetsById[s.listedAssetId]
        return positionsBySymbol[symbol]?.qty > 0
    });

    if (!removedFromFundWithPositions.length) return;

    const jobName = await queueSliceLiquidation({
        userId: user.id,
        portfolioIds: [portfolio.id],
        symbols: removedFromFundWithPositions.map(s => removedAssetsById[s.listedAssetId].symbol),
        reason: "removed-from-fund",
    });

    const emailData = {
        portfolioId: portfolio.id,
        jobName,
        removedAssets: removedFromFundWithPositions.map(s => removedAssetsById[s.listedAssetId]),
    }
    await sendEmail('liquidate-dropped-fund-holdings', emailData, user.email);
}

async function handleNonCompliantSlices(user: User, portfolio: Portfolio, nonCompliant: PortfolioSlice[], removedAssets: ListedAsset[], filters: FilterSettings, positions: Position[], liquidations: Liquidation[], jobNamesByPortfolioId: Record<string, string>) {
    const targetSlices: PortfolioSlice[] = [];

    switch (portfolio.onNonCompliance) {
        case 'notify':
            break;
        case 'sell':
            targetSlices.push(...nonCompliant);
            break;
        case 'wait':
            const failedTwice = nonCompliant.filter(slc =>
                wasPreviouslyNonCompliant(removedAssets.find(a => a.id === slc.listedAssetId)!.shariahDetailsPrevious, filters));
            targetSlices.push(...failedTwice);
            break;
    }

    if (!targetSlices.length) return;

    const jobName = await queueSliceLiquidation({
        userId: user.id,
        portfolioIds: [portfolio.id],
        symbols: nonCompliant.map((s) => removedAssets.find(a => a.id === s.listedAssetId)!.symbol),
        reason: 'non-compliant',
    });

    jobNamesByPortfolioId[portfolio.id] = jobName;

    const newLiquidations = targetSlices.map(s => ({
        portfolio,
        listedAsset: removedAssets.find(a => a.id === s.listedAssetId)!,
        position: positions.find(p => p.symbol === removedAssets.find(a => a.id === s.listedAssetId)!.symbol)!
    })).filter(({ position }) => position); // only liquidate slices with positions

    liquidations.push(...newLiquidations);
}