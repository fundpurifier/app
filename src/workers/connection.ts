import { requireEnv } from "@/helpers";
import IORedis from "ioredis";

// If you want to reuse connections (due to some host limitation) take a look at
// https://docs.bullmq.io/bull/patterns/reusing-redis-connections
const connection = new IORedis(requireEnv("REDIS_URL"), {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export default connection;
