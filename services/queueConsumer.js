const Redis = require("ioredis");
const { QUEUE_NAME } = require("./messageQueue");
require("dotenv").config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const queue = new Redis(redisUrl);

async function startConsumer(io) {
  console.log("🚀 Queue Consumer Started...");

  while (true) {
    try {
      // BLPOP → waits until a message arrives
      const data = await queue.blpop(QUEUE_NAME, 0);

      if (!data) continue;

      const raw = data[1];
      const event = JSON.parse(raw);

      console.log("📤 PROCESSING QUEUE EVENT:", event);

      // --------------------------
      // 🔥 Handle DEPOSIT
      // --------------------------
      if (event.type === "DEPOSIT") {
        io.to(`account:${event.accountNumber}`).emit("transactionEvent", event);
      }

      // --------------------------
      // 🔥 Handle WITHDRAW
      // --------------------------
      else if (event.type === "WITHDRAW") {
        io.to(`account:${event.accountNumber}`).emit("transactionEvent", event);
      }

      // --------------------------
      // 🔥 Handle TRANSFER (Sender + Receiver)
      // --------------------------
      else if (event.type === "TRANSFER") {
        io.to(`account:${event.from}`).emit("transactionEvent", event);
        io.to(`account:${event.to}`).emit("transactionEvent", event);
      }

      // --------------------------
      // 🔥 Handle Account Delete
      // --------------------------
      else if (event.type === "ACCOUNT_DELETED") {
        io.to(`account:${event.accountNumber}`).emit("transactionEvent", event);
      }

    } catch (err) {
      console.error("❌ Queue consumer error:", err);
    }
  }
}

module.exports = startConsumer;