// index.js
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');

const { connectDB } = require('./config/db');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const { startQueueWorkers, getQueueStats } = require('./services/pubsub'); // ensure pub/sub instantiated

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/queues', require('./routes/queueRoutes'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

// expose globally for pubsub to emit
global.io = io;

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  // join account room if client provides accountNumber after connecting
  socket.on('joinAccount', (accountNumber) => {
    if (accountNumber) socket.join(`account:${accountNumber}`);
  });

  socket.on('leaveAccount', (accountNumber) => {
    if (accountNumber) socket.leave(`account:${accountNumber}`);
  });

  socket.on('disconnect', () => console.log('Socket disconnected', socket.id));
  
  // Handle queue stats request
  socket.on('getQueueStats', async () => {
    try {
      const stats = await getQueueStats();
      socket.emit('queueStats', stats);
    } catch (err) {
      socket.emit('error', { message: 'Failed to get queue stats' });
    }
  });
});

// Connect DB then start
connectDB().then(() => {
  const PORT = process.env.PORT || 3000;
  
  // Start queue workers
  startQueueWorkers();
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Queue workers started and monitoring`);
  });
}).catch(err => console.error(err));
