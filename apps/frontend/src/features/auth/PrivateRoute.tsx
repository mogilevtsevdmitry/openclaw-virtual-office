import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from './authStore'
import { authApi } from '@shared/api'

export function PrivateRoute() {
  const { isAuthenticated, token, refreshToken, expiresAt, updateToken, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const tryRefresh = async () => {
      // If we have a stored session but token is expired (or about to expire in 30s)
      if (isAuthenticated && expiresAt && Date.now() > expiresAt - 30_000 && refreshToken) {
        try {
          const data = await authApi.refresh(refreshToken)
          updateToken(data.accessToken, data.refreshToken, 300)
        } catch {
          clearAuth()
        }
      }
      setChecking(false)
    }

    tryRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) return null // Brief blank while checking — no flash to login

  if (!isAuthenticated || !token) return <Navigate to="/login" replace />

  return <Outlet />
}
