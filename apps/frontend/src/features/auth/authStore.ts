import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  refreshToken: string | null
  tenantId: string | null
  userId: string | null
  isAuthenticated: boolean
  setAuth: (token: string, refreshToken: string, tenantId: string, userId: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      tenantId: null,
      userId: null,
      isAuthenticated: false,

      setAuth: (token, refreshToken, tenantId, userId) => {
        localStorage.setItem('access_token', token)
        localStorage.setItem('refresh_token', refreshToken)
        set({ token, refreshToken, tenantId, userId, isAuthenticated: true })
      },

      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ token: null, refreshToken: null, tenantId: null, userId: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        tenantId: state.tenantId,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
