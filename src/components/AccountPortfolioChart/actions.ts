"use server";

import { getSignedInUser } from "@/helpers.server";
import { prisma } from "@/initializers/prisma";
import Alpaca from "@/lib/brokers/alpaca";
import { AccountActivity } from "@prisma/client";
import Big from "big.js";

export async function retrieveChartDataForPeriod(
  period: string,
  interval: "1Min" | "5Min" | "15Min" | "1H" | "1D"
) {
  const user = await getSignedInUser();

  const alpaca = new Alpaca(user.alpacaToken!, false);
  try {
    const { equity, timestamp } = await alpaca.getPortfolioHistory(
      period,
      interval
    );
    const result = equity.map((value, index) => [timestamp[index] * 1000, value]);
    return result;
  } catch (error) {
    console.error('Error retrieving portfolio history:', error);
    return [];
  }
}

export async function retrieveCostBasisForTimestamps(timestamps: number[]) {
  const user = await getSignedInUser();
  const depositEvents = await prisma.accountActivity.findMany({
    where: {
      user,
    },
  });
  return getNetAmountAtEachTimestamp(depositEvents, timestamps);
}

function getNetAmountAtEachTimestamp(
  events: AccountActivity[],
  timestamps: number[]
) {
  let i: number = 0;
  let amount: Big = new Big(0);
  const result: [number, number][] = [];

  timestamps.forEach((timestamp: number) => {
    while (
      i < events.length &&
      new Date(events[i].date) <= new Date(timestamp)
    ) {
      amount = amount.plus(events[i].amount);
      i++;
    }

    result.push([timestamp, +amount]);
  });

  return result;
}
