import { ProjectType } from '@prisma/client';

export class BootstrapDto {
  /** Идея проекта, например: "Хочу Telegram-бот для напоминаний" */
  idea: string;

  /** Тип проекта: WEB_APP | TELEGRAM_BOT */
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
