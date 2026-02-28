import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TasksService } from './tasks.service';

// Runs cleanup every 30 minutes:
// - RUNNING tasks with no sessionKey → DONE
// - RUNNING tasks not updated for >2h → DONE
@Injectable()
export class TasksCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(TasksCleanupScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly tasksService: TasksService) {}

  onModuleInit() {
    // Run once on startup
    this.runCleanup();
    // Then every 30 minutes
    this.intervalId = setInterval(() => this.runCleanup(), 30 * 60 * 1000);
  }

  private async runCleanup() {
    try {
      const count = await this.tasksService.cleanupStaleTasks();
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} stale RUNNING task(s)`);
      }
    } catch (err) {
      this.logger.error('Task cleanup failed', err);
    }
  }
}
