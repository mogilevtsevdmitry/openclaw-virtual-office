import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PipelineOrchestratorService } from './pipeline-orchestrator.service';
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
import {
  BootstrapDto,
  BootstrapResponseDto,
  StageListItemDto,
  SystemStatusDto,
} from './dto/bootstrap.dto';

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
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: PipelineOrchestratorService,
  ) {}

  // ─── POST /api/v1/projects ────────────────────────────────────────
  async createProject(dto: CreateProjectDto): Promise<CreateProjectResponseDto> {
    // 1. Resolve stages: from dto.stages (dynamic) or from template (fallback)
    let stages: StageDefinition[];

    if (dto.stages && dto.stages.length > 0) {
      // Dynamic pipeline — stages defined by caller (BA / bootstrap)
      stages = dto.stages.map((s, i) => ({
        name: s.name,
        order: s.order ?? i + 1,
        owner: s.owner,
        outputs: [],
      }));
    } else {
      // Fallback: load template by type
      const template = await this.prisma.pipelineTemplate.findFirst({
        where: { type: dto.type },
      });

      if (!template) {
        throw new NotFoundException(
          `PipelineTemplate for type "${dto.type}" not found. Either pass explicit stages[] or use a known type.`,
        );
      }

      stages = template.stages as unknown as StageDefinition[];

      if (!Array.isArray(stages)) {
        throw new BadRequestException(
          `Template stages for type "${dto.type}" is not a valid array`,
        );
      }
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

    const stageUpdate = this.prisma.pipelineStage.update({
      where: { runId_stageName: { runId, stageName } },
      data: updateData,
    });

    const outboxWrite = this.prisma.outbox.create({
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
    });

    // Update currentStage on run when a stage becomes ACTIVE
    if (dto.status === StageStatus.ACTIVE) {
      const [updatedStage] = await this.prisma.$transaction([
        stageUpdate,
        outboxWrite,
        this.prisma.pipelineRun.update({
          where: { id: runId },
          data: { currentStage: stageName, status: PipelineStatus.RUNNING },
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

    const [updatedStage] = await this.prisma.$transaction([stageUpdate, outboxWrite]);

    // Auto-complete run if all stages are done; otherwise advance to next stage
    if (
      dto.status === StageStatus.COMPLETED ||
      dto.status === StageStatus.APPROVED ||
      dto.status === StageStatus.SKIPPED
    ) {
      const allStages = await this.prisma.pipelineStage.findMany({
        where: { runId },
        select: { status: true },
      });
      const terminalStatuses = [
        StageStatus.COMPLETED,
        StageStatus.APPROVED,
        StageStatus.SKIPPED,
      ];
      const allDone = allStages.every((s) =>
        terminalStatuses.includes(s.status as (typeof terminalStatuses)[number]),
      );
      if (allDone) {
        await this.prisma.pipelineRun.update({
          where: { id: runId },
          data: { status: PipelineStatus.COMPLETED, completedAt: now },
        });
      } else {
        // 🚀 Event-driven: advance pipeline immediately — no cron wait
        this.orchestrator.advanceAfterComplete(runId, stageName);
      }
    }

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

  // ─── POST /api/v1/bootstrap ───────────────────────────────────────
  async bootstrap(dto: BootstrapDto): Promise<BootstrapResponseDto> {
    const requestedBy = dto.requestedBy ?? 'main';

    this.logger.log(`Bootstrap: type=${dto.type}, custom_stages=${dto.stages?.length ?? 'none (using template)'}`);

    // 1. Определить название проекта из идеи (первые 60 символов)
    const name = dto.idea.slice(0, 60).trim();

    // 2. Создать project + run + stages через createProject
    // Если переданы явные стадии — используем их, иначе шаблон по type
    const projectData = await this.createProject({
      name,
      type: dto.type,
      description: dto.idea,
      stages: dto.stages,
    });

    const { projectId, runId, stages } = projectData;

    // 3. Определить первую стадию
    // TELEGRAM_BOT → первая стадия IDEA, WEB_APP → DISCOVERY
    // Но берём из реального списка стадий (первая по порядку)
    const firstStage = stages.sort((a, b) => a.stageOrder - b.stageOrder)[0];
    if (!firstStage) {
      throw new BadRequestException('No stages found in pipeline template');
    }

    const now = new Date();

    // 4. Активировать первую стадию
    await this.prisma.$transaction([
      this.prisma.pipelineStage.update({
        where: { runId_stageName: { runId, stageName: firstStage.stageName } },
        data: {
          status: StageStatus.ACTIVE,
          startedAt: now,
        },
      }),
      this.prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status: PipelineStatus.RUNNING,
          currentStage: firstStage.stageName,
          startedAt: now,
        },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: { status: PipelineStatus.RUNNING },
      }),
    ]);

    // 5. Записать в outbox событие 'project.Pipeline.Bootstrapped'
    const outboxEventId = randomUUID();
    await this.prisma.outbox.create({
      data: {
        id: randomUUID(),
        eventId: outboxEventId,
        eventType: 'project.Pipeline.Bootstrapped',
        aggregateId: projectId,
        tenantId: TENANT_ID,
        payload: {
          projectId,
          runId,
          type: dto.type,
          idea: dto.idea,
          firstStage: firstStage.stageName,
          ownerAgent: firstStage.ownerAgent,
          requestedBy,
        },
        processed: false,
        createdAt: now,
      },
    });

    // 6. Обновить статус первой стадии в ответе
    const updatedStages = stages.map((s) =>
      s.stageName === firstStage.stageName
        ? { ...s, status: StageStatus.ACTIVE }
        : s,
    );

    // 7. Сгенерировать techLeadBrief
    const techLeadBrief = this.generateTechLeadBrief({
      idea: dto.idea,
      type: dto.type,
      projectId,
      runId,
      stageName: firstStage.stageName,
      ownerAgent: firstStage.ownerAgent,
    });

    return {
      projectId,
      runId,
      type: dto.type,
      name,
      stages: updatedStages,
      techLeadBrief,
      outboxEventId,
    };
  }

  /** Генерирует текстовый бриф для Tech Lead */
  private generateTechLeadBrief(params: {
    idea: string;
    type: ProjectType;
    projectId: string;
    runId: string;
    stageName: string;
    ownerAgent: string;
  }): string {
    const { idea, type, projectId, runId, stageName, ownerAgent } = params;
    return [
      '=== НОВЫЙ ПРОЕКТ ЗАПУЩЕН ===',
      `Идея: ${idea}`,
      `Тип: ${type}`,
      `Project ID: ${projectId}`,
      `Run ID: ${runId}`,
      '',
      `Первая стадия: ${stageName} → агент: ${ownerAgent}`,
      'Статус: ACTIVE',
      '',
      'Твои действия:',
      `1. Проверь стадии: GET /api/v1/projects/${projectId}`,
      `2. Запусти BA через openclaw sessions: отправь агенту 'ba' сообщение:`,
      `   "Новый проект! Идея: ${idea}. Project ID: ${projectId}. Run ID: ${runId}. Начни диалог с Дмитрием — задай уточняющие вопросы. НЕ пиши PRD пока он не скажет 'можно'."`,
      `3. Отслеживай прогресс через GET /api/v1/projects/${runId}/stages`,
      '4. Gate check перед каждым переходом стадии',
      '',
      '=== КОНЕЦ БРИФА ===',
    ].join('\n');
  }

  // ─── GET /api/v1/projects/:runId/stages ──────────────────────────
  async getStages(runId: string): Promise<StageListItemDto[]> {
    const run = await this.prisma.pipelineRun.findFirst({
      where: { id: runId, tenantId: TENANT_ID },
    });

    if (!run) {
      throw new NotFoundException(`PipelineRun "${runId}" not found`);
    }

    const stages = await this.prisma.pipelineStage.findMany({
      where: { runId, tenantId: TENANT_ID },
      orderBy: { stageOrder: 'asc' },
    });

    return stages.map((s) => ({
      stageName: s.stageName,
      stageOrder: s.stageOrder,
      status: s.status,
      ownerAgent: s.ownerAgent,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    }));
  }

  // ─── GET /api/v1/pipeline/status ─────────────────────────────────
  async getSystemStatus(): Promise<SystemStatusDto> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [activeCount, pendingCount, completedTodayCount, recentRuns] =
      await Promise.all([
        // Active projects
        this.prisma.project.count({
          where: { tenantId: TENANT_ID, status: PipelineStatus.RUNNING },
        }),
        // Pending projects
        this.prisma.project.count({
          where: { tenantId: TENANT_ID, status: PipelineStatus.PENDING },
        }),
        // Completed today
        this.prisma.project.count({
          where: {
            tenantId: TENANT_ID,
            status: PipelineStatus.COMPLETED,
            updatedAt: { gte: startOfDay },
          },
        }),
        // Recent runs (last 10) — include full stage list for live status
        this.prisma.project.findMany({
          where: { tenantId: TENANT_ID },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            runs: {
              orderBy: { startedAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                stages: {
                  orderBy: { stageOrder: 'asc' },
                  select: {
                    stageName: true,
                    status: true,
                    ownerAgent: true,
                    stageOrder: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const terminalStageStatuses: string[] = [
      StageStatus.COMPLETED,
      StageStatus.APPROVED,
      StageStatus.SKIPPED,
    ];

    const recentRunDtos = recentRuns.map((p) => {
      const latestRun = p.runs[0];
      const totalStages = latestRun?.stages.length ?? 0;
      const completedStages =
        latestRun?.stages.filter((s) =>
          terminalStageStatuses.includes(s.status),
        ).length ?? 0;

      // Determine current active stage (first ACTIVE, else first PENDING)
      const activeStage = latestRun?.stages.find((s) => s.status === StageStatus.ACTIVE);
      const pendingStage = latestRun?.stages.find(
        (s) => s.status === StageStatus.PENDING,
      );
      const currentStage = activeStage?.stageName ?? pendingStage?.stageName ?? null;

      // Use run status as project status for accuracy
      const effectiveStatus = latestRun?.status ?? p.status;

      return {
        projectId: p.id,
        runId: latestRun?.id ?? null,
        name: p.name,
        type: p.type,
        status: effectiveStatus,
        currentStage,
        progress: `${completedStages}/${totalStages}`,
        stages: latestRun?.stages.map((s) => ({
          stageName: s.stageName,
          status: s.status,
          ownerAgent: s.ownerAgent,
        })) ?? [],
      };
    });

    return {
      activeProjects: activeCount,
      pendingProjects: pendingCount,
      completedToday: completedTodayCount,
      recentRuns: recentRunDtos,
    };
  }
}
