import { Queue } from "bullmq";
import connection from "@/workers/connection";

export async function getRepeatableJob(queue: Queue, jobName: string) {
  const jobs = await queue.getRepeatableJobs();
  return jobs.find((j) => j.key.startsWith(jobName));
}

export async function getDelayedJob(queue: Queue, jobName: string) {
  const jobs = await queue.getDelayed();
  return jobs.find((job) => job.name.startsWith(jobName));
}

export async function triggerWorker(
  worker: string,
  jobName: string = "manual",
  data: any = {}
) {
  const queue = new Queue(worker, { connection });
  const job = await queue.add(jobName, data);
  return job;
}
