const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const config = require('./config');
const connectDB = require('./config/db');
const createApp = require('./app');
const registerSocketHandlers = require('./sockets');
const { setIo } = require('./sockets/io');
const { scheduleUploadCleanup } = require('./services/uploadCleanup');

// Builds the HTTP + Socket.io server without connecting to MongoDB or listening (used by tests).
function createServer() {
  const app = createApp();
  const server = http.createServer(app);

  const io = socketIo(server, {
    cors: {
      origin: config.allowedOrigins,
      methods: ['GET', 'POST']
    }
  });
  setIo(io);
  registerSocketHandlers(io);

  return { app, server, io };
}

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error(`Could not connect to MongoDB: ${err.message}`);
    process.exit(1);
  }

  const { server, io } = createServer();
  server.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
    console.log(`CORS enabled for: ${config.allowedOrigins.join(', ') || '(none)'}`);
  });
  if (config.uploadCleanup) scheduleUploadCleanup();

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);
    // Force exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
    io.close();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });

  return server;
}

module.exports = { createServer, start };
