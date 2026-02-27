import { INestApplication } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Минимальный Socket.IO адаптер без зависимости от @nestjs/platform-socket.io
 * Решает проблему дублирования rxjs в монорепо
 */
export function attachSocketIo(app: INestApplication, port: number) {
  const httpServer = app.getHttpServer();
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.WS_CORS_ORIGIN || '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });
  return io;
}
