import { apiClient } from './client'
import type { CreateFloorCommand, CreateDepartmentCommand } from '../types'

export interface Floor {
  floorId: string
  name: string
  tenantId: string
}

export interface Department {
  departmentId: string
  name: string
  type: string
  floorId: string
}

export const officeApi = {
  createFloor: (cmd: CreateFloorCommand) =>
    apiClient.post<{ commandId: string }>('/floors', cmd).then((r) => r.data),

  // Backend: GET /api/v1/floors (not /office/floors)
  listFloors: () =>
    apiClient.get<Floor[]>('/floors').then((r) => r.data),

  createDepartment: (cmd: CreateDepartmentCommand) =>
    apiClient.post<{ commandId: string }>('/departments', cmd).then((r) => r.data),

  listDepartments: () =>
    apiClient.get<Department[]>('/departments').then((r) => r.data),
}
