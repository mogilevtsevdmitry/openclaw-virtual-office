import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';

export interface GetMessagesQuery {
  roomId: string;
  tenantId: string;
  limit?: number;
  before?: string; // message id cursor
}

@Injectable()
export class GetMessagesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMessagesQuery) {
    const { roomId, tenantId, limit = 50, before } = query;

    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId, tenantId },
    });
    if (!room) {
      throw new NotFoundException(`Chat room ${roomId} not found`);
    }

    let cursor: { createdAt: Date } | undefined;
    if (before) {
      const msg = await this.prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (msg) cursor = { createdAt: msg.createdAt };
    }

    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        tenantId,
        ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return {
      messages: messages.reverse().map((m) => ({
        id: m.id,
        authorAgentId: m.authorAgentId,
        text: m.text,
        createdAt: m.createdAt,
      })),
      hasMore: messages.length === limit,
    };
  }
}
