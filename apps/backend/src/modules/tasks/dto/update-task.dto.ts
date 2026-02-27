import { TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  status?: TaskStatus;
  result?: string;
  sessionKey?: string;
  agentName?: string;
  title?: string;
  description?: string;
}
