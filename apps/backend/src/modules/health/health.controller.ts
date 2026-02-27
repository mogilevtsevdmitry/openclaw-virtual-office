import { Controller, Get, Inject, LoggerService } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Find package.json by walking up from __dirname until we find one with a version.
 */
function findBackendVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          name?: string;
          version?: string;
        };
        if (pkg.version) {
          return pkg.version;
        }
      } catch {
        // continue
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.1.0';
}

const BACKEND_VERSION = findBackendVersion();

@Controller()
export class HealthController {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Public()
  @Get('health')
  async getHealth() {
    // DB check
    let dbStatus = 'connected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      dbStatus = 'error';
      this.logger.error(
        { message: 'DB healthcheck failed', error: (err as Error).message },
        'HealthCheck',
      );
    }

    // WS check — try to resolve RealtimeGateway lazily to avoid circular deps
    let wsStatus = 'unknown';
    try {
      const { RealtimeGateway } = await import('../realtime/realtime.gateway');
      const gateway = this.moduleRef.get(RealtimeGateway, { strict: false });
      wsStatus = gateway?.isInitialized() ? 'active' : 'unknown';
    } catch {
      wsStatus = 'unknown';
    }

    const health = {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      db: dbStatus,
      ws: wsStatus,
      uptime: Math.floor(process.uptime()),
      version: BACKEND_VERSION,
    };

    this.logger.log({ message: 'Health check', ...health }, 'HealthCheck');

    return health;
  }
}
