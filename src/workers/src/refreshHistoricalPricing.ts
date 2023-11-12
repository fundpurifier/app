import { requireEnv, tradingDaysInPeriod } from "@/helpers";
import { prisma } from "@/initializers/prisma";
import { HistoricalPrice } from "@prisma/client";
import z from "zod";
import _ from "lodash";

import { Queues } from "../queues";
import { MetricsTime, Worker } from "bullmq";
import connection from "../connection";
import dayjs from "dayjs";
import eod from "@/lib/eod";
import { BulkLastDayResponse } from "@/lib/eod/types";

export default new Worker<void, void>(
  Queues.refreshHistoricalPricing,
  async (job) => {
    await seedMissingHistoricalPricingData();
    await refreshHistoricalPricing();
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

export async function refreshHistoricalPricing(date: Date = new Date()) {
  /**
   * Retrieves historical pricing for all assets on the NYSE and NASDAQ
   * exchanges. At the end of each trading day, we retrieve the closing
   * price for all assets on the two exchanges and store them in the
   * database for quick retrieval later. Can be run multiple times per
   * day without issue.
   */
  const exchanges = ["NYSE", "NASDAQ"];

  for (const exchange of exchanges) {
    const prices = await eod.getBulkLastDay(exchange, date);

    for (const batch of _.chunk(prices, 1000)) {
      await prisma.$transaction(
        batch.map((price) =>
          prisma.historicalPrice.upsert({
            where: {
              symbol_date: {
                symbol: price.code,
                date: new Date(price.date),
              },
            },
            create: mapResponseToDb(price),
            update: mapResponseToDb(price),
          })
        )
      );
    }
  }
}

export async function seedMissingHistoricalPricingData() {
  /**
   * Seeds the database with missing historical pricing data
   * from the last synced date till today.
   */
  const lastSyncedDateSetting = await prisma.appSetting.findFirst({
    where: {
      key: "lastHistoricalPriceSynced",
    },
  });

  const today = new Date();
  let lastSyncedDate = lastSyncedDateSetting
    ? new Date(lastSyncedDateSetting.value)
    : dayjs(today).subtract(1, "year").toDate();

  const tradingDays = tradingDaysInPeriod(lastSyncedDate, today);

  for (const day of tradingDays) {
    console.log(`📆 ${day.toISOString().split("T")[0]}`);
    await refreshHistoricalPricing(day);
  }

  // Update or create the "lastHistoricalPriceSynced" date
  await prisma.appSetting.upsert({
    where: {
      key: "lastHistoricalPriceSynced",
    },
    create: {
      key: "lastHistoricalPriceSynced",
      value: today.toISOString(),
    },
    update: {
      value: today.toISOString(),
    },
  });
}

function mapResponseToDb(response: BulkLastDayResponse[0]): HistoricalPrice {
  return {
    symbol: response.code,
    date: new Date(response.date),
    close: response.close,
  };
}