import { apiClient } from './client'

interface AuthResponse {
  accessToken: string
  refreshToken?: string  // опционально: бэкенд отдаёт через httpOnly cookie
  tenantId: string
  userId: string
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
      .post<{ accessToken: string }>('/auth/refresh', { refreshToken })
      .then((r) => r.data),
}
