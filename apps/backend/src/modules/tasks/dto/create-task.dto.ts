import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  title: string;
  description?: string;
  agentId?: string;
  agentName?: string;
  sessionKey?: string;
  status?: TaskStatus;
}
