import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CreateChatRoomUseCase } from './application/use-cases/create-chat-room.use-case';
import { SendMessageUseCase } from './application/use-cases/send-message.use-case';
import { GetMessagesUseCase } from './application/use-cases/get-messages.use-case';

@Module({
  controllers: [CommunicationController],
  providers: [
    CreateChatRoomUseCase,
    SendMessageUseCase,
    GetMessagesUseCase,
  ],
})
export class CommunicationModule {}
