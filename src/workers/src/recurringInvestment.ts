import { Queues } from "../queues";
import { Job, MetricsTime, Queue, Worker } from "bullmq";
import connection from "../connection";

type JobInput = {
    portfolioId: string;
    amount: number;
};

export default new Worker<JobInput, void>(
    Queues.recurringInvestment,
    async (job) => {
        const { portfolioId, amount } = job.data;

        // Queue a job to execute the orders
        const queue = new Queue(Queues.executePortfolioOrders, { connection });
        await queue.add(
            "executePortfolioOrders",
            { portfolioId, amount, isLiquidation: false, trigger: 'recurring-buy' }
        );
    },
    {
        connection,
        autorun: false,
        metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
    }
);