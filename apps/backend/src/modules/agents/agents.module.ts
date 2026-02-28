import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { HireAgentUseCase } from './application/use-cases/hire-agent.use-case';
import { ListAgentsUseCase } from './application/use-cases/list-agents.use-case';
import { AgentPrismaRepository } from './infrastructure/agent-prisma.repository';
import { AGENT_REPOSITORY } from './domain/agent.repository.interface';
import { AgentHiredPolicy } from './application/policies/agent-hired.policy';
import { OfficeModule } from '../office/office.module';
import { OutboxService } from '../../../../../libs/shared-kernel/src/infrastructure/outbox.service';
@Module({
  imports: [OfficeModule],
  controllers: [AgentsController],
  providers: [
    HireAgentUseCase,
    ListAgentsUseCase,
    AgentHiredPolicy,
    OutboxService,
    {
      provide: AGENT_REPOSITORY,
      useClass: AgentPrismaRepository,
    },
  ],
})
export class AgentsModule {}
