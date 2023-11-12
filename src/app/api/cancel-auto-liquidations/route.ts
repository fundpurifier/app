import { NextRequest, NextResponse } from "next/server";
import { Queue } from 'bullmq';
import { Queues } from "@/workers/queues";

// Next.js GET method to parse incoming links
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const jobs = searchParams.getAll("job[]");

    // Cancel the jobs in bullmq with the specified jobNames
    const responses = []
    for (const job of jobs) {
        const response = await cancelJob(Queues.autoSliceLiquidation, job);
        responses.push(response);
    }

    return NextResponse.json({ responses });
};

async function cancelJob(queueName: string, jobName: string) {
    const queue = new Queue(queueName);
    const delayedJobs = await queue.getJobs('delayed');
    const job = delayedJobs.find(job => job.name === jobName);

    if (job) {
        await job.remove();
        return { message: `Job ${jobName} cancelled successfully` }
    } else {
        return { error: `Job ${jobName} not found` }
    }
}