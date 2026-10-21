import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

// Owner sockets pass their token and land in their restaurant's room; customer sockets pass none
// and join menu/order rooms explicitly (see server/src/sockets).
export function connectSocket(token) {
  return io(SOCKET_URL, {
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling']
  });
}
