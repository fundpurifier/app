import { Queues } from "../queues";
import { MetricsTime, Worker } from "bullmq";
import connection from "../connection";

export default new Worker<void, void>(
  Queues.refreshCorporateActions, // REPLACE THIS
  async (job) => {
    // your code here
  },
  {
    connection,
    autorun: false,
    metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
  }
);
