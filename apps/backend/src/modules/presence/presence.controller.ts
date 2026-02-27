import {
  Controller,
  Put,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { ChangeActivityUseCase } from './application/use-cases/change-activity.use-case';
import { ChangeActivityDto } from './application/dto/change-activity.dto';
import { IPresenceRepository, PRESENCE_REPOSITORY } from './domain/presence.repository.interface';

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(
    private readonly changeActivityUseCase: ChangeActivityUseCase,
    @Inject(PRESENCE_REPOSITORY)
    private readonly presenceRepository: IPresenceRepository,
  ) {}

  @Put(':agentId')
  @HttpCode(HttpStatus.OK)
  async changeActivity(
    @Param('agentId') agentId: string,
    @Body() dto: ChangeActivityDto,
    @TenantId() _tenantId: string,
  ) {
    return this.changeActivityUseCase.execute(agentId, dto);
  }

  @Get(':agentId')
  async getPresence(@Param('agentId') agentId: string) {
    const presence = await this.presenceRepository.findByAgentId(agentId);
    if (!presence) {
      throw new NotFoundException(`Presence not found for agent ${agentId}`);
    }
    return {
      agentId: presence.agentId,
      state: presence.state.value,
      zoneId: presence.zoneId,
      version: presence.version,
    };
  }
}
