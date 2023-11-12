import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components";

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);
import advancedFormat from "dayjs/plugin/advancedFormat";
dayjs.extend(advancedFormat);

import * as React from "react";
import _ from "lodash";
import { ListedAsset } from "@prisma/client";
import { n, q } from "@/helpers";
import { tailwind } from "../index";
import { PositionWithMarketValue } from "@/services/portfolio/types";
import { Font } from "@react-email/font";
import clsx from "clsx";
import { prisma } from "@/initializers/prisma";
import { getPositions } from "@/services/portfolio/playback";
import { addMarketValues } from "@/services/portfolio/value";

type DroppedFundHoldingsProps = {
    portfolioId: string;
    jobName: string;
    removedAssets: ListedAsset[];
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ? process.env.NEXT_PUBLIC_BASE_URL : "";

export const LiquidateDroppedFundHoldings = async ({
    portfolioId,
    jobName,
    removedAssets
}: DroppedFundHoldingsProps) => {
    // Get the portfolio
    const portfolio = (await prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
            user: true,
            fund: true,
            slices: {
                include: {
                    listedAsset: true,
                }
            },
        },
    }))!;

    // Get the positions in the portfolio
    const [_positions] = await getPositions(portfolio.slices, portfolio.user.alpacaToken!);
    const positions = await addMarketValues(_positions);

    // Get the dropped assets
    const listedAssetBySymbol = _.keyBy(removedAssets, "symbol");
    const dropped = positions
        .filter((p) => removedAssets.find((a) => a.symbol == p.symbol))
        .map((p) => ({
            listedAsset: listedAssetBySymbol[p.symbol],
            position: p,
            slice: portfolio.slices.find((s) => s.listedAsset.symbol == p.symbol)!
        }));

    const cancelLink = `${baseUrl}/api/cancel-auto-liquidations?job[]=${jobName}`;

    return (
        <Tailwind config={tailwind}>
            <Html lang="en">
                <Head>
                    <Font
                        fontFamily="Inter"
                        fallbackFontFamily="Helvetica"
                        fontWeight={400}
                        fontStyle="normal"
                    />
                </Head>
                <Preview>Auto-selling {`${dropped.length}`} assets removed from {portfolio.title}</Preview>
                <Body>
                    <Container className="max-w-[640px]">
                        <Img
                            src={`${baseUrl}/amal.png`}
                            width="75"
                            height="25"
                            alt="Amal Invest"
                        />
                        <Heading className="text-slate-700">
                            Notice: Selling {`${dropped.length}`} assets removed from {portfolio.fund.symbol}
                        </Heading>
                        <Section>
                            <Text className="mt-4 text-slate-500">
                                We wanted to let you know that the {portfolio.fund.symbol} fund recently made
                                some changes to its holdings that will affect your "{portfolio.title}" portfolio.
                            </Text>
                            <Text className="mt-4 text-slate-500">
                                These stocks will be <strong>sold automatically within 24 hours</strong>.
                            </Text>
                            <Text className="mt-4 text-slate-500">
                                {portfolio.reinvestOnSell ? "Since you've enabled reinvest-on-sell, we'll automatically invest the proceeds from the sale of these assets in this portfolio." : 'We will not reinvest the proceeds from this sale into your portfolio, since you have not enabled this setting in the portfolio settings menu.'}
                            </Text>
                            <Text className="mt-4 text-slate-500">
                                You'll find the details of the stocks below:
                            </Text>
                        </Section>
                        <Section>
                            <Heading className="text-slate-700">{portfolio.title}</Heading>
                            <Text className="text-slate-500">
                                These {`${dropped.length}`} stocks were removed from {portfolio.fund.symbol} as of {dayjs(portfolio.latestChangeSeen!).format("MMMM Do")}:
                            </Text>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-300">
                                        <th className="py-1 pl-1 text-sm font-bold text-left uppercase text-slate-700">
                                            Stock
                                        </th>
                                        <th className="py-1 text-sm font-bold text-right uppercase text-slate-700">
                                            Quantity
                                        </th>
                                        <th className="py-1 text-sm font-bold text-right uppercase text-slate-700">
                                            Market Value
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dropped.map(
                                        ({ listedAsset, position, slice }, i) => {
                                            const { marketValue, costBasis } =
                                                position as PositionWithMarketValue;

                                            return (
                                                <tr
                                                    key={listedAsset.id}
                                                    className={clsx(
                                                        "my-3 rounded-md",
                                                        i % 2 == 0 ? "bg-white" : "bg-slate-50"
                                                    )}
                                                >
                                                    <td className="pl-0.5 py-1 text-slate-500 text-left">
                                                        <Text className="m-0">
                                                            <StockSymbol index={i}>
                                                                {listedAsset.symbol}
                                                            </StockSymbol>{" "}
                                                            <ShariahStatus>
                                                                {listedAsset.shariahStatus}
                                                            </ShariahStatus>
                                                        </Text>
                                                        <Text className="pl-1 mx-0 mt-1 mb-0">
                                                            {capitalizeWords(listedAsset.name)}
                                                        </Text>
                                                    </td>
                                                    <td className="py-0.5 text-sm text-slate-500 m-0 text-right">
                                                        {q(position.qty)} sh
                                                    </td>
                                                    <td className="pr-0.5 py-1 text-slate-500 m-0 text-lg text-right">
                                                        <Text className="m-0 text-sm">
                                                            {n(marketValue)}
                                                        </Text>
                                                        <Text
                                                            className={clsx(
                                                                "text-xs m-0 pt-0.5",
                                                                marketValue - costBasis > 0
                                                                    ? "text-green-600"
                                                                    : "text-red-600"
                                                            )}
                                                        >
                                                            {n(marketValue - costBasis, true)}
                                                        </Text>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                            <Text className="text-slate-500">
                                These {`${dropped.length}`} trades are worth a total of{" "}
                                <strong>{n(dropped.reduce((acc, { position }) => acc + position.marketValue, 0))}</strong>.
                            </Text>
                            <Hr />
                            <Text className="text-slate-500">
                                If you would prefer to keep your current holdings, and not have them sold as part of the ${portfolio.fund.symbol} changes, {" "}
                                <Link
                                    href={cancelLink}
                                    className="underline"
                                >
                                    click here to cancel
                                </Link>{" "}
                                the trades within the next 24 hours.
                            </Text>
                            <Hr />
                        </Section>
                        <Section>
                            <Text className="mt-4 text-slate-500">
                                Any questions? Just reply to this email.
                            </Text>
                            <Text className="mt-4 text-slate-500">
                                — Sent with ❤️ from Amal Invest
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Html>
        </Tailwind>
    );
};

function ShariahStatus({ children }: { children: string }) {
    switch (children) {
        case "not_covered":
            return (
                <span className="text-xs font-medium text-gray-500 uppercase">
                    ● Not rated
                </span>
            );
        case "non_compliant":
            return (
                <span className="text-xs font-medium uppercase text-red-600/70">
                    ● Non compliant
                </span>
            );
        case "doubtful":
            return (
                <span className="text-xs text-orange-600/text-red-600/70 font-mediumuppercase">
                    ● Doubtful
                </span>
            );
        default:
            return (
                <span className="text-xs text-slate-500/text-red-600/70 font-mediumuppercase">
                    ● {children}
                </span>
            );
    }
}

function StockSymbol({ children, index }: { children: string; index: number }) {
    return (
        <code
            className={clsx(
                index % 2 == 0 ? "bg-slate-100" : "bg-white",
                "text-xs text-slate-700 rounded-md px-2 py-1 min-w-[50px]"
            )}
        >
            {children}
        </code>
    );
}

function capitalizeWords(str: string) {
    return str
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}
