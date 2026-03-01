import { ProjectType } from '@prisma/client';

export interface CustomStageDto {
  /** Имя стадии: IDEA | DISCOVERY | ARCHITECTURE | PLANNING | BUILD | QA | SECURITY_GATE | DEPLOY | PRODUCTION */
  name: string;
  /** Агент-владелец: ba | product | solution | techlead | backend | frontend | qa | security | devops */
  owner: string;
  /** Порядковый номер (если не указан — берётся по индексу) */
  order?: number;
}

export class BootstrapDto {
  /** Идея / описание проекта */
  idea: string;

  /**
   * Тип проекта — используется только для категоризации, НЕ определяет стадии.
   * Всегда передавай WEB_APP если не знаешь что выбрать.
   */
  type: ProjectType;

  /**
   * Список стадий pipeline — формируется динамически под задачу.
   *
   * Доступные стадии и их агенты:
   *   IDEA          → ba          (требования, PRD)
   *   DISCOVERY     → product     (market research, MoSCoW)
   *   ARCHITECTURE  → solution    (ADR, C4, data model)
   *   PLANNING      → techlead    (sprint plan, декомпозиция)
   *   BUILD         → backend     (реализация)
   *   QA            → qa          (тестирование)
   *   SECURITY_GATE → security    (threat model, аудит)
   *   DEPLOY        → devops      (деплой)
   *   PRODUCTION    → devops      (финальная стабилизация)
   *
   * Примеры:
   *   Игра/лендинг:    [IDEA/ba, BUILD/backend, DEPLOY/devops]
   *   Telegram-бот:    [IDEA/ba, BUILD/backend, QA/qa, DEPLOY/devops]
   *   REST API:        [IDEA/ba, ARCHITECTURE/solution, BUILD/backend, QA/qa, SECURITY_GATE/security, DEPLOY/devops]
   *   Полный веб-сервис: все 9 стадий
   *
   * Если не передан — используется шаблон по полю type (обратная совместимость).
   */
  stages?: CustomStageDto[];

  /** AgentId кто запросил (по умолчанию 'main') */
  requestedBy?: string;
}

export interface BootstrapResponseDto {
  projectId: string;
  runId: string;
  type: ProjectType;
  name: string;
  stages: BootstrapStageDto[];
  techLeadBrief: string;
  outboxEventId: string;
}

export interface BootstrapStageDto {
  stageName: string;
  stageOrder: number;
  status: string;
  ownerAgent: string;
}

export interface StageListItemDto {
  stageName: string;
  stageOrder: number;
  status: string;
  ownerAgent: string;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface SystemStatusDto {
  activeProjects: number;
  pendingProjects: number;
  completedToday: number;
  recentRuns: RecentRunDto[];
}

export interface RecentRunDto {
  projectId: string;
  name: string;
  type: string;
  status: string;
  currentStage: string | null;
  progress: string;
}
