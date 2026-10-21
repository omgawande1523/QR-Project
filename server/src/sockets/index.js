function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('join', (room) => {
      if (room) {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
      }
    });

    socket.on('menuUpdated', (updatedItem) => {
      // Broadcast to all clients in the restaurant's room
      const restaurantId = updatedItem.owner;
      if (restaurantId) {
        io.to(restaurantId.toString()).emit('menuUpdated', updatedItem);
        console.log(`Menu updated for restaurant ${restaurantId}`);
      } else {
        io.emit('menuUpdated', updatedItem);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });
}

module.exports = registerSocketHandlers;
