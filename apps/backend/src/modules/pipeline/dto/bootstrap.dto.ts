import { ProjectType } from '@prisma/client';

export class BootstrapDto {
  /** Идея проекта, например: "Хочу Telegram-бот для напоминаний" */
  idea: string;

  /**
   * Тип проекта — определяет набор стадий pipeline:
   *
   * WEB_APP      — полный цикл (9 стадий): IDEA→DISCOVERY→ARCHITECTURE→PLANNING→BUILD→QA→SECURITY_GATE→DEPLOY→PRODUCTION
   *                Когда: сложный веб-сервис с бэкендом, фронтендом, БД, несколько команд
   *
   * TELEGRAM_BOT — лёгкий бот (5 стадий): IDEA→ARCHITECTURE→BUILD→QA→DEPLOY
   *                Когда: Telegram/Discord/Slack бот
   *
   * LANDING      — статика (4 стадии): IDEA→BUILD→QA→DEPLOY
   *                Когда: игра, лендинг, статический сайт, pure frontend без бэкенда
   *
   * MICRO_SERVICE — API без фронтенда (6 стадий): IDEA→ARCHITECTURE→BUILD→QA→SECURITY_GATE→DEPLOY
   *                Когда: REST/GraphQL API, микросервис, CLI-инструмент
   *
   * CUSTOM       — прототип (3 стадии): IDEA→BUILD→DEPLOY
   *                Когда: быстрый MVP, эксперимент, proof-of-concept
   */
  type: ProjectType;

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
