import { ArtifactType, PipelineStatus, ProjectType, StageStatus } from '@prisma/client';

export interface StageResponseDto {
  stageName: string;
  stageOrder: number;
  status: StageStatus;
  ownerAgent: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface CreateProjectResponseDto {
  projectId: string;
  runId: string;
  type: ProjectType;
  name: string;
  status: PipelineStatus;
  stages: StageResponseDto[];
}

export interface ProjectListItemDto {
  id: string;
  name: string;
  type: ProjectType;
  status: PipelineStatus;
  currentStage: string | null;
  createdAt: Date;
}

export interface ArtifactSummaryDto {
  id: string;
  type: ArtifactType;
  title: string;
  version: number;
  ownerAgent: string;
  stageName: string | null;
  contentHash: string;
  createdAt: Date;
}

export interface ProjectDetailDto {
  id: string;
  name: string;
  type: ProjectType;
  description: string | null;
  status: PipelineStatus;
  createdAt: Date;
  stages: StageResponseDto[];
  artifacts: ArtifactSummaryDto[];
}
