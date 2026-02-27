import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
