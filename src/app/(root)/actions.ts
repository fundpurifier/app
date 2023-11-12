"use server";
import 'server-only';

import Big from "big.js";
import { currentUser } from "@clerk/nextjs";

import { prisma } from "@/initializers/prisma";
import Alpaca from "@/lib/brokers/alpaca";
import { getPositionsBulk } from "@/services/portfolio/playback";
import { PositionWithMarketValue } from "@/services/portfolio/types";
import { addMarketValues } from "@/services/portfolio/value";
import { getPrimaryEmail, getSignedInUser } from "@/helpers.server";
import getPerformance from '@/services/portfolio/performance';

export interface MarketStatus {
  isOpen: boolean;
  nextOpen: Date;
  nextClose: Date;
  nextOpenInSeconds: number;
  nextCloseInSeconds: number;
}

export async function fetchUser() {
  // We know the user is signed in, find their details
  const session = await currentUser();
  const email = await getPrimaryEmail(session!);
  const user = await prisma.user.findFirst({ where: { email, isActive: true } });
  return { email, user };
}

export async function getUserBalance() {
  const user = await getSignedInUser();
  const alpaca = new Alpaca(user.alpacaToken!, false);

  const account = await alpaca.getAccount();
  return account.cash;
}

export async function getMarketStatus() {
  const user = await getSignedInUser();
  const alpaca = new Alpaca(user!.alpacaToken!, false);
  const clock = await alpaca.getClock();

  const now = new Date();
  const nextOpenInSeconds = Math.floor((clock.next_open.getTime() - now.getTime()) / 1000);
  const nextCloseInSeconds = Math.floor((clock.next_close.getTime() - now.getTime()) / 1000);

  return { isOpen: clock.is_open, nextOpen: clock.next_open, nextOpenInSeconds, nextClose: clock.next_close, nextCloseInSeconds };
}

export async function getPageData() {
  const cash = await getUserBalance();
  const fundData = await fetchFundData();

  return { cash, ...fundData };
}

export async function getChartData() {
  type Point = [number, number];
  type DataGroup = Point[]; // Represents an array of points
  type Portfolio = [DataGroup, DataGroup]; // [Value, Cost]

  const user = await getSignedInUser();
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id, deleted: false },
    include: { slices: true },
  });

  const alpaca = new Alpaca(user.alpacaToken!, false);
  const [clock, allOrders] = await Promise.all([
    alpaca.getClock(),
    alpaca.getClosedOrders()
  ]);

  const today = new Date();
  const toDate = !clock.is_open ? today : new Date(today.getTime() - 24 * 60 * 60 * 1000)

  let data: [number, number][][] = [[], []];
  const portfolioData: Portfolio[] = await Promise.all(portfolios.map(async (portfolio) => {
    const sliceIds = portfolio.slices.map((slice) => slice.id);
    const orders = allOrders.filter((order) => sliceIds.includes(order.sliceId));

    if (orders.length) {
      const {
        cost,
        value,
      } = await getPerformance(orders, toDate);

      return [value, cost];
    }
    return [[], []];
  }));

  let reducedData: Portfolio = [[], []];
  portfolioData.forEach(([valueData, costData]) => {
    reducedData[0] = mergeDataGroups(reducedData[0], valueData);
    reducedData[1] = mergeDataGroups(reducedData[1], costData);
  });

  return reducedData;

  // Utility function to merge two point arrays, adding the second elements if timestamps match
  function mergeDataGroups(a: DataGroup, b: DataGroup): DataGroup {
    const map = new Map<number, number>();

    a.forEach(([timestamp, value]) => {
      map.set(timestamp, value + (map.get(timestamp) || 0));
    });

    b.forEach(([timestamp, value]) => {
      map.set(timestamp, value + (map.get(timestamp) || 0));
    });

    return Array.from(map.entries());
  };
}

export async function fetchFundData() {
  const user = await getSignedInUser();
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id, deleted: false },
    include: { slices: true },
  });

  const bulkPositionData = await getPositionsBulk(portfolios, user.alpacaToken!);
  const rowData: Record<string, ReturnType<typeof getFundData>> = {};

  for (const [index, portfolio] of portfolios.entries()) {
    const [_positions, dividends] = bulkPositionData[index];
    const positions = await addMarketValues(_positions);
    rowData[portfolio.id] = getFundData(positions, dividends);
  }

  // Sort by market value in desc orer
  portfolios.sort((a, b) => {
    const marketValueA = rowData[a.id].marketValue;
    const marketValueB = rowData[b.id].marketValue;
    return marketValueB - marketValueA;
  });

  return { portfolios, rowData }
}

function getFundData(positions: PositionWithMarketValue[], dividends: number) {
  let marketValue = Big(0);
  let costBasis = Big(0);
  let unrealizedProfitLoss = Big(0);
  let realizedProfitLoss = Big(0);

  for (const position of positions) {
    marketValue = marketValue.add(position.marketValue);
    costBasis = costBasis.add(position.costBasis);
    unrealizedProfitLoss = unrealizedProfitLoss.add(position.unrealizedPnl);
    realizedProfitLoss = realizedProfitLoss.add(position.realizedPnl);
  }

  return {
    marketValue: +marketValue,
    costBasis: +costBasis,
    unrealizedProfitLoss: +unrealizedProfitLoss,
    realizedProfitLoss: +realizedProfitLoss,
    holdings: positions.length,
    dividends: +dividends,
  };
}