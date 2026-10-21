const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const config = require('./config');
const connectDB = require('./config/db');
const createApp = require('./app');
const registerSocketHandlers = require('./sockets');
const { setIo } = require('./sockets/io');
const { scheduleUploadCleanup } = require('./services/uploadCleanup');
const log = require('./utils/logger');

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

/**
 * Graceful shutdown for SIGTERM (Render and most hosts send it before stopping an instance) and SIGINT:
 * stop accepting connections, let in-flight requests finish, close sockets and the database, then exit.
 * Exits with 1 if that takes longer than `timeoutMs`.
 */
function createShutdown({ io, stopCleanup = () => {}, exit = process.exit, timeoutMs = 10000 }) {
  let shuttingDown = null;
  return (signal) => {
    if (shuttingDown) return shuttingDown;
    log.info('Shutting down', { signal });
    setTimeout(() => {
      log.error('Shutdown timed out, exiting', { timeoutMs });
      exit(1);
    }, timeoutMs).unref();
    stopCleanup();
    // io.close() also closes the HTTP server and calls back once open requests have finished.
    shuttingDown = new Promise((resolve) => io.close(() => resolve()))
      .then(() => mongoose.disconnect())
      .then(() => exit(0))
      .catch((err) => {
        log.error('Error during shutdown', { err });
        exit(1);
      });
    return shuttingDown;
  };
}

async function start() {
  try {
    await connectDB();
  } catch (err) {
    log.error('Could not connect to MongoDB', { err });
    process.exit(1);
  }

  const { server, io } = createServer();
  server.listen(config.port, () => {
    log.info('Server is running', { port: config.port, env: config.env, storage: config.storage.driver });
    log.info('CORS enabled', { origins: config.allowedOrigins.join(', ') || '(none)' });
  });
  const stopCleanup = config.uploadCleanup ? scheduleUploadCleanup() : undefined;

  const shutdown = createShutdown({ io, stopCleanup });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', { err: reason instanceof Error ? reason : new Error(String(reason)) });
  });
  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { err });
    process.exit(1);
  });

  return server;
}

module.exports = { createServer, createShutdown, start };
