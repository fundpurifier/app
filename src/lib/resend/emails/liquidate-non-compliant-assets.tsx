import {
  Body,
  Button,
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
import { Liquidation } from "@/services/fund/refresh";
import _ from "lodash";
import { Portfolio } from "@prisma/client";
import { n, q } from "@/helpers";
import { tailwind } from "../index";
import Big from "big.js";
import { PositionWithMarketValue } from "@/services/portfolio/types";
import { Font } from "@react-email/font";
import clsx from "clsx";
import { Trigger } from "@/services/fund/refresh";

type NonCompliantProps = {
  liquidations: Liquidation[];
  jobNamesByPortfolioId: Record<string, string>;
  trigger: Trigger;
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ? process.env.NEXT_PUBLIC_BASE_URL : "";

export const LiquidateNonCompliantAssets = ({
  liquidations,
  jobNamesByPortfolioId,
  trigger
}: NonCompliantProps) => {
  // Get the portfolios
  const portfolios: Portfolio[] = [];
  liquidations.forEach((l) => {
    if (!portfolios.find((p) => p.id === l.portfolio.id)) {
      portfolios.push(l.portfolio);
    }
  });

  // Assemble liquidations by portfolio
  const liquidationsByPortfolioId = _.groupBy(
    liquidations,
    (l) => l.portfolio.id
  );
  // Sort liquidations by position.marketValue
  Object.keys(liquidationsByPortfolioId).forEach((portfolioId) => {
    liquidationsByPortfolioId[portfolioId].sort(
      (a, b) =>
        ((b.position as PositionWithMarketValue)?.marketValue ?? 0) -
        ((a.position as PositionWithMarketValue)?.marketValue ?? 0)
    );
  });

  // Find stats
  const symbols = _.uniqBy(liquidations, (l) => l.listedAsset.symbol);
  const total = +liquidations.reduce(
    (sum, liquidation) =>
      sum.add((liquidation.position as PositionWithMarketValue)?.marketValue ?? 0),
    Big(0)
  );

  const cancelAllLink = `${baseUrl}/api/cancel-auto-liquidations?job[]=${Object.values(jobNamesByPortfolioId).join("&job[]=")}`;

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
        <Preview>Auto-selling non-compliant assets for {n(total)}</Preview>
        <Body>
          <Container className="max-w-[640px]">
            <Img
              src={`${baseUrl}/amal.png`}
              width="75"
              height="25"
              alt="Fund Purifier"
            />
            <Heading className="text-slate-700">
              Notice: Selling non-compliant assets for {n(total)}
            </Heading>
            <Section>
              <Text className="mt-4 text-slate-500">
                {
                  trigger === 'fund-settings-change' && `You recently changed your fund settings, triggering a re-evaluation of your portfolio. As a result, ${symbols.length} stocks no longer meet your updated filtering settings.`
                }
                {
                  trigger === 'shariah-compliance-update' && `We just run a Shariah status check and found that ${symbols.length} stocks no longer meet your filtering settings.`
                }
                {
                  trigger === 'user-settings-change' && `You recently updated your whitelist/blacklist, triggering a re-evaluation of your portfolio. We found ${symbols.length} stocks no longer meet your filtering settings.`
                }
              </Text>
              <Text className="mt-4 text-slate-500">
                These stocks will be <strong>sold automatically within 24 hours</strong>.
              </Text>
              <Text className="mt-4 text-slate-500">
                If you want to cancel these trades, hit the “Cancel all Trades” link
                at the bottom of this email.
              </Text>
              <Text className="mt-4 text-slate-500">
                We've included the details of the stocks below, broken down by the
                portfolios they belong to.
              </Text>
            </Section>
            {portfolios.map((portfolio) => (
              <Section key={portfolio.id}>
                <Heading className="text-slate-700">{portfolio.title}</Heading>
                <Text className="text-slate-500">
                  There {liquidationsByPortfolioId[portfolio.id].length > 1 ? "are" : "is"} {liquidationsByPortfolioId[portfolio.id].length}{" "}
                  non-compliant stock{liquidationsByPortfolioId[portfolio.id].length > 1 ? "s" : ""} in this portfolio, worth a total of{" "}
                  <strong>
                    {n(
                      +liquidationsByPortfolioId[portfolio.id].reduce(
                        (sum, l) =>
                          sum.add(
                            (l.position as PositionWithMarketValue)?.marketValue ?? 0
                          ),
                        Big(0)
                      )
                    )}
                  </strong>
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
                    {liquidationsByPortfolioId[portfolio.id].map(
                      ({ listedAsset, position }, i) => {
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
                  <strong>Note: </strong>To cancel just the{" "}
                  {liquidationsByPortfolioId[portfolio.id].length} trade{liquidationsByPortfolioId[portfolio.id].length > 1 ? "s" : ""} in this portfolio,{" "}
                  <Link
                    href={`${baseUrl}/api/cancel-auto-liquidations?job[]=${jobNamesByPortfolioId[portfolio.id]
                      }`}
                    className="underline"
                  >
                    click here
                  </Link>{" "}
                  within the next 24 hours.
                </Text>
                <Hr />
              </Section>
            ))}
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                pX={20}
                pY={12}
                className="bg-[#d31111] rounded text-white text-[12px] font-semibold no-underline text-center"
                href={cancelAllLink}
              >
                Cancel all Trades
              </Button>
            </Section>
            <Section>
              <Text className="mt-4 text-slate-500">
                If you have any questions, please don't hesitate to reach out to us
                at <Link href="mailto:help@fundpurifier.com">help@fundpurifier.com</Link>, or just
                reply to this email.
              </Text>
              <Text className="mt-4 text-slate-500">
                — With ❤️ from your friendly, neighborhood Fund Purifier
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
