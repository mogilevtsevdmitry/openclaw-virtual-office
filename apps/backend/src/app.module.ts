import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { LoggerModule } from './logging/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AuthModule } from './modules/auth/auth.module';
import { AgentsModule } from './modules/agents/agents.module';
import { OfficeModule } from './modules/office/office.module';
import { PresenceModule } from './modules/presence/presence.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { AuditModule } from './modules/audit/audit.module';
import { OpenClawModule } from './modules/openclaw/openclaw.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventsModule } from './modules/events/events.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { RequestContextMiddleware } from './logging/request-context.middleware';
import { JwtAuthGuard } from './modules/auth/infrastructure/jwt-auth.guard';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting (global default: 100 req / 60s per IP)
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,   // 60 seconds window
        limit: 100,    // max 100 requests per IP per window (default)
      },
    ]),

    // Event Emitter (для domain events)
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 30,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    // Infrastructure
    LoggerModule,
    PrismaModule,

    // Feature modules
    HealthModule,
    RealtimeModule,

    // Domain modules
    AuthModule,       // JWT auth, users
    OfficeModule,     // Floors, zones, desks
    AgentsModule,     // Agent lifecycle + policy → office
    PresenceModule,   // Presence state machine
    CommunicationModule, // Chat rooms + messages
    AuditModule,      // Audit log + cleanup cron
    OpenClawModule,   // OpenClaw system agents roster
    TasksModule,      // Task management
    PipelineModule,   // Pipeline BC: projects, runs, stages, artifacts
    DashboardModule,  // Dashboard KPI aggregations
    EventsModule,     // Activity log: /events, /audit
    PoliciesModule,   // Policy CRUD: /policies
  ],
  providers: [
    // Global rate limiting guard (ThrottlerGuard applies globally)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global JWT guard (bypass with @Public() decorator)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
