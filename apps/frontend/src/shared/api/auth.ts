import { apiClient } from './client'

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number   // seconds (300 = 5 min)
  tenantId: string
  userId: string
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

interface LoginDto {
  email: string
  password: string
}

interface RegisterDto {
  email: string
  password: string
  tenantName?: string
}

export const authApi = {
  login: (dto: LoginDto) =>
    apiClient.post<AuthResponse>('/auth/login', dto).then((r) => r.data),

  register: (dto: RegisterDto) =>
    apiClient.post<AuthResponse>('/auth/register', dto).then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient
      .post<RefreshResponse>('/auth/refresh', { refreshToken })
      .then((r) => r.data),
}
