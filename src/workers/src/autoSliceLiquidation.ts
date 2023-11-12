import { MetricsTime, Queue, Worker } from "bullmq";
import { Queues } from "../queues";
import connection from "../connection";
import { prisma } from "@/initializers/prisma";
import _ from "lodash";
import crypto from "crypto";
import { LiquidationActionDetails } from "@/models/actionLog";
import { getPositionsBulk } from "@/services/portfolio/playback";
import { generateId } from "@/helpers";
import Alpaca from "@/lib/brokers/alpaca";
import { createSlicesForPositions } from "@/services/portfolio/order";
import { queueReinvestmentJob } from "./reinvestOnSell";

const DELAY_PERIOD = 1000 * 60 * 60 * 24; // 24 hours

type JobInput = {
  userId: string;
  symbols: string[];
  portfolioIds: string[];
  reason: 'removed-from-fund' | 'non-compliant'
};

/**
 * Automatically liquidates slices, typically with a pre-determined delay
 */
export default new Worker<JobInput, any>(
  Queues.autoSliceLiquidation,
  async (job) => {
    const input = job.data;
    const allOrders = await autoLiquidateSlices(input); // same order as portfolioIds
    const portfolios = await prisma.portfolio.findMany({
      where: {
        id: {
          in: input.portfolioIds,
        },
      }
    });
    const portfolio = _.keyBy(portfolios, 'id');

    // Reinvest, if enabled
    for (let i = 0; i < input.portfolioIds.length; i++) {
      const portfolioId = input.portfolioIds[i];
      const orderIds = allOrders[i].map(o => o.id);

      if (portfolio[portfolioId].reinvestOnSell && portfolio[portfolioId].fundIsin !== "MIGRATED") {
        await queueReinvestmentJob({ portfolioId, orderIds });
      }
    }
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

/**
 * This is the ONLY function we should use to queue a slice liquidation job
 * (so that we can derive a unique, deterministic job name)
 */
export async function queueSliceLiquidation(
  input: JobInput,
  delay = DELAY_PERIOD
) {
  const jobName = deriveJobName(input);
  const queue = new Queue(Queues.autoSliceLiquidation, { connection });

  // Check for existing delayed jobs with the same name
  const delayedJobs = await queue.getJobs(['delayed']);
  const existingJob = delayedJobs.find(job => job.name === jobName);

  if (existingJob) {
    console.warn(`A delayed job with the name ${jobName} already exists.`);

    // Remove the existing delayed job, since it's getting replaced
    await existingJob.remove();
    console.log(`Removed the existing delayed job with the name ${jobName}.`);
  }

  // Add it otherwise
  await queue.add(jobName, input, { delay });
  return jobName;
}

export async function autoLiquidateSlices({
  userId,
  portfolioIds,
  symbols,
  reason,
}: JobInput) {
  /**
   * Liquidates all positions for a given user and set of symbols
   * (typically used to liquidate a set of symbols from a portfolio).
   * We require [portfolioIds] so that we limit symbol liqudiations to the
   * amounts in the specific portfolios (e.g when updating fund holdings)
   */
  const portfolios = await prisma.portfolio.findMany({
    where: {
      userId,
      id: {
        in: portfolioIds,
      },
      deleted: false,
    },
    include: {
      slices: {
        include: {
          listedAsset: true,
        },
      },
    },
  });

  // Get positions
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { alpacaToken: true },
  });
  const allPositions = await getPositionsBulk(portfolios, user!.alpacaToken!);
  const alpaca = new Alpaca(user!.alpacaToken!, false);

  // Liquidate each portfolio in turn
  const orders = await Promise.all(
    portfolios.map(async (portfolio, i) => {
      // Find qty of each target symbol in this portfolio
      const positions = allPositions[i][0]
        .filter((p) => symbols.includes(p.symbol))
        .filter((p) => p.qty > 0);
      if (!positions.length) return [];

      // Create slices for positions that don't have them
      const noSlices = positions.filter(
        (p) => !portfolio.slices.find((s) => s.listedAsset.symbol === p.symbol)
      );
      if (noSlices.length) {
        // Means that we earned a stock that has turned non-compliant through a
        // a corporate action and we need to liquidate it because it's turned
        // non-compliant. We create slices so we can track orders made against it
        const created = await createSlicesForPositions(noSlices, portfolio.id);
        portfolio.slices.push(...created);
      }

      // Submit liquidation orders
      const orders = await Promise.all(
        positions.map(async (position) => {
          const slice = portfolio.slices.find(
            (s) => s.listedAsset.symbol === position.symbol
          )!;

          const order = await alpaca.createOrder({
            symbol: position.symbol,
            qty: +position.qty,
            side: "sell",
            type: "market",
            time_in_force: "day",
            client_order_id: `${slice.id}|${generateId("")}`,
          });

          return order.raw();
        })
      );

      // Save to action log
      const details: LiquidationActionDetails = {
        reason,
      };
      await prisma.actionLog.create({
        data: {
          portfolioId: portfolio.id,
          action: "liquidation",
          isAutomated: true,
          details: JSON.stringify(details),
          ActionOrder: {
            create: orders.map((order) => ({
              id: order.id,
              portfolioSliceId: order.client_order_id.split("|")[0],
              raw: JSON.stringify(order),
            })),
          },
        },
      });

      return orders;
    })
  );

  return orders; // indexed by [portfolioIds]
}

/**
 * We need to derive a unique, deterministic job name that we can later use to
 * cancel the job (if the user chooses to do so)
 */
function deriveJobName(input: JobInput) {
  const message =
    input.portfolioIds.sort().join("") + input.symbols.sort().join("");
  const hash = crypto.createHash("md5").update(message).digest("hex");

  return `${input.userId}-${input.reason}-${hash}`;
}

