import { AggregateRoot } from '../../../../../../libs/shared-kernel/src/domain/aggregate-root.base';
import { PresenceState, PresenceStateValue } from './value-objects/presence-state.vo';
import { PresenceStateMachine } from './services/presence-state-machine';
import { PresenceChangedEvent } from './events/presence-changed.event';

export interface AgentPresenceProps {
  agentId: string;
  tenantId: string;
  zoneId: string | null;
  state: PresenceState;
  version: number;
  updatedAt: Date;
}

export class AgentPresence extends AggregateRoot<string> {
  private _agentId: string;
  private _tenantId: string;
  private _zoneId: string | null;
  private _state: PresenceState;
  readonly updatedAt: Date;

  private constructor(id: string, props: AgentPresenceProps) {
    super(id);
    this._agentId = props.agentId;
    this._tenantId = props.tenantId;
    this._zoneId = props.zoneId;
    this._state = props.state;
    this._version = props.version;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Factory: создаётся ТОЛЬКО из события DeskPlaced (per DECISIONS.md Q1)
   */
  static initializeFromDeskPlaced(params: {
    id?: string;
    agentId: string;
    tenantId: string;
    zoneId: string;
    correlationId?: string;
  }): AgentPresence {
    const presence = new AgentPresence(params.id ?? crypto.randomUUID(), {
      agentId: params.agentId,
      tenantId: params.tenantId,
      zoneId: params.zoneId,
      state: PresenceState.idle(),
      version: 0,
      updatedAt: new Date(),
    });

    // Emit initial event
    presence.addDomainEvent(
      new PresenceChangedEvent(
        presence.id,
        params.tenantId,
        params.agentId,
        'IDLE',
        'IDLE',
        params.zoneId,
        { correlationId: params.correlationId },
      ),
    );

    return presence;
  }

  static reconstitute(id: string, props: AgentPresenceProps): AgentPresence {
    return new AgentPresence(id, props);
  }

  changeActivity(toState: PresenceStateValue, zoneId?: string | null): void {
    const from = this._state.value;
    PresenceStateMachine.validate(from, toState);

    const prevState = from;
    this._state = new PresenceState(toState);

    if (zoneId !== undefined) {
      this._zoneId = zoneId;
    }

    this.incrementVersion();

    this.addDomainEvent(
      new PresenceChangedEvent(
        this.id,
        this._tenantId,
        this._agentId,
        prevState,
        toState,
        this._zoneId,
      ),
    );
  }

  get agentId(): string {
    return this._agentId;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get zoneId(): string | null {
    return this._zoneId;
  }

  get state(): PresenceState {
    return this._state;
  }
}
