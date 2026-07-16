import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '../../../shared/socket-events.js';

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

let socket = null;

export const socketService = {
  connect() {
    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
      return socket;
    }

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      path: '/socket.io'
    });

    return socket;
  },
  getSocket() {
    return socket;
  },
  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },
  events: SOCKET_EVENTS
};
