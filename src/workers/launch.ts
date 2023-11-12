import { config } from "dotenv";
config();

import { Queues } from "./queues";
import { QueueEvents, Queue, Job } from "bullmq";
import connection from "./connection";
import { runScheduledWorkers } from "./scheduler";
import { prisma } from "@/initializers/prisma";

(async () => {
  require("events").EventEmitter.defaultMaxListeners = 50;
  await launchAllWorkers();
  await monitorWorkers();

  // Don't forget to clean up!
  const cleanup = async (event: any) => {
    for (const queue of Object.values(Queues)) {
      console.log(`👉 Shutting down ${queue}`);
      const worker = require(`./src/${queue}`).default;
      await worker.close();
    }

    // Disconnect DB
    await prisma.$disconnect();

    console.log("Bye bye 👋");
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
})();

// We just run all of the workers on the same machine. When we grow up, we might
// need to start splitting these out on a per-machine basis. We'd just setup
// different node run scripts in `package.json` and run the respective scripts
// on the different machines
async function launchAllWorkers() {
  console.log("🚀 Launching workers");
  for (const queue of Object.values(Queues)) {
    console.log(`👉 Launching ${queue}`);
    const worker = require(`./src/${queue}`).default;
    worker.run();
  }

  console.log("✅ All workers launched");
  console.log("⏰ Setting up scheduled workers");
  await runScheduledWorkers();
  console.log("✅ Scheduled workers setup");
  console.log("Launch nominal.. 🌞 Enjoy your day!");
}

// Listen to events on all queues
async function monitorWorkers() {
  console.log("👀 Monitoring workers");
  for (const queue of Object.values(Queues)) {
    const queueEvents = new QueueEvents(queue, { connection });

    queueEvents.on("failed", async ({ jobId, failedReason }) => {
      console.log("job failed", jobId, failedReason);
      const queueObject = new Queue(queue, { connection });
      const job = await Job.fromId(queueObject, jobId);

      const { id, queueName, data, stacktrace } = job!;
      console.error(id, queueName, data, stacktrace);
    });

    queueEvents.on("active", ({ jobId, prev }) => {
      console.log(`👋 Job ${jobId} now active`);
    });

    queueEvents.on("completed", ({ jobId, returnvalue }) => {
      console.log(`✅ Job ${jobId} completed`);
    });

    queueEvents.on("waiting", ({ jobId }) => {
      console.log(`⌛ Job ${jobId} waiting`);
    });
  }
}
