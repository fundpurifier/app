"use server";

import Big from "big.js";
import _ from "lodash";
import { prisma } from "@/initializers/prisma";

import { calculateOrderAmounts } from "@/services/portfolio/rebalance";
import { getPositions } from "@/services/portfolio/playback";
import { Position, PositionWithMarketValue } from "@/services/portfolio/types";
import { getBulkQuotes } from "@/services/portfolio/value";
import { ListedAsset, PortfolioSlice } from "@prisma/client";
import { generateId } from "@/helpers";

interface PercentDetails {
  beforePc: number;
  afterPc: number;
}

export type PositionSlice = {
  position?: Position;
  slice?: PortfolioSlice;
  listedAsset: ListedAsset;
}

export type PositionSliceWithMarketValue = PositionSlice & {
  position?: PositionWithMarketValue
}

export type PositionSliceWithNotionalOrder = PositionSlice & {
  sharePrice: number;
  orderType: 'notional';
  notional: number;
}

type PositionSliceWithQtyOrder = PositionSlice & {
  sharePrice: number;
  orderType: 'qty';
  qty: number;
}

export type PositionSliceWithOrderDetails =
  PositionSliceWithNotionalOrder | PositionSliceWithQtyOrder

export async function mergePositionsAndSlices<T extends Position>(positions: T[], slices: PortfolioSlice[]) {
  const listedAssets = await prisma.listedAsset.findMany({
    where: {
      OR: [
        { symbol: { in: positions.map(p => p.symbol) } },
        { id: { in: slices.map(slc => slc.listedAssetId) } }
      ]
    }
  })

  const assetBySymbol = (s: string) => listedAssets.find(la => la.symbol === s)!
  const assetById = (id: string) => listedAssets.find(la => la.id === id)!
  const slice = (p: Position) => slices.find(slc => assetById(slc.listedAssetId).symbol === p.symbol)

  type SpecificPositionSlice = PositionSlice & {
    position?: T;
  }

  const positionsWithSlices: SpecificPositionSlice[] = positions
    .filter(position => slice(position))
    .map(position => ({ position, slice: slice(position), listedAsset: assetBySymbol(position.symbol) }))

  const positionsWithoutSlice: SpecificPositionSlice[] = positions
    .filter(p => !slice(p))
    .map(position => ({ position, listedAsset: assetBySymbol(position.symbol) }));

  const slicesWithoutPositions: SpecificPositionSlice[] = slices
    .filter(slc => !positions.find(p => p.symbol === assetById(slc.listedAssetId).symbol))
    .map(slice => ({ slice, listedAsset: assetById(slice.listedAssetId) }));

  // Merge
  return [...positionsWithSlices, ...positionsWithoutSlice, ...slicesWithoutPositions];
}

export async function previewOrders(
  alpacaToken: string,
  portfolioId: string,
  amount: number,
  isLiquidation = false
): Promise<[PositionSliceWithOrderDetails[], PercentDetails[]]> {
  // Fetch portfolio with all listedAssets
  let portfolio = await fetchPortfolioWithSlices(portfolioId);
  const [_positions] = await getPositions(portfolio.slices, alpacaToken);

  // Compute slices
  const positionSlices = await mergePositionsAndSlices(_positions, portfolio.slices)
  const prices = await getBulkQuotes(positionSlices.map(({ listedAsset }) => listedAsset.symbol))
  const price = (s: string) => prices.find(p => p.symbol === s)?.price ?? 0
  const marketValue = (p?: Position) => p ? price(p.symbol) * p.qty : 0

  // How much should we order of each slice/position?
  if (isLiquidation) {
    // Sell the entire position
    const positionSlicesWithOrderAmount: PositionSliceWithQtyOrder[] = positionSlices
      .filter(p => p.position && p.position.qty > 0)
      .map((p) => {
        return {
          ...p,
          orderType: 'qty',
          qty: -1 * p.position!.qty,
          sharePrice: price(p.listedAsset.symbol)
        }
      })

    const preview = positionSlicesWithOrderAmount.filter(
      (p) => p.qty !== 0
    );

    const marketValue = (p: PositionSliceWithOrderDetails) =>
      Math.max(0, p.position!.qty * p.sharePrice)

    preview.sort((a, b) => marketValue(b) - marketValue(a));
    return [preview, []]

  } else {
    // Calculate the $ amount to trade of each slice
    const weights = positionSlices.map(({ slice }) => Big(slice?.percent ?? 0));
    const values = positionSlices.map(({ position }) => Big(marketValue(position)));
    const orderAmounts = calculateOrderAmounts(weights, values, Big(amount));

    // Add orderAmount to positions
    const positionSlicesWithOrderAmount: PositionSliceWithNotionalOrder[] = positionSlices
      .map((p, i) => {
        return {
          ...p,
          orderType: 'notional',
          notional: +orderAmounts[i].toFixed(2), // Notional orders must be limited to 2 decimal places
          sharePrice: price(p.listedAsset.symbol)
        }
      })

    const preview = positionSlicesWithOrderAmount.filter(
      (p) => p.orderType === 'notional' && p.notional !== 0
    );

    // Find before/after percentages for each of the orders (we log this in [ActionLog])
    const total = positionSlices.reduce(
      (sum, { position }) => sum.add(marketValue(position)),
      Big(0)
    );
    const changeDetails = preview.map(({ position, notional }) => ({
      beforePc: total.gt(0) ? +Big(marketValue(position)).div(total).mul(100) : 0,
      afterPc: +Big(marketValue(position) + notional!)
        .div(total.add(amount))
        .mul(100),
    }));

    preview.sort((a, b) => Math.abs(b.notional) - Math.abs(a.notional));
    return [preview, changeDetails];
  }
}

async function fetchPortfolioWithSlices(portfolioId: string) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      slices: {
        include: {
          listedAsset: true,
        },
      },
    },
  });

  if (!portfolio) throw "Portfolio not found";
  return portfolio;
}

export async function createSlicesForPositions(
  nonSlicePositions: Position[],
  portfolioId: string
) {
  const listedAssets = await prisma.listedAsset.findMany({
    where: { symbol: { in: nonSlicePositions.map((p) => p.symbol) } },
  });
  const listedAssetsBySymbol = _.keyBy(listedAssets, "symbol");

  // Any positions without a listed asset?
  if (nonSlicePositions.length !== listedAssets.length) {
    const positionsWithoutListedAssets = nonSlicePositions.filter(
      (p) => !listedAssetsBySymbol[p.symbol]
    );
    throw `Missing listed assets for non-slice positions: ${positionsWithoutListedAssets}`;
  }

  const createOps = nonSlicePositions.map((position) =>
    prisma.portfolioSlice.create({
      data: {
        id: generateId("slc"),
        portfolioId: portfolioId,
        listedAssetId: listedAssetsBySymbol[position.symbol].id,
        percent: 0,
      },
      include: {
        listedAsset: true,
      },
    })
  );

  const result = await prisma.$transaction(createOps);
  return result;
}