import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { JwtPayload } from '../auth/infrastructure/jwt.strategy';
import { HireAgentUseCase } from './application/use-cases/hire-agent.use-case';
import { ListAgentsUseCase } from './application/use-cases/list-agents.use-case';
import { HireAgentDto } from './application/dto/hire-agent.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(
    private readonly hireAgentUseCase: HireAgentUseCase,
    private readonly listAgentsUseCase: ListAgentsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async hire(
    @Body() dto: HireAgentDto,
    @TenantId() tenantId: string,
  ) {
    return this.hireAgentUseCase.execute(dto, tenantId);
  }

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.listAgentsUseCase.execute(tenantId);
  }
}
