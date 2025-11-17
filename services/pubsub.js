// services/pubsub.js
const Redis = require('ioredis');
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Redis clients
const pub = new Redis(redisUrl);
const sub = new Redis(redisUrl);
const queue = new Redis(redisUrl);
const dlq = new Redis(redisUrl);

// ----------------------------------------------------------
// CHANNELS (FIXED: Added LOGIN_EVENTS)
// ----------------------------------------------------------
const CHANNELS = {
  TRANSACTION_EVENTS: "transactionEvents",
  ACCOUNT_EVENTS: "accountEvents",
  NOTIFICATION_EVENTS: "notificationEvents",
  LOGIN_EVENTS: "loginEvents"   // ✅ ADDED
};

// ----------------------------------------------------------
// QUEUES
// ----------------------------------------------------------
const QUEUES = {
  SMS_QUEUE: "smsQueue"
};

// ----------------------------------------------------------
const DLQ_SUFFIX = "_dlq";
const MAX_RETRIES = 3;

// ----------------------------------------------------------
// Subscribe to all channels
// ----------------------------------------------------------
Object.values(CHANNELS).forEach(channel => {
  sub.subscribe(channel, err => {
    if (err) return console.error(`❌ Failed to subscribe ${channel}:`, err);
    console.log(`✅ Subscribed to: ${channel}`);
  });
});

// ----------------------------------------------------------
// MESSAGE HANDLERS
// ----------------------------------------------------------
const messageHandlers = {
  [CHANNELS.LOGIN_EVENTS]: (data) => {
    console.log("🔐 Login event received:", data.accountNumber);

    // Example: Emit live login event to UI
    if (global.io && data.accountNumber) {
      global.io.to(`account:${data.accountNumber}`).emit("loginEvent", data);
    }

    // Optional: Send login alert SMS
    enqueueJob(QUEUES.SMS_QUEUE, {
      type: "login_sms",
      accountNumber: data.accountNumber,
      message: "New login detected on your account."
    });
  },

  [CHANNELS.TRANSACTION_EVENTS]: (data) => {
    console.log("📊 Transaction event:", data.type, data.amount);

    if (global.io) {
      if (data.from) global.io.to(`account:${data.from}`).emit("transactionUpdate", data);
      if (data.to) global.io.to(`account:${data.to}`).emit("transactionUpdate", data);
    }

    if (data.type === "transfer" && data.amount > 10000) {
      enqueueJob(QUEUES.SMS_QUEUE, {
        type: "high_value_transfer_sms",
        ...data
      });
    }
  },

  [CHANNELS.ACCOUNT_EVENTS]: (data) => {
    console.log("👤 Account event:", data.type);

    if (data.type === "account_created") {
      enqueueJob(QUEUES.SMS_QUEUE, {
        type: "welcome_sms",
        ...data
      });
    }
  },

  [CHANNELS.NOTIFICATION_EVENTS]: (data) => {
    console.log("🔔 Notification:", data.type);
    if (global.io && data.accountNumber) {
      global.io.to(`account:${data.accountNumber}`).emit("notification", data);
    }
  }
};

// ----------------------------------------------------------
// Subscriber main listener
// ----------------------------------------------------------
sub.on("message", (channel, msg) => {
  try {
    const data = JSON.parse(msg);
    const handler = messageHandlers[channel];
    if (handler) handler(data);
  } catch (err) {
    console.error("❌ Error processing message:", channel, err);
  }
});

// ----------------------------------------------------------
// Queue system
// ----------------------------------------------------------
const enqueueJob = async (queueName, jobData, delay = 0) => {
  try {
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      data: jobData,
      attempts: 0,
      maxRetries: MAX_RETRIES,
      createdAt: new Date().toISOString(),
      processAt: new Date(Date.now() + delay).toISOString()
    };

    if (delay > 0) {
      await queue.zadd(`${queueName}_delayed`, Date.now() + delay, JSON.stringify(job));
    } else {
      await queue.lpush(queueName, JSON.stringify(job));
    }

    console.log(`📤 Added job → ${queueName}:`, job.id);
    return job.id;

  } catch (err) {
    console.error("❌ Error enqueueing job:", err);
  }
};

// Dequeue job
const dequeueJob = async (queueName) => {
  try {
    const jobStr = await queue.brpop(queueName, 1);
    if (jobStr && jobStr[1]) return JSON.parse(jobStr[1]);
    return null;
  } catch (err) {
    console.error("❌ Dequeue error:", err);
    return null;
  }
};

// Process delayed jobs
const processDelayedJobs = async () => {
  const now = Date.now();

  for (const queueName of Object.values(QUEUES)) {
    const jobs = await queue.zrangebyscore(`${queueName}_delayed`, 0, now);

    for (const jobStr of jobs) {
      await queue.lpush(queueName, jobStr);
      await queue.zrem(`${queueName}_delayed`, jobStr);

      const job = JSON.parse(jobStr);
      console.log(`⏰ Moved delayed job → ${queueName}:`, job.id);
    }
  }
};

// Job processors
const jobProcessors = {
  [QUEUES.SMS_QUEUE]: async (job) => {
    console.log("📱 Processing SMS:", job.data.type);

    // Simulated SMS sending
    if (Math.random() > 0.05) {
      console.log("✅ SMS sent:", job.data.type);
      return;
    }

    throw new Error("SMS gateway failed");
  }
};

// Execute job
const processJob = async (queueName, job) => {
  try {
    const processor = jobProcessors[queueName];
    await processor(job);

    console.log(`✅ Job done: ${job.id}`);
  } catch (err) {
    console.error("❌ Job failed:", err.message);

    job.attempts++;

    if (job.attempts >= job.maxRetries) {
      dlq.lpush(`${queueName}${DLQ_SUFFIX}`, JSON.stringify(job));
      console.log("💀 Job moved to DLQ");
    } else {
      const retryDelay = Math.pow(2, job.attempts) * 1000;
      enqueueJob(queueName, job.data, retryDelay);
      console.log(`🔁 Retry in ${retryDelay}ms`);
    }
  }
};

// Worker start
const startQueueWorkers = () => {
  console.log("🏭 Starting SMS Worker...");

  setInterval(processDelayedJobs, 5000);

  const loop = async () => {
    while (true) {
      const job = await dequeueJob(QUEUES.SMS_QUEUE);
      if (job) await processJob(QUEUES.SMS_QUEUE, job);
    }
  };

  loop();
};

// Publish event
const publishToChannel = async (channel, data) => {
  try {
    await pub.publish(channel, JSON.stringify(data));
    console.log(`📡 Published to ${channel}:`, data.type);
  } catch (err) {
    console.error("❌ Publish error:", err);
  }
};

// ----------------------------------------------------------
module.exports = {
  pub,
  sub,
  queue,
  dlq,
  CHANNELS,
  QUEUES,
  enqueueJob,
  publishToChannel,
  startQueueWorkers
};
