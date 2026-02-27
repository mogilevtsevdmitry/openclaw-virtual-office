import { Module } from '@nestjs/common';
import { OpenClawController } from './openclaw.controller';
import { OpenClawPresenceService } from './openclaw-presence.service';
import { OpenClawActivityScheduler } from './openclaw-activity.scheduler';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [OpenClawController],
  providers: [OpenClawPresenceService, OpenClawActivityScheduler],
  exports: [OpenClawPresenceService],
})
export class OpenClawModule {}
