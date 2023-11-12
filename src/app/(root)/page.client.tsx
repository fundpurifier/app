'use client';

import React from "react";
import useSWR, { SWRConfig } from 'swr';
import _ from "lodash";
import { Table, Header, Row, Cell, Body } from "@/components/Table";
import { classByVal, n, p } from "@/helpers";
import Link from "next/link";
import { getChartData, getPageData } from "./actions";
import { LIST_OF_FUNDS } from "@/swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAddFundModal } from "@/hooks/useAddFundModal";
import AddFundModal from "@/components/AddFundModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Chart from "@/components/Chart";
import Loading from "@/components/Loading";
import PieChart from "./PieChart";
import { ArrowDown, ArrowUp } from "lucide-react";

const fetcher = async () => {
    return getPageData();
};

type Data = Awaited<ReturnType<typeof fetcher>>;

export default function PageClient({ fallback }: { fallback: Data }) {
    const { data, error } = useSWR(LIST_OF_FUNDS(), fetcher);
    const { cash, portfolios, rowData }: Data = data || fallback;

    // Compute stats
    const value = _.sumBy(portfolios, (p) => rowData[p.id].marketValue);
    const costBasis = _.sumBy(portfolios, (p) => rowData[p.id].costBasis);

    // Pie chart
    const pieData = portfolios
        .filter(p => rowData[p.id].marketValue > 0)
        .map((portfolio) => {
            return {
                name: portfolio.title,
                y: rowData[portfolio.id].marketValue
            };
        });

    return (
        <SWRConfig value={{ fallback }}>
            <AddFundModal />

            <div className="pad">
                <div className="flex flex-row items-center space-x-2">
                    <div className="text-xl font-semibold text-slate-600">{n(value)}</div>
                    <div className={cn("rounded-md px-1 py-0.5 flex flex-row items-center space-x-1", classByVal(value - costBasis, ["bg-[#FBE2E1] text-[#92000E]", "bg-[#E1F3E5] text-[#35713A]"]))}>
                        {value > costBasis ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                        <div className="pr-1">{p(Math.abs(100 * (value - costBasis) / costBasis))}</div>
                    </div>
                    <span className={cn(classByVal(value - costBasis, ["text-[#92000E]", "text-[#35713A]"]))}>
                        {n(value - costBasis, true)} total
                    </span>
                </div>
                <PortfolioChart />
            </div>
            <div className="h-16" />

            <div className="pad">
                <Card>
                    <CardContent>
                        <div className="md:flex md:flex-row md:items-center">
                            {portfolios.length > 0 && <PieChart data={pieData} />}
                            <div>
                                <div className="text-2xl font-bold mt-8 mb-3">Filtered Funds</div>
                                <ListOfFunds cash={cash} portfolios={portfolios} rowData={rowData} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div >
        </SWRConfig>
    )
}

function Stats({ value, costBasis }: { value: number, costBasis: number }) {
    return (
        <div className="card-edge-to-edge px-6 grid grid-cols-1 md:grid-cols-3 gap-y-6 md:gap-y-0">
            <div className="flex flex-col gap-y-1 text-center justify-center">
                <div className="text-sm font-medium">
                    Portfolio
                </div>
                <div className="text-2xl font-bold">{n(value)}</div>
            </div>
            <div className="flex flex-col gap-y-1 text-center justify-center">
                <div className="text-sm font-medium">
                    Invested
                </div>
                <div className="text-2xl font-bold">{n(costBasis)}</div>
            </div>
            <div className="flex flex-col gap-y-1 text-center justify-center">
                <div className="text-sm font-medium">
                    Total Return
                </div>
                <div className={cn('text-2xl font-bold', classByVal(value - costBasis,
                    ['text-red-600', 'text-green-500']))}>{n(value - costBasis, true)}</div>
            </div>
        </div>
    )
}

function ListOfFunds({ cash, portfolios, rowData }: Data) {
    const modal = useAddFundModal();

    return (
        <div className="flex-1">
            <div className="flex flex-row justify-between items-baseline end">
                <div className="sm:hidden">Cash: 💰 <strong>{n(cash)}</strong></div>
                <div className="hidden sm:block">You have 💰 <strong>{n(cash)}</strong> in cash</div>
                <Button onClick={modal.open}>Create Fund</Button>
            </div>
            <Table className="mt-4">
                <Header>
                    <Row>
                        <Cell className="!text-left">Fund</Cell>
                        <Cell>Market Value</Cell>
                        <Cell>Invested</Cell>
                        <Cell>
                            Unrealized
                            <br />
                            Profit/Loss
                        </Cell>
                        <Cell>
                            Realized
                            <br />
                            Profit/Loss
                        </Cell>
                        <Cell>Holdings</Cell>
                        <Cell>Dividends<br />Earned</Cell>
                    </Row>
                </Header>
                <Body>
                    {portfolios.map((portfolio, i) => (
                        <Row key={i}>
                            <Cell className="!text-left">
                                <Link
                                    className="underline font-bold"
                                    href={`/fund/${portfolio.id}`}
                                >
                                    {portfolio.title}
                                </Link>
                            </Cell>
                            <Cell>{n(rowData[portfolio.id].marketValue)}</Cell>
                            <Cell>{n(rowData[portfolio.id].costBasis)}</Cell>
                            <Cell
                                className={classByVal(rowData[portfolio.id].unrealizedProfitLoss,
                                    ['text-red-600', 'text-green-500'])}
                            >
                                {n(rowData[portfolio.id].unrealizedProfitLoss, true)}
                            </Cell>
                            <Cell className={classByVal(rowData[portfolio.id].realizedProfitLoss,
                                ['text-red-600', 'text-green-500'])}>
                                {n(rowData[portfolio.id].realizedProfitLoss, true)}
                            </Cell>
                            <Cell>{rowData[portfolio.id].holdings}</Cell>
                            <Cell>{n(rowData[portfolio.id].dividends, true)}</Cell>
                        </Row>
                    ))}
                </Body>
            </Table>
        </div>
    );
}

function PortfolioChart() {
    const [data, setData] = React.useState<any>([]);
    const [loading, setLoading] = React.useState(true);

    const CHART_OPTIONS = {
        series: [
            {
                name: "Portfolio",
                color: "#526078",
                type: "line",
                threshold: null,
                lineWidth: 2,
                symbol: 'circle',
            },
            {
                name: "Invested",
                color: "#F87171",
                type: "line",
                threshold: null,
                lineWidth: 2,
                symbol: 'circle',
            },
        ],
    };

    React.useEffect(() => {
        getChartData().then(setData).finally(() => setLoading(false))
    }, [])

    return (
        <div className="relative pad">
            <Loading show={loading} message="Loading chart" />
            <Chart data={data} options={CHART_OPTIONS} />
        </div>
    )
}