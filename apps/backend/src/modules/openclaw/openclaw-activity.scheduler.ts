import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { OpenClawPresenceService, AgentActivityStatus } from './openclaw-presence.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

const POLL_INTERVAL_MS = 15_000; // check every 15s

// Map openclaw agentId → office role name (for display name matching)
const AGENT_NAME_BY_ID: Record<string, string> = {
  main:     '🖤 Пятница',
  finance:  '💰 Зина',
  backend:  '🏗️ Ваня',
  devops:   '🛠️ Федя',
  frontend: '⚡ Макс',
  ddd:      '🏛️ Архитектор',
};

@Injectable()
export class OpenClawActivityScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenClawActivityScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private lastState: Map<string, string> = new Map(); // agentId → presenceState

  constructor(
    private readonly presenceService: OpenClawPresenceService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    // Run immediately on start
    setTimeout(() => this.tick(), 2000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const activities = this.presenceService.getActivityStatuses();

      for (const activity of activities) {
        const displayName = AGENT_NAME_BY_ID[activity.agentId];
        if (!displayName) continue;

        const prevState = this.lastState.get(activity.agentId);
        const newState = activity.presenceState;

        // Only act if state changed
        if (prevState === newState) continue;
        this.lastState.set(activity.agentId, newState);

        // Find the virtual agent in DB by name
        const dbAgent = await this.prisma.agent.findFirst({
          where: { name: displayName },
        });
        if (!dbAgent) continue;

        // Find or create presence record
        const existingPresence = await this.prisma.presence.findFirst({
          where: { agentId: dbAgent.id },
        });

        const zoneId = existingPresence?.zoneId ?? null;
        const oldState = existingPresence?.state ?? 'IDLE';

        if (oldState === newState) continue;

        // Update presence in DB
        if (existingPresence) {
          await this.prisma.presence.update({
            where: { id: existingPresence.id },
            data: { state: newState },
          });
        }

        // Broadcast WS event to all connected clients
        this.realtimeService.broadcast({
          eventId: `activity-${dbAgent.id}-${Date.now()}`,
          eventType: 'presence.state_changed',
          tenantId: dbAgent.tenantId,
          occurredAt: new Date().toISOString(),
          payload: {
            agentId: dbAgent.id,
            previousState: oldState,
            newState,
            zoneId,
          },
        });

        this.logger.log(`${displayName}: ${oldState} → ${newState}`);
      }
    } catch (err) {
      this.logger.warn('Activity tick error: ' + (err as Error).message);
    }
  }
}
