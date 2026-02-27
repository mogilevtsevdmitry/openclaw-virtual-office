import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SendMessageDto } from '../dto/send-message.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SendMessageUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(roomId: string, dto: SendMessageDto, tenantId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId, tenantId },
    });
    if (!room) {
      throw new NotFoundException(`Chat room ${roomId} not found`);
    }

    // Only agents can send messages (per DECISIONS.md Q7)
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.authorAgentId, tenantId },
    });
    if (!agent) {
      throw new ForbiddenException(
        `Only agents can send messages. Agent ${dto.authorAgentId} not found in tenant.`,
      );
    }

    if (!dto.text || dto.text.trim().length === 0) {
      throw new ForbiddenException('Message text cannot be empty');
    }

    const message = await this.prisma.message.create({
      data: {
        id: uuidv4(),
        tenantId,
        roomId,
        authorAgentId: dto.authorAgentId,
        text: dto.text.trim(),
      },
    });

    // Emit for WS broadcast
    this.eventEmitter.emit('message.created', {
      messageId: message.id,
      roomId,
      tenantId,
      authorAgentId: dto.authorAgentId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    });

    return {
      messageId: message.id,
      roomId,
      authorAgentId: message.authorAgentId,
      text: message.text,
      createdAt: message.createdAt,
    };
  }
}
