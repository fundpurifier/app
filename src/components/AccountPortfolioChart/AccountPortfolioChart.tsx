"use client";

import React from "react";
import Chart from "@/components/Chart";
import Loading from "@/components/Loading";
import {
  retrieveChartDataForPeriod,
  retrieveCostBasisForTimestamps,
} from "./actions";
import { useLocalState } from "@/hooks/useLocalState";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function PortfolioChart() {
  const periods = ["1D", "1M", "1Y", "ALL"];
  const DEFAULT_PERIOD = "1M";

  const [selectedPeriod, setSelectedPeriod] = useLocalState('chartPeriod', DEFAULT_PERIOD);
  const [data, setData] = React.useState<[number[][], [number, number][]]>([[], []]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    async function fetchData() {
      let timePeriod, timeInterval;

      switch (selectedPeriod) {
        case "1D":
          timePeriod = "1D";
          timeInterval = "1Min";
          break;
        case "1M":
          timePeriod = "1M";
          timeInterval = "1D";
          break;
        case "1Y":
          timePeriod = "1A";
          timeInterval = "1D";
          break;
        case "ALL":
          timePeriod = "all";
          timeInterval = "1D";
          break;
      }

      const chartData = await retrieveChartDataForPeriod(
        timePeriod!,
        timeInterval as any
      );

      const costData = await retrieveCostBasisForTimestamps(
        chartData.map(([timestamp, y]) => timestamp)
      );

      setData([chartData, costData]);
    }

    setLoading(true);
    fetchData().then(() => setLoading(false));
  }, [selectedPeriod]);

  return (
    <ErrorBoundary>
      <div className="flex flex-row justify-end">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-3 py-1 ${selectedPeriod === period
              ? "rounded-sm text-white bg-slate-700"
              : "text-slate-700"
              }`}
          >
            {period}
          </button>
        ))}
      </div>
      <div className="relative">
        <Loading show={loading} message="Loading chart" />
        <Chart data={data} options={CHART_OPTIONS} />
      </div>
    </ErrorBoundary>
  );
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
      name: "Cost Basis",
      color: "#f00",
      lineWidth: 1,
      type: "line",
      threshold: null,
    },
  ],
};
