import { AggregateRoot } from '../../../../../../libs/shared-kernel/src/domain/aggregate-root.base';
import { DomainException } from '../../../../../../libs/shared-kernel/src/domain/domain.exception';
import { FloorCreatedEvent } from './events/floor-created.event';
import { DepartmentCreatedEvent } from './events/department-created.event';
import { DeskPlacedEvent } from './events/desk-placed.event';
import { DepartmentType } from './value-objects/department-type.vo';

export interface ZoneSnapshot {
  id: string;
  name: string;
  type: string;
  capacity: number;
}

export interface DeskSnapshot {
  id: string;
  zoneId: string;
  agentId: string | null;
  x: number;
  y: number;
}

export interface FloorProps {
  tenantId: string;
  name: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Floor extends AggregateRoot<string> {
  private _tenantId: string;
  private _name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(id: string, props: FloorProps) {
    super(id);
    this._tenantId = props.tenantId;
    this._name = props.name;
    this._version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(params: {
    id?: string;
    tenantId: string;
    name: string;
    correlationId?: string;
  }): Floor {
    if (!params.name || params.name.trim().length === 0) {
      throw new DomainException('Floor name cannot be empty', 'FLOOR_NAME_EMPTY');
    }

    const now = new Date();
    const floor = new Floor(params.id ?? crypto.randomUUID(), {
      tenantId: params.tenantId,
      name: params.name.trim(),
      version: 0,
      createdAt: now,
      updatedAt: now,
    });

    floor.addDomainEvent(
      new FloorCreatedEvent(floor.id, params.tenantId, params.name, {
        correlationId: params.correlationId,
      }),
    );

    return floor;
  }

  static reconstitute(id: string, props: FloorProps): Floor {
    return new Floor(id, props);
  }

  createDepartment(params: {
    zoneId: string;
    name: string;
    type: DepartmentType;
    correlationId?: string;
  }): void {
    this.addDomainEvent(
      new DepartmentCreatedEvent(
        params.zoneId,
        this._tenantId,
        this.id,
        params.name,
        params.type.value,
        { correlationId: params.correlationId },
      ),
    );
  }

  placeDesk(params: {
    deskId: string;
    agentId: string;
    zoneId: string;
    correlationId?: string;
  }): void {
    this.addDomainEvent(
      new DeskPlacedEvent(
        params.deskId,
        this._tenantId,
        params.agentId,
        params.zoneId,
        this.id,
        { correlationId: params.correlationId },
      ),
    );
    this.incrementVersion();
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get name(): string {
    return this._name;
  }
}
