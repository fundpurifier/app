import React from "react";
import Chart from "@/components/Chart";
import getPerformance from "@/services/portfolio/performance";
import { getSignedInUser } from "@/helpers.server";
import Alpaca from "@/lib/brokers/alpaca";
import { classByVal, n, p } from "@/helpers";
import _ from "lodash";
import Big from "big.js";
import { PortfolioWithSlices } from "@/types";
import { addMarketValues } from "@/services/portfolio/value";
import { Separator } from "@/components/ui/separator";
import { playbackOrdersAndActions } from "@/services/portfolio/playback";

interface Props {
  portfolio: PortfolioWithSlices;
}

async function FundChart({ portfolio }: Props) {
  const user = await getSignedInUser();
  const stats = {
    marketValue: 0,
    returnUsd: 0,
    returnPc: 0,
    dividendsUsd: 0,
    dividendsPc: 0,
  };
  const sliceIds = portfolio.slices.map((slice) => slice.id);

  // Get relevant orders
  const alpaca = new Alpaca(user.alpacaToken!, false);
  const [clock, allOrders] = await Promise.all([
    alpaca.getClock(),
    alpaca.getClosedOrders()
  ]);
  const orders = allOrders.filter((order) => sliceIds.includes(order.sliceId));
  const today = new Date();
  const toDate = !clock.is_open ? today : new Date(today.getTime() - 24 * 60 * 60 * 1000)

  let data: [number, number][][] = [[], []];
  if (orders.length) {
    // Calculate performance
    const {
      cost,
      value,
      dividends,
    } = await getPerformance(orders, toDate);
    data = [value, cost];

    const [_positions] = await playbackOrdersAndActions(orders);
    const positions = await addMarketValues(_positions);
    const sum = (field: "costBasis" | "marketValue" | "unrealizedPnl") =>
      positions.reduce((sum, cur: any) => sum.add(cur[field] ?? 0), Big(0));

    stats.marketValue = +sum("marketValue");
    stats.returnUsd = +sum("unrealizedPnl");
    stats.returnPc = 100 * stats.returnUsd / stats.marketValue;
    stats.dividendsUsd = dividends;
    stats.dividendsPc = 100 * dividends / stats.marketValue;
    // TODO: Derive dividend yield from the div yield of the underlying assets
  }

  return <>
    {data[0].length > 2 ? (
      <Chart data={data} options={CHART_OPTIONS} />
    ) : (
      <div className="text-muted-foreground">
        {
          stats.marketValue === 0 ?
            "Complete your first investment to see a chart of your fund's performance 📈" :
            "Your chart is shown 1 week after your first investment in a filtered fund"
        }
      </div>
    )}

    <Separator className="my-4" />

    <div className="card-edge-to-edge px-6 grid grid-cols-1 md:grid-cols-3 gap-y-6 md:gap-y-0">
      <div className="flex flex-col gap-y-1 text-center justify-center">
        <div className="text-sm font-medium">
          Market Value
        </div>
        <div className="text-2xl font-bold">{n(stats.marketValue)}</div>
        {/* <p className="text-xs text-muted-foreground">
          +20.1% from last month
        </p> */}
      </div>
      <div className="flex flex-col gap-y-1 text-center justify-center">
        <div className="text-sm font-medium">
          Return
        </div>
        <div className="text-2xl font-bold">{n(stats.returnUsd, true)}</div>
        <p className="text-xs text-muted-foreground">
          <span className={classByVal(stats.returnPc,
            ['text-red-600', 'text-green-500'])}>{p(stats.returnPc, true)}</span> since inception
        </p>
      </div>
      <div className="flex flex-col gap-y-1 text-center justify-center">
        <div className="text-sm font-medium">
          Dividends
        </div>
        <div className="text-2xl font-bold">{n(stats.dividendsUsd)}</div>
        {/* <p className="text-xs text-muted-foreground">
          {p(stats.dividendsPc)} dividend yield
        </p> */}
      </div>
    </div>
  </>
}

const CHART_OPTIONS = {
  series: [
    {
      name: "Portfolio",
      color: "#A3A3A3",
      lineWidth: 1.5,
      fillColor: {
        linearGradient: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: .35,
        },
        stops: [
          [0, "rgba(192, 203, 218, .6)"],
          [1, "rgba(192, 203, 218, 0)"],
        ],
      },
      type: "area",
      threshold: null,
    },
    {
      name: "Invested",
      color: "#ff6666",
      lineWidth: 1,
      type: "line",
      threshold: null,
    },
  ],
};

export default FundChart;
