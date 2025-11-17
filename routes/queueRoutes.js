// routes/queueRoutes.js
const express = require('express');
const router = express.Router();

const { 
  enqueueJob, 
  publishToChannel,
  CHANNELS,
  QUEUES 
} = require('../services/pubsub');

/**
 * ----------------------------------------------------
 *  TEST: PUBLISH A NOTIFICATION EVENT
 * ----------------------------------------------------
 */
router.post('/test-pubsub', async (req, res) => {
  try {
    await publishToChannel(CHANNELS.NOTIFICATION_EVENTS, {
      type: "test_notification",
      message: "This is a test notification event"
    });

    return res.json({
      status: "success",
      message: "Notification published to SMS queue"
    });

  } catch (err) {
    console.error("Error publishing test message:", err);
    return res.status(500).json({ 
      status: "error",
      message: "Failed to publish test notification"
    });
  }
});


/**
 * ----------------------------------------------------
 *  TEST: ENQUEUE SMS JOB MANUALLY
 * ----------------------------------------------------
 */
router.post('/enqueue-sms', async (req, res) => {
  try {
    const { jobData } = req.body;

    if (!jobData) {
      return res.status(400).json({ message: "jobData is required" });
    }

    const jobId = await enqueueJob(QUEUES.SMS_QUEUE, jobData);

    return res.json({
      status: "success",
      message: "SMS job enqueued",
      jobId
    });

  } catch (err) {
    console.error("Error enqueueing job:", err);
    return res.status(500).json({ 
      status: "error",
      message: "Failed to enqueue SMS job"
    });
  }
});


/**
 * ----------------------------------------------------
 *  QUEUE + CHANNEL CONFIG
 * ----------------------------------------------------
 */
router.get('/config', (req, res) => {
  res.json({
    channels: CHANNELS,
    queues: QUEUES
  });
});


/**
 * ----------------------------------------------------
 *  SIMPLE HEALTH CHECK (NO getQueueStats ANYMORE)
 * ----------------------------------------------------
 */
router.get('/health', async (req, res) => {
  try {
    return res.json({
      status: "healthy",
      queues: Object.keys(QUEUES),
      channels: Object.keys(CHANNELS),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: "unhealthy",
      error: err.message
    });
  }
});

module.exports = router;
