import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AgentHiredEvent } from '../../domain/events/agent-hired.event';
import { PlaceDeskForAgentUseCase } from '../../../office/application/use-cases/place-desk-for-agent.use-case';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class AgentHiredPolicy {
  constructor(
    private readonly placeDeskForAgent: PlaceDeskForAgentUseCase,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  @OnEvent('agent.hired')
  async handleAgentHired(event: AgentHiredEvent): Promise<void> {
    this.logger.log(
      {
        message: 'AgentHiredPolicy triggered → PlaceDeskForAgent',
        agentId: event.aggregateId,
        tenantId: event.tenantId,
      },
      'AgentHiredPolicy',
    );

    try {
      await this.placeDeskForAgent.execute({
        agentId: event.aggregateId,
        tenantId: event.tenantId,
        departmentId: event.departmentId,
        correlationId: event.correlationId,
      });
    } catch (err) {
      // Policy failure should not roll back agent creation
      this.logger.error(
        {
          message: 'AgentHiredPolicy: PlaceDeskForAgent failed',
          agentId: event.aggregateId,
          error: err instanceof Error ? err.message : String(err),
        },
        'AgentHiredPolicy',
      );
    }
  }
}
