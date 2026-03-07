import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggerService, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Winston as global logger
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // WebSocket adapter (Socket.IO)
  // Абсолютный путь — обходит проблему монорепо (CWD != __dirname)
  // Передаём getHttpServer() напрямую, т.к. instanceof NestApplication может не сработать
  // в монорепо из-за разных инстансов @nestjs/core
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { IoAdapter } = require('/root/projects/openclaw-virtual-office/apps/backend/node_modules/@nestjs/platform-socket.io');
  app.useWebSocketAdapter(new IoAdapter(app.getHttpServer()));

  // Security headers (helmet)
  app.use(helmet());

  // Global validation pipe — strips unknown fields, validates all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip unknown properties
      forbidNonWhitelisted: true, // throw 400 if unknown properties passed
      transform: true,           // auto-transform primitives to declared types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Cookie parser for refresh token
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: process.env.WS_CORS_ORIGIN || ['https://72.56.112.248.nip.io', 'http://72.56.112.248', 'http://localhost:8080', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-trace-id'],
    credentials: true,
  });

  // Global prefix for HTTP routes (excluding health)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });

  const port = parseInt(process.env.PORT || '3000', 10);

  await app.listen(port, '0.0.0.0');

  logger.log(
    {
      message: `🚀 OpenClaw Virtual Office Backend started`,
      port,
      env: process.env.NODE_ENV,
      pid: process.pid,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
    'Bootstrap',
  );

  logger.log(
    {
      message: `Health check available at http://localhost:${port}/health`,
      message2: `WebSocket available at ws://localhost:${port}/realtime`,
    },
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
