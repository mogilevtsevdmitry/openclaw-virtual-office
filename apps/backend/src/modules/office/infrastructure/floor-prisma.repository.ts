import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { IFloorRepository } from '../domain/floor.repository.interface';
import { Floor } from '../domain/floor.aggregate';

@Injectable()
export class FloorPrismaRepository implements IFloorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Floor | null> {
    const record = await this.prisma.floor.findUnique({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByTenantId(tenantId: string): Promise<Floor[]> {
    const records = await this.prisma.floor.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async countByTenantId(tenantId: string): Promise<number> {
    return this.prisma.floor.count({ where: { tenantId } });
  }

  async save(floor: Floor): Promise<void> {
    await this.prisma.floor.upsert({
      where: { id: floor.id },
      create: {
        id: floor.id,
        tenantId: floor.tenantId,
        name: floor.name,
        version: floor.version,
      },
      update: {
        name: floor.name,
        version: floor.version,
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(record: {
    id: string;
    tenantId: string;
    name: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): Floor {
    return Floor.reconstitute(record.id, {
      tenantId: record.tenantId,
      name: record.name,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
