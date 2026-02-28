import { StageStatus } from '@prisma/client';

export class UpdateStageDto {
  status: StageStatus;
}
