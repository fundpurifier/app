'use client';

import React from "react";
import { clamp, n, p } from "@/helpers";
import _ from "lodash";
import Big from "big.js";
import { Table, Header, Row, Cell, Body } from "@/components/Table";
import clsx from "clsx";
import Expandable from "@/components/Expandable";
import { PositionSliceWithMarketValue, mergePositionsAndSlices } from "@/services/portfolio/order";
import { PositionWithMarketValue } from "@/services/portfolio/types";
import { Input } from "@/components/ui/input"
import { XCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface Props {
    allPositionsAndSlices: Awaited<ReturnType<typeof mergePositionsAndSlices<PositionWithMarketValue>>>;
    total: number
}

export default function ({ allPositionsAndSlices, total }: Props) {
    const [search, setSearch] = React.useState("");
    const [results, setResults] = React.useState(allPositionsAndSlices);

    React.useEffect(() => {
        setResults(allPositionsAndSlices.filter(positionAndSlice => {
            const { position, listedAsset } = positionAndSlice;
            const symbol = position ? position.symbol : listedAsset.symbol;
            const name = listedAsset.name;

            // Make search case insensitive
            return symbol.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase());
        }))
    }, [search])

    return (
        <>
            <div className="md:flex md:flex-row md:justify-end relative">
                <Input
                    type="text"
                    placeholder="Search by symbol, name"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                {search && (
                    <button className="absolute right-2 top-2" onClick={() => setSearch('')}>
                        <XCircle strokeWidth={1.5} />
                    </button>
                )}
            </div>

            <Expandable className="card-edge-to-edge" message={`Click to show all ${results.length} rows`} enabled={search.length == 0 && results.length > 0}>
                <Table>
                    <Header>
                        <Row>
                            <Cell> </Cell>
                            <Cell className="!text-left">Stock</Cell>
                            <Cell className="whitespace-nowrap !text-center">Shariah</Cell>
                            <Cell className="whitespace-nowrap">Target %</Cell>
                            <Cell className="whitespace-nowrap">Actual %</Cell>
                            <Cell>Drift</Cell>
                            <Cell>Value ($)</Cell>
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
                        </Row>
                    </Header>
                    <Body>
                        {results.length > 0 &&
                            results.map((positionAndSlice, i) =>
                                <HoldingsRow key={i} positionSlice={positionAndSlice} total={total} />)
                        }
                        {results.length === 0 && (
                            <tr><td colSpan={8} className="text-center pt-6 pb-2 text-muted-foreground">There are no holdings that pass your filters</td></tr>
                        )}
                    </Body>
                </Table>
            </Expandable>
        </>
    );
}

function HoldingsRow({ positionSlice, total }: { positionSlice: PositionSliceWithMarketValue, total: number }) {
    const { slice, position, listedAsset } = positionSlice;

    // Position-specific
    let actualPc = 0, marketValue = 0, unrealizedPnl = 0, realizedPnl = 0;
    if (position) {
        actualPc = total > 0 ? clamp(+Big(position.marketValue).div(total).mul(100), 0, 100) : 0
        marketValue = +position.marketValue
        unrealizedPnl = +position.unrealizedPnl
        realizedPnl = +position.realizedPnl
    }

    // Slice-specific
    let slicePc = 0, driftPc = 0, driftLabel = '';
    if (slice) {
        slicePc = slice.percent;
        driftPc = actualPc - slicePc;
        driftLabel = (driftPc * 100).toFixed(2) === "0.00" ? `-` : p(driftPc, true)
    }

    return (
        <Row>
            <Cell className="!text-center">
                <code className="bg-slate-100 text-slate-700 rounded-md px-2 py-1">
                    {position ? position.symbol : listedAsset.symbol}
                </code>
            </Cell>
            <Cell className="!text-left max-w-[12rem] sm:max-w-none overflow-ellipsis overflow-clip">
                {listedAsset.name}
            </Cell>
            <Cell className="!text-center">
                {listedAsset.shariahStatus === 'compliant' && <Badge className="bg-green-50 text-green-700">Compliant</Badge>}
                {listedAsset.shariahStatus === 'non_compliant' && <Badge className="bg-red-100 text-red-800">Non-compliant</Badge>}
                {listedAsset.shariahStatus === 'doubtful' && <Badge className="bg-orange-100 text-orange-800">Doubtful</Badge>}
                {listedAsset.shariahStatus === 'unrated' && <Badge className="bg-gray-100 text-gray-800">Unrated</Badge>}
            </Cell>
            <Cell className="text-right">{p(slicePc)}</Cell>
            <Cell className="text-right">{p(actualPc)}</Cell>
            <Cell
                className={clsx(
                    "text-right",
                    Math.abs(driftPc) < 1 ? "text-slate-300" : "text-slate-500"
                )}
            >
                {driftLabel}
            </Cell>
            <Cell className="text-right">{n(marketValue)}</Cell>
            <Cell
                className={clsx(
                    "text-right",
                    getClassName(
                        unrealizedPnl,
                        ["text-red-700", "text-slate-300", "text-green-600"],
                        0.01
                    )
                )}
            >
                {n(unrealizedPnl, true)}
            </Cell>
            <Cell
                className={clsx(
                    "text-right",
                    getClassName(
                        realizedPnl,
                        ["text-red-700", "text-slate-300", "text-green-600"],
                        0.01
                    )
                )}
            >
                {n(realizedPnl, true)}
            </Cell>
        </Row>
    );
}

function getClassName(
    value: number,
    classNames: [string, string, string],
    threshold: number = 0
): string {
    if (value < -threshold) return classNames[0];
    if (value > threshold) return classNames[2];
    return classNames[1];
}
