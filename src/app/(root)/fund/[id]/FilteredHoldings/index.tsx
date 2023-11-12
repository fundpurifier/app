import React from "react";
import { prisma } from "@/initializers/prisma";
import _ from "lodash";
import Big from "big.js";
import { getPositions } from "@/services/portfolio/playback";
import { getSignedInUser } from "@/helpers.server";
import { addMarketValues } from "@/services/portfolio/value";
import { mergePositionsAndSlices } from "@/services/portfolio/order";
import Client from "./client";

interface Props {
  portfolioId: string;
}

export default async function ({ portfolioId }: Props) {
  const user = await getSignedInUser();
  if (!user.alpacaToken) throw new Error("User has no Alpaca token");

  // Get slices for this fund
  const slices = await prisma.portfolioSlice.findMany({
    where: { portfolioId },
    include: { listedAsset: true },
  });

  // Get positions
  const [_positions] = await getPositions(slices, user.alpacaToken!);
  const positions = await addMarketValues(_positions);
  positions.sort((a, b) => b.marketValue - a.marketValue);

  const total = +positions.reduce((all, p) => all.add(p.marketValue), Big(0));

  const allPositionsAndSlices = await mergePositionsAndSlices(positions, slices);

  // Sort by marketValue, followed by percent allocation
  allPositionsAndSlices.sort((a, b) => {
    const marketValueA = a.position?.marketValue || 0;
    const marketValueB = b.position?.marketValue || 0;
    const percentA = a.slice?.percent || 0;
    const percentB = b.slice?.percent || 0;

    // First, sort by market value
    const marketValueDifference = marketValueB - marketValueA;
    if (marketValueDifference !== 0) {
      return marketValueDifference;
    }

    // If market values are equal, sort by percent
    return percentB - percentA;
  });

  return <Client allPositionsAndSlices={allPositionsAndSlices} total={total} />;
}
