import Redis from "ioredis";
import { env } from "./env.js";

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null; // stop retrying after 5 attempts
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true, // don't connect until first command or explicit .connect()
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

export default redis;
