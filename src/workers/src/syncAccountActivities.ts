/**
 * There are certain account activities that we need to track in order
 * to support certain features. These are:
 *
 * 1. Deposits/Withdrawals on the account level, in order to track the
 *    cost basis of the account over time (and chart it).
 * 2. Dividends received, in order to support DRIP (in the future)
 *
 * Since these events only happen once a day, we just sync them over at
 * the start of the day.
 */

import { Queues } from "../queues";
import { MetricsTime, Worker } from "bullmq";
import connection from "../connection";
import Alpaca from "@/lib/brokers/alpaca";
import { getActiveUsers } from "./helpers/db";
import { User } from "@prisma/client";
import { prisma } from "@/initializers/prisma";

const DIVIDEND_ACTIVITIES = [
  "DIV",
  "DIVCGL",
  "DIVCGS",
  "DIVFEE",
  "DIVFT",
  "DIVNRA",
  "DIVROC",
  "DIVTW",
  "DIVTXEX",
];

export default new Worker<void, void>(
  Queues.syncAccountActivities,
  async (job) => {
    const users = await getActiveUsers();
    for (const [i, user] of users.entries()) {
      await job.updateProgress(100 * i / users.length);
      await syncAccountActivities(user);
    }
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);

export async function syncAccountActivities(user: User) {
  // Find last synced activity date
  const EARLIEST_DATE = "2018-01-01";
  const lastActivity = await prisma.accountActivity.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      date: "desc",
    },
  });
  const after = lastActivity?.date
    ? new Date(lastActivity?.date).toISOString()
    : new Date(EARLIEST_DATE).toISOString();

  // Fetch more recent activities from Alpaca
  // TODO: Support pagination
  const alpaca = new Alpaca(user.alpacaToken!, false);
  let activities;

  try {
    activities = await alpaca.getAccountActivites({
      activity_types: ["TRANS", "ACATC", "CSD", "CSW"],
      after,
      direction: "asc",
    });
  } catch (err: any) {
    console.error(
      `Unable to fetch account activities for ${user.id}: ${err.message}`
    );
    return;
  }

  if (activities.length == 0) return;

  // Store in the database
  const results = await prisma.$transaction(
    activities.map((activity: any) => {
      const data = {
        id: activity.id,
        amount: activity.net_amount,
        userId: user.id,
        date: activity.date,
        raw: JSON.stringify(activity),
      };

      return prisma.accountActivity.upsert({
        where: { id: activity.id },
        update: data,
        create: data,
      });
    })
  );

  console.log(
    `🔄 ${results.length} activities for ${user.id} after ${after.split("T")[0]
    }`
  );
}
