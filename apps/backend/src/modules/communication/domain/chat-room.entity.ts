import { DomainException } from '../../../../../../libs/shared-kernel/src/domain/domain.exception';

export interface ChatRoomParticipant {
  agentId: string;
  joinedAt: string;
}

export class ChatRoom {
  readonly id: string;
  readonly tenantId: string;
  name: string;
  readonly zoneId: string | null;
  participants: ChatRoomParticipant[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    tenantId: string;
    name: string;
    zoneId?: string | null;
    participants?: ChatRoomParticipant[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    if (!params.name || params.name.trim().length === 0) {
      throw new DomainException('Chat room name cannot be empty', 'CHATROOM_NAME_EMPTY');
    }
    this.id = params.id;
    this.tenantId = params.tenantId;
    this.name = params.name.trim();
    this.zoneId = params.zoneId ?? null;
    this.participants = params.participants ?? [];
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
  }

  addParticipant(agentId: string): void {
    const exists = this.participants.some((p) => p.agentId === agentId);
    if (!exists) {
      this.participants.push({ agentId, joinedAt: new Date().toISOString() });
    }
  }
}
