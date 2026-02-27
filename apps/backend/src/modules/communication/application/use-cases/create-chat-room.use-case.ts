import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateChatRoomDto } from '../dto/create-chat-room.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CreateChatRoomUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: CreateChatRoomDto, tenantId: string) {
    const id = uuidv4();
    const participants = (dto.participantAgentIds ?? []).map((agentId) => ({
      agentId,
      joinedAt: new Date().toISOString(),
    }));

    const room = await this.prisma.chatRoom.create({
      data: {
        id,
        tenantId,
        name: dto.name,
        zoneId: dto.zoneId ?? null,
        participants: participants as any,
      },
    });

    this.eventEmitter.emit('chatroom.created', {
      roomId: room.id,
      tenantId,
      name: room.name,
    });

    return { roomId: room.id, name: room.name, tenantId, zoneId: room.zoneId };
  }
}
