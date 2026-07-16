import http from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { initDatabase } from './database/db.js';
import { registerSocketHandlers } from './sockets/registerSocketHandlers.js';
import { startCleanupJob } from './services/cleanupService.js';

initDatabase();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.CLIENT_URL.split(',').map((value) => value.trim()),
    credentials: true
  }
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

startCleanupJob();

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${env.PORT}`);
});
