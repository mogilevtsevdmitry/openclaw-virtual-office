import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineOrchestratorService } from './pipeline-orchestrator.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineOrchestratorService],
  exports: [PipelineService, PipelineOrchestratorService],
})
export class PipelineModule {}
