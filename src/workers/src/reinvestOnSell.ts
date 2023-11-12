import { Queues } from "../queues";
import { MetricsTime, Queue, Worker } from "bullmq";
import connection from "../connection";
import Alpaca from "@/lib/brokers/alpaca";
import { prisma } from "@/initializers/prisma";
import { CLOSED_ORDER_STATES } from "@/lib/brokers/alpaca/types";
import Big from "big.js";

const MARKET_OPEN_DELAY = 1000 * 60 * 15; // 15 minutes

type JobData = {
    portfolioId: string;
    orderIds: string[];
}

export default new Worker<JobData, void>(
    Queues.reinvestOnSell,
    async (job) => {
        const { portfolioId, orderIds } = job.data;

        // Get the orders
        const accessToken = await findAccessTokenByPortfolioId(portfolioId);
        const alpaca = new Alpaca(accessToken, false);
        const orders = await Promise.all(orderIds.map(id => alpaca.getOrder(id)));
        const closedOrders = orders.filter(order => CLOSED_ORDER_STATES.includes(order.status));

        // Calculate the total filled amount
        const totalFilledAmount = closedOrders.reduce((sum, order) => sum.add(order.filled_qty * order.filled_avg_price), Big(0));
        if (totalFilledAmount.lte(0)) return;

        // Queue the portfolio investment job
        const queue = new Queue(Queues.executePortfolioOrders, { connection });
        await queue.add(
            Queues.executePortfolioOrders,
            { portfolioId, amount: +totalFilledAmount, isLiquidation: false, trigger: 'reinvest-on-sell' }
        );
    },
    {
        connection,
        autorun: false,
        metrics: { maxDataPoints: MetricsTime.TWO_WEEKS },
    }
);

export async function queueReinvestmentJob(jobData: JobData) {
    const accessToken = await findAccessTokenByPortfolioId(jobData.portfolioId);
    const alpaca = new Alpaca(accessToken, false);
    const clock = await alpaca.getClock();
    let delay = 0;

    if (!clock.is_open) {
        delay = clock.next_open.getTime() - Date.now() + MARKET_OPEN_DELAY;
    }

    const queue = new Queue(Queues.reinvestOnSell, { connection });
    await queue.add(Queues.reinvestOnSell, jobData, { delay });
}

async function findAccessTokenByPortfolioId(portfolioId: string) {
    const portfolio = await prisma.portfolio.findFirstOrThrow({
        where: {
            id: portfolioId,
            deleted: false,
        },
        select: {
            user: {
                select: {
                    alpacaToken: true,
                }
            }
        }
    });

    if (!portfolio.user.alpacaToken) throw new Error("User does not have an Alpaca token");

    return portfolio.user.alpacaToken
}