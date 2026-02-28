import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksCleanupScheduler } from './tasks-cleanup.scheduler';

@Module({
  controllers: [TasksController],
  providers: [TasksService, TasksCleanupScheduler],
  exports: [TasksService],
})
export class TasksModule {}
