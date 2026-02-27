import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { CreateChatRoomUseCase } from './application/use-cases/create-chat-room.use-case';
import { SendMessageUseCase } from './application/use-cases/send-message.use-case';
import { GetMessagesUseCase } from './application/use-cases/get-messages.use-case';
import { CreateChatRoomDto } from './application/dto/create-chat-room.dto';
import { SendMessageDto } from './application/dto/send-message.dto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('chat-rooms')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
  constructor(
    private readonly createChatRoomUseCase: CreateChatRoomUseCase,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly getMessagesUseCase: GetMessagesUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRoom(@Body() dto: CreateChatRoomDto, @TenantId() tenantId: string) {
    return this.createChatRoomUseCase.execute(dto, tenantId);
  }

  @Get()
  async listRooms(@TenantId() tenantId: string) {
    return this.prisma.chatRoom.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('id') roomId: string,
    @Body() dto: SendMessageDto,
    @TenantId() tenantId: string,
  ) {
    return this.sendMessageUseCase.execute(roomId, dto, tenantId);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') roomId: string,
    @TenantId() tenantId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.getMessagesUseCase.execute({
      roomId,
      tenantId,
      limit: limit ? parseInt(limit, 10) : 50,
      before,
    });
  }
}
