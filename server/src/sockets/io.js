const log = require('../utils/logger');
// Holds the Socket.io server so controllers can emit without importing the HTTP layer.
// All emits happen here, from the server, after a database write; clients never relay events.
let io = null;

const rooms = {
  restaurant: (id) => `restaurant:${id}`, // authenticated dashboard sockets of one owner
  menu: (id) => `menu:${id}`, // public menu viewers (availability and price changes)
  order: (id) => `order:${id}`, // one customer's order, joined with its tracking token
  session: (id) => `session:${id}` // the dashboard sockets of one signed-in device
};

function setIo(instance) {
  io = instance;
}

function getIo() {
  return io;
}

function emitTo(room, event, payload) {
  if (!io) return;
  try {
    io.to(room).emit(event, payload);
  } catch (err) {
    log.error('Socket emit failed', { err });
  }
}

module.exports = {
  setIo,
  getIo,
  rooms,
  toRestaurant: (id, event, payload) => emitTo(rooms.restaurant(id), event, payload),
  toMenu: (id, event, payload) => emitTo(rooms.menu(id), event, payload),
  toOrder: (id, event, payload) => emitTo(rooms.order(id), event, payload),
  // A signed-out device stops receiving live orders at once, not just at its next reconnect.
  disconnectSession: (id) => {
    if (io) io.in(rooms.session(id)).disconnectSockets(true);
  }
};
