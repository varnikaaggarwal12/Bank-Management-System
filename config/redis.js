// config/redis.js
const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => console.log('✅ Connected to Redis'));
redis.on('error', (err) => console.error('Redis error', err));

module.exports = redis;
