import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const logFormat = process.env.LOG_FORMAT === 'json'
  ? combine(
      timestamp(),
      errors({ stack: true }),
      json(),
    )
  : combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      printf(({ level, message, timestamp, requestId, traceId, commandId, eventId, ...meta }) => {
        let log = `${timestamp} [${level}] ${message}`;
        if (requestId) log += ` | requestId=${requestId}`;
        if (traceId) log += ` | traceId=${traceId}`;
        if (commandId) log += ` | commandId=${commandId}`;
        if (eventId) log += ` | eventId=${eventId}`;
        if (Object.keys(meta).length > 0 && meta.stack === undefined) {
          log += ` | ${JSON.stringify(meta)}`;
        }
        return log;
      }),
    );

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        new winston.transports.Console(),
      ],
      defaultMeta: {
        service: process.env.APP_NAME || 'openclaw-virtual-office',
        env: process.env.NODE_ENV || 'development',
      },
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
