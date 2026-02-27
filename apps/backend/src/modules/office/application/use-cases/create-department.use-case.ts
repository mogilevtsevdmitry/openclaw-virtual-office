import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IFloorRepository, FLOOR_REPOSITORY } from '../../domain/floor.repository.interface';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { DepartmentType } from '../../domain/value-objects/department-type.vo';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { OutboxService } from '../../../../../../../libs/shared-kernel/src/infrastructure/outbox.service';
import { v4 as uuidv4 } from 'uuid';

const MAX_DEPARTMENTS_PER_TENANT = 20;

export interface CreateDepartmentResult {
  departmentId: string;
  name: string;
  type: string;
  floorId: string;
  tenantId: string;
}

@Injectable()
export class CreateDepartmentUseCase {
  constructor(
    @Inject(FLOOR_REPOSITORY)
    private readonly floorRepository: IFloorRepository,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    floorId: string,
    dto: CreateDepartmentDto,
    tenantId: string,
  ): Promise<CreateDepartmentResult> {
    const floor = await this.floorRepository.findById(floorId);
    if (!floor || floor.tenantId !== tenantId) {
      throw new NotFoundException(`Floor ${floorId} not found`);
    }

    // Quota check
    const deptCount = await this.prisma.zone.count({ where: { tenantId } });
    if (deptCount >= MAX_DEPARTMENTS_PER_TENANT) {
      throw new ForbiddenException(
        `Department quota exceeded. Max ${MAX_DEPARTMENTS_PER_TENANT} departments per tenant.`,
      );
    }

    const departmentType = new DepartmentType(dto.type);
    const zoneId = uuidv4();

    // Persist zone
    await this.prisma.zone.create({
      data: {
        id: zoneId,
        floorId,
        tenantId,
        name: dto.name,
        type: departmentType.value,
        capacity: 10,
        version: 0,
      },
    });

    // Domain event via Floor aggregate
    floor.createDepartment({ zoneId, name: dto.name, type: departmentType });
    await this.floorRepository.save(floor);
    await this.outboxService.saveEvents(floor.domainEvents as any[], 'office');

    for (const event of floor.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    floor.clearDomainEvents();

    return {
      departmentId: zoneId,
      name: dto.name,
      type: departmentType.value,
      floorId,
      tenantId,
    };
  }
}
