import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

// Owner sockets pass their token and land in their restaurant's room; customer sockets pass none
// and join menu/order rooms explicitly (see server/src/sockets).
export function connectSocket(token) {
  const socket = io(SOCKET_URL, {
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
    autoConnect: false
  });
  // Connect on the next tick: React StrictMode (development) mounts, unmounts and remounts every effect,
  // and closing a socket mid-handshake logs "WebSocket is closed before the connection is established".
  const timer = setTimeout(() => socket.connect(), 0);
  const disconnect = socket.disconnect.bind(socket);
  socket.disconnect = () => {
    clearTimeout(timer);
    return disconnect();
  };
  return socket;
}
