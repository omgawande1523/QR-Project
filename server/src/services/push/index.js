const config = require('../../config');
const Session = require('../../models/Session');
const log = require('../../utils/logger');
const { createFcmSender, loadServiceAccount } = require('./fcmSender');

/*
 * Push notifications to the staff app (Firebase Cloud Messaging). Like socket events, they are sent by the
 * server after the database write, never relayed by clients. Each type goes to the roles that act on it,
 * on a high-priority Android channel of its own (the app creates the channels; ids must match
 * client/src/native/push.js) and only to devices that left that type switched on.
 */
const TYPES = {
  newOrder: { roles: ['owner', 'manager', 'kitchen'], channel: 'new_orders' },
  tableRequest: { roles: ['owner', 'manager', 'waiter'], channel: 'table_requests' },
  orderReady: { roles: ['waiter'], channel: 'order_ready' }
};

const REQUEST_TITLES = { Waiter: 'Waiter called', Bill: 'Bill requested', Water: 'Water requested', Cutlery: 'Cutlery requested' };

const itemsLine = (order) => {
  const line = (order.items || []).map((i) => `${i.quantity}× ${i.menuItemName}`).join(', ');
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
};

// Title, body and data per type. Data values must be strings for FCM.
const BUILDERS = {
  newOrder: (order) => ({
    title: `New order · Table ${order.tableNumber}`,
    body: itemsLine(order),
    tag: `order-${order._id}`,
    data: { type: 'newOrder', orderId: String(order._id), tableNumber: String(order.tableNumber) }
  }),
  orderReady: (order) => ({
    title: `Ready to serve · Table ${order.tableNumber}`,
    body: itemsLine(order),
    tag: `ready-${order._id}`,
    data: { type: 'orderReady', orderId: String(order._id), tableNumber: String(order.tableNumber) }
  }),
  tableRequest: (request) => ({
    title: `${REQUEST_TITLES[request.type] || request.type} · Table ${request.tableNumber}`,
    body: request.customerName && request.customerName !== 'Guest' ? request.customerName : 'Tap to see table requests',
    tag: `request-${request._id}`,
    data: { type: 'tableRequest', requestId: String(request._id), requestType: String(request.type), tableNumber: String(request.tableNumber) }
  })
};

function buildMessage(token, type, entity) {
  const { title, body, tag, data } = BUILDERS[type](entity);
  return {
    token,
    notification: { title, body },
    data,
    android: {
      priority: 'HIGH',
      ttl: '900s', // an order older than 15 minutes is no longer news
      notification: { channel_id: TYPES[type].channel, tag, notification_priority: 'PRIORITY_MAX', visibility: 'PUBLIC' }
    }
  };
}

// Records messages instead of sending them (tests, and servers without Firebase in development).
function createMockSender() {
  const sent = [];
  return {
    name: 'mock',
    sent,
    unregistered: new Set(), // tokens to answer as uninstalled
    async send(message) {
      sent.push(message);
      return this.unregistered.has(message.token) ? { ok: false, unregistered: true, error: 'UNREGISTERED' } : { ok: true };
    }
  };
}

function defaultSender() {
  if (config.env === 'test') return createMockSender();
  const serviceAccount = loadServiceAccount(config.push.serviceAccount);
  return serviceAccount ? createFcmSender(serviceAccount) : null;
}

let sender = defaultSender();
const pending = new Set();

async function fanOut(restaurantId, type, entity) {
  const { roles } = TYPES[type];
  const sessions = await Session.find({
    restaurant: restaurantId,
    role: { $in: roles },
    'push.token': { $exists: true },
    [`push.prefs.${type}`]: { $ne: false },
    expiresAt: { $gt: new Date() }
  }).select('push.token').lean();
  const tokens = [...new Set(sessions.map((s) => s.push.token))];

  const results = await Promise.all(tokens.map(async (token) => {
    try {
      return { token, ...(await sender.send(buildMessage(token, type, entity))) };
    } catch (err) {
      return { token, ok: false, error: err.message };
    }
  }));
  const stale = results.filter((r) => r.unregistered).map((r) => r.token);
  if (stale.length) await Session.updateMany({ 'push.token': { $in: stale } }, { $unset: { 'push.token': 1, 'push.platform': 1 } });
  const failed = results.filter((r) => !r.ok && !r.unregistered);
  if (failed.length) log.warn('Some push notifications failed', { type, failed: failed.length, error: failed[0].error });
  return { sent: results.filter((r) => r.ok).length, removed: stale.length, failed: failed.length };
}

/**
 * Notifies the restaurant's devices about an order or table request. Call it after the database write
 * and do not await it: a slow or failing push never delays or breaks the request that caused it.
 */
function notify(restaurantId, type, entity) {
  if (!sender || !TYPES[type]) return Promise.resolve({ sent: 0, removed: 0, failed: 0 });
  const job = fanOut(String(restaurantId), type, entity).catch((err) => {
    log.error('Push notification failed', { type, err });
    return { sent: 0, removed: 0, failed: 1 };
  });
  pending.add(job);
  job.finally(() => pending.delete(job));
  return job;
}

module.exports = {
  TYPES,
  notify,
  buildMessage,
  createMockSender,
  getSender: () => sender,
  setSender: (next) => { sender = next; },
  // Resolves once every notification started so far has been handled (used by tests).
  idle: () => Promise.all([...pending])
};
