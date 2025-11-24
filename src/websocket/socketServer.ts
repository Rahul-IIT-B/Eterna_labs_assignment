import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import aggregator from '../services/tokenAggregator';
import logger from '../utils/logger';

export const initSocketServer = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    logger.info({ id: socket.id }, 'Client connected');
    socket.emit('initial_snapshot', aggregator.getSnapshot());
  });

  aggregator.on('snapshot', (tokens) => {
    io.emit('token_update', tokens);
  });

  return io;
};
