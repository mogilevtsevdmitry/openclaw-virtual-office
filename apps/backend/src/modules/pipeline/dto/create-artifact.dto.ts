import { ArtifactType } from '@prisma/client';

export class CreateArtifactDto {
  type: ArtifactType;
  title: string;
  content: Record<string, unknown>;
  stageName?: string;
  ownerAgent: string;
}
