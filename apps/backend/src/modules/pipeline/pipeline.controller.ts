import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateArtifactDto } from './dto/create-artifact.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('projects')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  /**
   * POST /api/v1/projects
   * Create a new project and initialize its pipeline run + stages
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProject(@Body() dto: CreateProjectDto) {
    return this.pipelineService.createProject(dto);
  }

  /**
   * GET /api/v1/projects
   * List all projects for tenant-smoke
   */
  @Get()
  async listProjects() {
    return this.pipelineService.listProjects();
  }

  /**
   * GET /api/v1/projects/:id
   * Get project detail with stages and artifacts
   */
  @Get(':id')
  async getProject(@Param('id') id: string) {
    return this.pipelineService.getProject(id);
  }

  /**
   * PATCH /api/v1/projects/:runId/stages/:stageName
   * Transition a pipeline stage to a new status
   */
  @Patch(':runId/stages/:stageName')
  async updateStage(
    @Param('runId') runId: string,
    @Param('stageName') stageName: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.pipelineService.updateStage(runId, stageName, dto);
  }

  /**
   * POST /api/v1/projects/:projectId/artifacts
   * Create a new artifact (with version management)
   */
  @Post(':projectId/artifacts')
  @HttpCode(HttpStatus.CREATED)
  async createArtifact(
    @Param('projectId') projectId: string,
    @Body() dto: CreateArtifactDto,
  ) {
    return this.pipelineService.createArtifact(projectId, dto);
  }
}
