import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ProjectType,
  StageStatus,
  PipelineStatus,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateArtifactDto } from './dto/create-artifact.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import {
  CreateProjectResponseDto,
  ProjectListItemDto,
  ProjectDetailDto,
  ArtifactSummaryDto,
} from './dto/project-response.dto';

// Stage definition from PipelineTemplate.stages JSON array
interface StageDefinition {
  name: string;
  order: number;
  owner: string;
  [key: string]: unknown;
}

const TENANT_ID = 'tenant-smoke';
const CREATED_BY = 'main';

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── POST /api/v1/projects ────────────────────────────────────────
  async createProject(dto: CreateProjectDto): Promise<CreateProjectResponseDto> {
    // 1. Load PipelineTemplate by type
    const template = await this.prisma.pipelineTemplate.findFirst({
      where: { type: dto.type },
    });

    if (!template) {
      throw new NotFoundException(
        `PipelineTemplate for type "${dto.type}" not found`,
      );
    }

    const stages = template.stages as unknown as StageDefinition[];

    if (!Array.isArray(stages)) {
      throw new BadRequestException(
        `Template stages for type "${dto.type}" is not a valid array`,
      );
    }

    const projectId = randomUUID();
    const runId = randomUUID();
    const correlationId = randomUUID();
    const now = new Date();

    // Build all operations for the transaction
    const stageOps: Prisma.PrismaPromise<unknown>[] = stages.map((stage, i) =>
      this.prisma.pipelineStage.create({
        data: {
          id: randomUUID(),
          runId,
          tenantId: TENANT_ID,
          stageName: stage.name,
          stageOrder: stage.order ?? i + 1,
          status: StageStatus.PENDING,
          ownerAgent: stage.owner,
        },
      }),
    );

    await this.prisma.$transaction([
      // 2. Create Project
      this.prisma.project.create({
        data: {
          id: projectId,
          tenantId: TENANT_ID,
          name: dto.name,
          type: dto.type,
          description: dto.description,
          status: PipelineStatus.PENDING,
          createdBy: CREATED_BY,
        },
      }),
      // 3. Create PipelineRun
      this.prisma.pipelineRun.create({
        data: {
          id: runId,
          projectId,
          tenantId: TENANT_ID,
          template: dto.type,
          status: PipelineStatus.PENDING,
          triggeredBy: CREATED_BY,
          correlationId,
        },
      }),
      // 4. Create all PipelineStages
      ...stageOps,
      // 5. Outbox event
      this.prisma.outbox.create({
        data: {
          id: randomUUID(),
          eventId: randomUUID(),
          eventType: 'project.Project.Created',
          aggregateId: projectId,
          tenantId: TENANT_ID,
          payload: {
            projectId,
            runId,
            type: dto.type,
            name: dto.name,
          },
          processed: false,
          createdAt: now,
        },
      }),
    ]);

    // 6. Return response
    return {
      projectId,
      runId,
      type: dto.type,
      name: dto.name,
      status: PipelineStatus.PENDING,
      stages: stages.map((stage, i) => ({
        stageName: stage.name,
        stageOrder: stage.order ?? i + 1,
        status: StageStatus.PENDING,
        ownerAgent: stage.owner,
      })),
    };
  }

  // ─── GET /api/v1/projects ─────────────────────────────────────────
  async listProjects(): Promise<ProjectListItemDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        createdAt: true,
        runs: {
          select: {
            currentStage: true,
          },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      currentStage: p.runs[0]?.currentStage ?? null,
      createdAt: p.createdAt,
    }));
  }

  // ─── GET /api/v1/projects/:id ─────────────────────────────────────
  async getProject(id: string): Promise<ProjectDetailDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId: TENANT_ID },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            stages: {
              orderBy: { stageOrder: 'asc' },
            },
          },
        },
        artifacts: {
          where: { isSuperseded: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project "${id}" not found`);
    }

    const latestRun = project.runs[0];
    const stageList = latestRun?.stages ?? [];

    const artifactList: ArtifactSummaryDto[] = project.artifacts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      version: a.version,
      ownerAgent: a.ownerAgent,
      stageName: a.stageName,
      contentHash: a.contentHash,
      createdAt: a.createdAt,
    }));

    return {
      id: project.id,
      name: project.name,
      type: project.type,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      stages: stageList.map((s) => ({
        stageName: s.stageName,
        stageOrder: s.stageOrder,
        status: s.status,
        ownerAgent: s.ownerAgent,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      artifacts: artifactList,
    };
  }

  // ─── PATCH /api/v1/projects/:runId/stages/:stageName ─────────────
  async updateStage(runId: string, stageName: string, dto: UpdateStageDto) {
    const stage = await this.prisma.pipelineStage.findUnique({
      where: { runId_stageName: { runId, stageName } },
    });

    if (!stage) {
      throw new NotFoundException(
        `Stage "${stageName}" not found for run "${runId}"`,
      );
    }

    const now = new Date();
    const updateData: Prisma.PipelineStageUpdateInput = { status: dto.status };

    if (dto.status === StageStatus.ACTIVE) {
      updateData.startedAt = now;
    } else if (
      dto.status === StageStatus.COMPLETED ||
      dto.status === StageStatus.FAILED ||
      dto.status === StageStatus.APPROVED ||
      dto.status === StageStatus.REJECTED
    ) {
      updateData.completedAt = now;
    }

    const [updatedStage] = await this.prisma.$transaction([
      this.prisma.pipelineStage.update({
        where: { runId_stageName: { runId, stageName } },
        data: updateData,
      }),
      this.prisma.outbox.create({
        data: {
          id: randomUUID(),
          eventId: randomUUID(),
          eventType: 'project.PipelineRun.StageTransitioned',
          aggregateId: runId,
          tenantId: TENANT_ID,
          payload: {
            runId,
            stageName,
            fromStatus: stage.status,
            toStatus: dto.status,
            transitionedAt: now.toISOString(),
          },
          processed: false,
          createdAt: now,
        },
      }),
    ]);

    return {
      stageName: updatedStage.stageName,
      stageOrder: updatedStage.stageOrder,
      status: updatedStage.status,
      ownerAgent: updatedStage.ownerAgent,
      startedAt: updatedStage.startedAt,
      completedAt: updatedStage.completedAt,
    };
  }

  // ─── POST /api/v1/projects/:projectId/artifacts ───────────────────
  async createArtifact(projectId: string, dto: CreateArtifactDto): Promise<ArtifactSummaryDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId: TENANT_ID },
    });

    if (!project) {
      throw new NotFoundException(`Project "${projectId}" not found`);
    }

    // Content hash: SHA-256 of JSON.stringify(content)
    const contentHash = createHash('sha256')
      .update(JSON.stringify(dto.content))
      .digest('hex');

    // Find existing active artifact of same type+projectId
    const existing = await this.prisma.artifact.findFirst({
      where: {
        projectId,
        type: dto.type,
        isSuperseded: false,
      },
      orderBy: { version: 'desc' },
    });

    const newVersion = existing ? existing.version + 1 : 1;
    const newArtifactId = randomUUID();
    const now = new Date();

    if (existing) {
      // Supersede old + create new + outbox (all in one transaction)
      const [, newArtifact] = await this.prisma.$transaction([
        this.prisma.artifact.update({
          where: { id: existing.id },
          data: {
            isSuperseded: true,
            supersededBy: newArtifactId,
          },
        }),
        this.prisma.artifact.create({
          data: {
            id: newArtifactId,
            tenantId: TENANT_ID,
            projectId,
            stageName: dto.stageName,
            type: dto.type,
            title: dto.title,
            version: newVersion,
            contentHash,
            content: dto.content as Prisma.InputJsonValue,
            ownerAgent: dto.ownerAgent,
            isSuperseded: false,
            createdAt: now,
          },
        }),
        this.prisma.outbox.create({
          data: {
            id: randomUUID(),
            eventId: randomUUID(),
            eventType: 'artifact.Artifact.Created',
            aggregateId: newArtifactId,
            tenantId: TENANT_ID,
            payload: {
              artifactId: newArtifactId,
              projectId,
              type: dto.type,
              title: dto.title,
              version: newVersion,
              contentHash,
              ownerAgent: dto.ownerAgent,
            },
            processed: false,
            createdAt: now,
          },
        }),
      ]);

      return {
        id: newArtifact.id,
        type: newArtifact.type,
        title: newArtifact.title,
        version: newArtifact.version,
        ownerAgent: newArtifact.ownerAgent,
        stageName: newArtifact.stageName,
        contentHash: newArtifact.contentHash,
        createdAt: newArtifact.createdAt,
      };
    } else {
      // First artifact — create + outbox
      const [newArtifact] = await this.prisma.$transaction([
        this.prisma.artifact.create({
          data: {
            id: newArtifactId,
            tenantId: TENANT_ID,
            projectId,
            stageName: dto.stageName,
            type: dto.type,
            title: dto.title,
            version: newVersion,
            contentHash,
            content: dto.content as Prisma.InputJsonValue,
            ownerAgent: dto.ownerAgent,
            isSuperseded: false,
            createdAt: now,
          },
        }),
        this.prisma.outbox.create({
          data: {
            id: randomUUID(),
            eventId: randomUUID(),
            eventType: 'artifact.Artifact.Created',
            aggregateId: newArtifactId,
            tenantId: TENANT_ID,
            payload: {
              artifactId: newArtifactId,
              projectId,
              type: dto.type,
              title: dto.title,
              version: newVersion,
              contentHash,
              ownerAgent: dto.ownerAgent,
            },
            processed: false,
            createdAt: now,
          },
        }),
      ]);

      return {
        id: newArtifact.id,
        type: newArtifact.type,
        title: newArtifact.title,
        version: newArtifact.version,
        ownerAgent: newArtifact.ownerAgent,
        stageName: newArtifact.stageName,
        contentHash: newArtifact.contentHash,
        createdAt: newArtifact.createdAt,
      };
    }
  }
}
