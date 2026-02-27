import { AggregateRoot } from '../../../../../../libs/shared-kernel/src/domain/aggregate-root.base';
import { DomainException } from '../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { AgentName } from './value-objects/agent-name.vo';
import { AgentRole } from './value-objects/agent-role.vo';
import { AgentHiredEvent } from './events/agent-hired.event';
import { AgentDeactivatedEvent } from './events/agent-deactivated.event';

export interface AgentProps {
  name: AgentName;
  role: AgentRole;
  tenantId: string;
  departmentId: string | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Agent extends AggregateRoot<string> {
  private _name: AgentName;
  private _role: AgentRole;
  private readonly _tenantId: string;
  private _departmentId: string | null;
  private _isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(id: string, props: AgentProps) {
    super(id);
    this._name = props.name;
    this._role = props.role;
    this._tenantId = props.tenantId;
    this._departmentId = props.departmentId;
    this._isActive = props.isActive;
    this._version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static hire(params: {
    id?: string;
    name: AgentName;
    role: AgentRole;
    tenantId: string;
    departmentId?: string | null;
    correlationId?: string;
  }): Agent {
    const now = new Date();
    const agent = new Agent(params.id ?? crypto.randomUUID(), {
      name: params.name,
      role: params.role,
      tenantId: params.tenantId,
      departmentId: params.departmentId ?? null,
      isActive: true,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });

    agent.addDomainEvent(
      new AgentHiredEvent(
        agent.id,
        params.tenantId,
        params.name.value,
        params.role.value,
        params.departmentId ?? null,
        { correlationId: params.correlationId },
      ),
    );

    return agent;
  }

  static reconstitute(id: string, props: AgentProps): Agent {
    return new Agent(id, props);
  }

  deactivate(): void {
    if (!this._isActive) {
      throw new DomainException('Agent is already inactive', 'AGENT_ALREADY_INACTIVE');
    }

    this._isActive = false;
    this.incrementVersion();

    this.addDomainEvent(new AgentDeactivatedEvent(this.id, this._tenantId));
  }

  get name(): AgentName {
    return this._name;
  }

  get role(): AgentRole {
    return this._role;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get departmentId(): string | null {
    return this._departmentId;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
