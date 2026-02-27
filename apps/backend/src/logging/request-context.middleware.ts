import { Injectable, NestMiddleware, Inject, LoggerService } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const traceId = (req.headers['x-trace-id'] as string) || uuidv4();

    // Attach to request for downstream use
    (req as any).requestId = requestId;
    (req as any).traceId = traceId;

    // Set response headers
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-trace-id', traceId);

    this.logger.log(
      {
        message: `${req.method} ${req.path}`,
        requestId,
        traceId,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
      'HTTP Request',
    );

    next();
  }
}
