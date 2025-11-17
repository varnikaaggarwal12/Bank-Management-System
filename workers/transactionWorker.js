const Redis = require("ioredis");
require("dotenv").config();

const { QUEUE_NAME } = require("../services/messageQueue");
const { pub } = require("../services/pubsub");  // publish after processing

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const worker = new Redis(redisUrl);

console.log("🚀 Worker Started — Waiting for Queue Tasks...");

async function startWorker() {
  while (true) {
    try {
      // BLPOP waits for task
      const result = await worker.blpop(QUEUE_NAME, 0);
      const rawMsg = result[1];
      const task = JSON.parse(rawMsg);

      console.log("📤 PROCESSING TASK:", task);

      // After processing → publish using Pub/Sub
      await pub.publish("transactionEvents", JSON.stringify(task));

      console.log("📡 PUBLISHED TO SUBSCRIBERS");
    } catch (error) {
      console.error("❌ Worker Error:", error);
    }
  }
}

startWorker();
