import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IFloorRepository, FLOOR_REPOSITORY } from '../../domain/floor.repository.interface';
import { Floor } from '../../domain/floor.aggregate';
import { CreateFloorDto } from '../dto/create-floor.dto';
import { OutboxService } from '../../../../../../../libs/shared-kernel/src/infrastructure/outbox.service';

const MAX_FLOORS_PER_TENANT = 5;

export interface CreateFloorResult {
  floorId: string;
  name: string;
  tenantId: string;
}

@Injectable()
export class CreateFloorUseCase {
  constructor(
    @Inject(FLOOR_REPOSITORY)
    private readonly floorRepository: IFloorRepository,
    private readonly outboxService: OutboxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: CreateFloorDto, tenantId: string): Promise<CreateFloorResult> {
    const count = await this.floorRepository.countByTenantId(tenantId);
    if (count >= MAX_FLOORS_PER_TENANT) {
      throw new ForbiddenException(
        `Floor quota exceeded. Max ${MAX_FLOORS_PER_TENANT} floors per tenant.`,
      );
    }

    const floor = Floor.create({ tenantId, name: dto.name });
    await this.floorRepository.save(floor);
    await this.outboxService.saveEvents(floor.domainEvents as any[], 'office');

    for (const event of floor.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    floor.clearDomainEvents();

    return { floorId: floor.id, name: floor.name, tenantId: floor.tenantId };
  }
}
