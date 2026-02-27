import { Floor } from './floor.aggregate';

export const FLOOR_REPOSITORY = Symbol('FLOOR_REPOSITORY');

export interface IFloorRepository {
  findById(id: string): Promise<Floor | null>;
  findByTenantId(tenantId: string): Promise<Floor[]>;
  countByTenantId(tenantId: string): Promise<number>;
  save(floor: Floor): Promise<void>;
}
