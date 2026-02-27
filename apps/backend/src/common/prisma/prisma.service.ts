import { Injectable, OnModuleInit, OnModuleDestroy, Inject, LoggerService } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log(
        { message: 'Prisma connected to PostgreSQL', db: process.env.DB_NAME },
        'PrismaService',
      );
    } catch (err) {
      this.logger.error(
        { message: 'Prisma connection failed', error: err.message },
        'PrismaService',
      );
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log({ message: 'Prisma disconnected' }, 'PrismaService');
  }
}
