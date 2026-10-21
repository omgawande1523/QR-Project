const http = require('http');
const socketIo = require('socket.io');
const config = require('./config');
const connectDB = require('./config/db');
const createApp = require('./app');
const registerSocketHandlers = require('./sockets');
const { setIo } = require('./sockets/io');

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

function start() {
  const { server } = createServer();

  connectDB();

  server.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
    console.log(`CORS enabled for: ${config.allowedOrigins.join(', ')}`);
  });

  return server;
}

module.exports = { createServer, start };
