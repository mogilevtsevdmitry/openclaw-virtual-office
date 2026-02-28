import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null  // Unix timestamp ms — когда истекает access token
  tenantId: string | null
  userId: string | null
  isAuthenticated: boolean
  setAuth: (
    token: string,
    refreshToken: string,
    tenantId: string,
    userId: string,
    expiresIn?: number, // seconds
  ) => void
  updateToken: (token: string, refreshToken: string, expiresIn?: number) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      expiresAt: null,
      tenantId: null,
      userId: null,
      isAuthenticated: false,

      setAuth: (token, refreshToken, tenantId, userId, expiresIn = 300) => {
        const expiresAt = Date.now() + expiresIn * 1000
        localStorage.setItem('access_token', token)
        localStorage.setItem('refresh_token', refreshToken)
        set({ token, refreshToken, expiresAt, tenantId, userId, isAuthenticated: true })
      },

      updateToken: (token, refreshToken, expiresIn = 300) => {
        const expiresAt = Date.now() + expiresIn * 1000
        localStorage.setItem('access_token', token)
        localStorage.setItem('refresh_token', refreshToken)
        set({ token, refreshToken, expiresAt })
      },

      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          token: null,
          refreshToken: null,
          expiresAt: null,
          tenantId: null,
          userId: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        tenantId: state.tenantId,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
