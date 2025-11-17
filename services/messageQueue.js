const Redis = require("ioredis");
require("dotenv").config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Redis client for queue
const queue = new Redis(redisUrl);

const QUEUE_NAME = "transactionQueue";

// Push event into queue
async function enqueueTransaction(task) {
  await queue.rpush(QUEUE_NAME, JSON.stringify(task));
  console.log("📥 QUEUED TASK:", task);
}

module.exports = { enqueueTransaction, QUEUE_NAME };
