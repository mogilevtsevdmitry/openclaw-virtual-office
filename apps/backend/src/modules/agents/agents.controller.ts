import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/jwt-auth.guard';
import { TenantId } from '../auth/decorators/tenant.decorator';
import { HireAgentUseCase } from './application/use-cases/hire-agent.use-case';
import { ListAgentsUseCase } from './application/use-cases/list-agents.use-case';
import { HireAgentDto } from './application/dto/hire-agent.dto';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

// Agent metadata by role
const AGENT_META: Record<string, { reportsTo: string; specialization: string; skills: string[] }> = {
  DIRECTOR:           { reportsTo: '—', specialization: 'Стратегия, координация', skills: ['Управление', 'Планирование', 'AI-оркестрация'] },
  FINANCIER:          { reportsTo: 'DIRECTOR', specialization: 'Финансовый анализ', skills: ['Бюджетирование', 'Отчётность', 'Zenmoney'] },
  BACKEND:            { reportsTo: 'TECH_LEAD', specialization: 'NestJS, PostgreSQL, DDD', skills: ['API', 'Микросервисы', 'Prisma', 'Clean Architecture'] },
  DEVOPS:             { reportsTo: 'TECH_LEAD', specialization: 'Инфраструктура, CI/CD', skills: ['Docker', 'nginx', 'GitHub Actions', 'Linux'] },
  FRONTEND:           { reportsTo: 'TECH_LEAD', specialization: 'React, Phaser, UI/UX', skills: ['TypeScript', 'Vite', 'CSS Modules', 'Pixel Art'] },
  ARCHITECT:          { reportsTo: 'TECH_LEAD', specialization: 'DDD, Clean Architecture', skills: ['Domain Modelling', 'Bounded Contexts', 'CQRS'] },
  SECURITY:           { reportsTo: 'DIRECTOR', specialization: 'Безопасность, аудит', skills: ['Pentest', 'OWASP', 'Audit Reporting'] },
  ARCHIVIST:          { reportsTo: 'DIRECTOR', specialization: 'Память системы, артефакты', skills: ['Документация', 'Индексация', 'Outbox polling'] },
  SOLUTION_ARCHITECT: { reportsTo: 'TECH_LEAD', specialization: 'Solution Design, C4', skills: ['Архитектурные паттерны', 'NFR', 'Trade-offs'] },
  SQL_ARCHITECT:      { reportsTo: 'TECH_LEAD', specialization: 'Базы данных, схемы', skills: ['PostgreSQL', 'Migrations', 'Query optimization'] },
  TECH_WRITER:        { reportsTo: 'TECH_LEAD', specialization: 'Документация, README', skills: ['Technical Writing', 'OpenAPI', 'Runbooks'] },
  QA:                 { reportsTo: 'TECH_LEAD', specialization: 'Тестирование, качество', skills: ['E2E тесты', 'Test plans', 'Bug reports'] },
  PRODUCT:            { reportsTo: 'DIRECTOR', specialization: 'Продуктовая стратегия', skills: ['Roadmap', 'Метрики', 'User stories'] },
  TECH_LEAD:          { reportsTo: 'DIRECTOR', specialization: 'Оркестрация pipeline', skills: ['Delivery', 'Stage gates', 'Risk management'] },
  BA:                 { reportsTo: 'TECH_LEAD', specialization: 'Бизнес-анализ, требования', skills: ['PRD', 'BABOK', 'User research'] },
}

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(
    private readonly hireAgentUseCase: HireAgentUseCase,
    private readonly listAgentsUseCase: ListAgentsUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async hire(@Body() dto: HireAgentDto, @TenantId() tenantId: string) {
    return this.hireAgentUseCase.execute(dto, tenantId);
  }

  @Get()
  async list(@TenantId() tenantId: string) {
    return this.listAgentsUseCase.execute(tenantId);
  }

  // openclaw agentId → DB role mapping
  private readonly AGENTID_TO_ROLE: Record<string, string> = {
    main: 'DIRECTOR', finance: 'FINANCIER', backend: 'BACKEND',
    devops: 'DEVOPS', frontend: 'FRONTEND', ddd: 'ARCHITECT',
    security: 'SECURITY', archivist: 'ARCHIVIST', solution: 'SOLUTION_ARCHITECT',
    sql: 'SQL_ARCHITECT', techwriter: 'TECH_WRITER', techlead: 'TECH_LEAD',
    product: 'PRODUCT', ba: 'BA', qa: 'QA',
  }

  @Public()
  @Get(':agentId')
  async getAgent(@Param('agentId') agentId: string) {
    const role = this.AGENTID_TO_ROLE[agentId.toLowerCase()]
    const agent = await this.prisma.agent.findFirst({
      where: role
        ? { role, tenantId: 'tenant-smoke' }
        : { OR: [{ id: agentId }] },
      orderBy: { createdAt: 'desc' },
      include: { presence: true },
    });
    if (!agent) throw new NotFoundException(`Agent "${agentId}" not found`);

    const meta = AGENT_META[agent.role] ?? {
      reportsTo: 'DIRECTOR',
      specialization: 'Специалист',
      skills: [],
    };

    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      presenceState: (agent.presence as { state?: string } | null)?.state ?? 'IDLE',
      lastSeen: (agent.presence as { updatedAt?: Date } | null)?.updatedAt ?? null,
      currentTask: null,
      reportsTo: meta.reportsTo,
      specialization: meta.specialization,
      skills: meta.skills,
    };
  }
}
