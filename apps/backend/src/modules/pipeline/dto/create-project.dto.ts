import { ProjectType } from '@prisma/client';
import { CustomStageDto } from './bootstrap.dto';

export class CreateProjectDto {
  name: string;
  type: ProjectType;
  description?: string;
  /** Если передан — используется вместо шаблона */
  stages?: CustomStageDto[];
}
