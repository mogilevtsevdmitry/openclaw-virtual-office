import { ProjectType } from '@prisma/client';

export class CreateProjectDto {
  name: string;
  type: ProjectType;
  description?: string;
}
