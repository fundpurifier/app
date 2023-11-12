import { Queue } from "bullmq"
import connection from "./connection"
import { Queues } from "./queues"

export const DEFAULT_TIMEZONE = "America/New_York"

/**
 * A list of all of the queues that run on a schedule. Cron expressions use the
 * EST timezone.
 *
 * Daily processes are detailed here in the Alpaca docs:
 * https://alpaca.markets/docs/broker/integration/daily-processes/
 */
export const RepeatableQueues = {
  // Before open
  [Queues.refreshCorporateActions]: { pattern: "30 7 * * *" },
  [Queues.refreshListedAssets]: { pattern: "00 8 * * *" },
  [Queues.syncAccountActivities]: { pattern: "30 8 * * 1-5" },

  // During the day
  [Queues.refreshFundHoldings]: { pattern: "0 12 * * 1-5" }, // after [refreshListedAssets]

  // After close
  [Queues.refreshHistoricalPricing]: { pattern: "15 17 * * 1-5" },
  [Queues.syncAccountActivities]: { pattern: "45 19 * * 1-5" },

  // Weekly
  [Queues.refreshFundList]: { pattern: "0 0 * * 0" },

  // Bimonthly, https://www.investopedia.com/ask/answers/08/earnings-season.asp
  [Queues.refreshShariahStatus]: { pattern: "0 0 15,28 * *" },
}

// This is triggered when the app is started;  workers continue to run even
// if the app goes down. It doesn't duplicate jobs when started again because
// it treats the queue/repeat combination as unique. When it encounters the same
// options with an existing set already running, BullMQ just ignores them..
export const runScheduledWorkers = async () => {
  for (const queueName of Object.keys(
    RepeatableQueues
  ) as (keyof typeof RepeatableQueues)[]) {
    const queue = new Queue(queueName, { connection })
    await queue.add(
      "scheduled",
      {},
      {
        attempts: 1,
        repeat: {
          ...RepeatableQueues[queueName],
          tz: DEFAULT_TIMEZONE,
        },
      }
    )
  }
}
