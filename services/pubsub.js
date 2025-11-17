// services/pubsub.js
const Redis = require('ioredis');
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const pub = new Redis(redisUrl);
const sub = new Redis(redisUrl);

sub.subscribe('transactionEvents', (err) => {
  if (err) return console.error('Failed to subscribe:', err);
  console.log('Subscribed to transactionEvents channel');
});

sub.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    if (global.io) {
      if (data.accountNumber) {
        global.io.to(`account:${data.accountNumber}`).emit('transactionUpdate', data);
      }
      //global.io.emit('transactionEvent', data);
    }
  } catch (err) {
    console.error('Invalid pubsub message', err);
  }
});

module.exports = { pub, sub };
