import { Queues } from "../queues";
import connection from "../connection";
import { MetricsTime, Worker } from "bullmq";
import { prisma } from "@/initializers/prisma";
import finnhub from "@/lib/finnhub";
import _ from "lodash";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);
import { Prisma } from "@prisma/client";
import { refreshSinglePortfolio } from "@/services/fund/refresh";

export default new Worker<void, void>(
  Queues.refreshFundHoldings,
  async (job) => {
    await refreshAllFunds();
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

async function refreshAllFunds() {
  const funds = await prisma.fund.findMany({
    where: {
      Portfolio: {
        some: {
          trackChanges: true,
          deleted: false,
        },
      },
    },
  });

  console.log(`Refreshing ${funds.length} funds`);

  for (const { type, isin } of funds) {
    console.log(`Refreshing ${type} ${isin}`);

    // Process each fund individually
    const [_, holdingsAtDate] = await finnhub.getFundHoldings(
      type == "etf" ? "etf" : "mutual-fund",
      isin
    );

    // Find users tracking this fund
    const portfolios = await getOutdatedPortfoliosTrackingFund(
      isin,
      new Date(holdingsAtDate)
    );
    console.log(
      `Found ${portfolios.length} portfolios updated prior to ${holdingsAtDate}`
    );

    // Update each portfolio
    for (const portfolio of portfolios) {
      refreshSinglePortfolio(portfolio, 'holdings-update', holdingsAtDate);
    }
  }
}

async function getOutdatedPortfoliosTrackingFund(
  isin: string,
  holdingsUpdateDate: Date
) {
  const portfolios = await prisma.portfolio.findMany({
    where: {
      trackChanges: true,
      deleted: false,
      fundIsin: isin,
      OR: [
        {
          latestChangeSeen: {
            lt: holdingsUpdateDate,
          },
        },
        {
          latestChangeSeen: null,
        },
      ],
    },
    include: {
      slices: true,
      fund: true,
      user: {
        include: {
          blacklist: true,
          whitelist: true,
        },
      },
    },
  });

  // Only return portfolios belonging to active users
  return portfolios.filter((portfolio) => portfolio.user.isActive);
}

const portfolioWithSlicesFundAndUserWhitelistBlacklist = Prisma.validator<Prisma.PortfolioArgs>()({
  include: {
    slices: true,
    fund: true,
    user: {
      include: {
        whitelist: true,
        blacklist: true,
      },
    },
  },
});
type PortfolioWithSlicesFundAndUserWhitelistBlacklist = Prisma.PortfolioGetPayload<
  typeof portfolioWithSlicesFundAndUserWhitelistBlacklist
>;
