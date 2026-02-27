import { Injectable, NotFoundException, Inject, LoggerService } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IFloorRepository, FLOOR_REPOSITORY } from '../../domain/floor.repository.interface';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { OutboxService } from '../../../../../../../libs/shared-kernel/src/infrastructure/outbox.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { v4 as uuidv4 } from 'uuid';

export interface PlaceDeskCommand {
  agentId: string;
  tenantId: string;
  departmentId?: string | null;
  correlationId?: string;
}

@Injectable()
export class PlaceDeskForAgentUseCase {
  constructor(
    @Inject(FLOOR_REPOSITORY)
    private readonly floorRepository: IFloorRepository,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async execute(command: PlaceDeskCommand): Promise<void> {
    let zoneId: string | null = null;

    // Try to find zone: by departmentId, or first WORK zone in tenant's first floor
    if (command.departmentId) {
      const zone = await this.prisma.zone.findFirst({
        where: { id: command.departmentId, tenantId: command.tenantId },
      });
      if (zone) zoneId = zone.id;
    }

    if (!zoneId) {
      const floor = await this.prisma.floor.findFirst({
        where: { tenantId: command.tenantId },
        orderBy: { createdAt: 'asc' },
        include: {
          zones: {
            where: { type: 'WORK' },
            take: 1,
          },
        },
      });

      if (floor && floor.zones.length > 0) {
        zoneId = floor.zones[0].id;
      }
    }

    if (!zoneId) {
      this.logger.warn(
        {
          message: 'No zone available for desk placement, skipping',
          agentId: command.agentId,
          tenantId: command.tenantId,
        },
        'PlaceDeskForAgentUseCase',
      );
      return;
    }

    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new NotFoundException(`Zone ${zoneId} not found`);

    const floor = await this.floorRepository.findById(zone.floorId);
    if (!floor) throw new NotFoundException(`Floor ${zone.floorId} not found`);

    const deskId = uuidv4();

    // Persist desk object
    await this.prisma.officeObject.create({
      data: {
        id: deskId,
        tenantId: command.tenantId,
        zoneId,
        type: 'DESK',
        agentId: command.agentId,
        x: 0,
        y: 0,
        version: 0,
      },
    });

    // Emit DeskPlaced via aggregate
    floor.placeDesk({
      deskId,
      agentId: command.agentId,
      zoneId,
      correlationId: command.correlationId,
    });

    await this.floorRepository.save(floor);
    await this.outboxService.saveEvents(floor.domainEvents as any[], 'office');

    for (const event of floor.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    floor.clearDomainEvents();

    this.logger.log(
      { message: 'Desk placed for agent', agentId: command.agentId, deskId, zoneId },
      'PlaceDeskForAgentUseCase',
    );
  }
}
