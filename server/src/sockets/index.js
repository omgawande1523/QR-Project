const Order = require('../models/Order');
const { rooms } = require('./io');
const safeEqual = require('../utils/safeEqual');
const { verifySessionToken } = require('../services/auth');
const log = require('../utils/logger');

const OBJECT_ID = /^[a-f\d]{24}$/i;

// Sockets that present a JWT are restaurant dashboards; sockets without one are customers.
function authenticate(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  verifySessionToken(token)
    .then(({ userId }) => {
      socket.data.userId = userId;
      next();
    })
    .catch(() => next(new Error('unauthorized')));
}

function reply(ack, body) {
  if (typeof ack === 'function') ack(body);
}

function registerSocketHandlers(io) {
  io.use(authenticate);

  io.on('connection', (socket) => {
    if (socket.data.userId) {
      socket.join(rooms.restaurant(socket.data.userId));
    }

    // Public: live availability updates for one restaurant's menu.
    socket.on('joinMenu', (restaurantId, ack) => {
      if (typeof restaurantId !== 'string' || !OBJECT_ID.test(restaurantId)) {
        return reply(ack, { ok: false, message: 'Invalid restaurant' });
      }
      socket.join(rooms.menu(restaurantId));
      reply(ack, { ok: true });
    });

    // Customers follow only their own order, proven by the tracking token from order creation.
    socket.on('trackOrder', async (payload, ack) => {
      const { orderId, token } = payload || {};
      if (typeof orderId !== 'string' || !OBJECT_ID.test(orderId) || typeof token !== 'string') {
        return reply(ack, { ok: false, message: 'Invalid order' });
      }
      try {
        const order = await Order.findById(orderId).select('+trackingToken');
        if (!order || !order.trackingToken || !safeEqual(order.trackingToken, token)) {
          return reply(ack, { ok: false, message: 'Order not found' });
        }
        socket.join(rooms.order(orderId));
        reply(ack, { ok: true });
      } catch (err) {
        log.error('trackOrder failed', { err });
        reply(ack, { ok: false, message: 'Could not track order' });
      }
    });
  });
}

module.exports = registerSocketHandlers;
