const express = require('express')
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // <-- ADD THIS
const app = require('./app');
const { connectDB } = require('./config/db');
const { sub } = require('./services/pubsub');

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

global.io = io;

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  socket.on('joinAccount', (accountNumber) => {
    if (accountNumber) socket.join(`account:${accountNumber}`);
  });

  socket.on('leaveAccount', (accountNumber) => {
    if (accountNumber) socket.leave(`account:${accountNumber}`);
  });

  socket.on('disconnect', () =>
    console.log('Socket disconnected', socket.id)
  );
});

connectDB().then(() => {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
  );
});
