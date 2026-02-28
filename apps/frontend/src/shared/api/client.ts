import axios from 'axios'

const BASE_URL = '/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send httpOnly cookie on refresh
})

// ─── Request interceptor: attach JWT + proactive refresh ──────────────────────
apiClient.interceptors.request.use(async (config) => {
  // Don't intercept auth endpoints themselves
  const isAuthEndpoint = config.url?.includes('/auth/')
  if (isAuthEndpoint) return config

  // Proactive refresh: if token expires in < 30 seconds — refresh now
  const { useAuthStore } = await import('@features/auth/authStore')
  const state = useAuthStore.getState()
  const expiresAt = state.expiresAt
  const refreshToken = state.refreshToken ?? localStorage.getItem('refresh_token')

  if (expiresAt && refreshToken && Date.now() > expiresAt - 30_000) {
    // Token expired or about to expire — refresh proactively
    if (!isRefreshing) {
      isRefreshing = true
      try {
        const { data } = await axios.post<{
          accessToken: string
          refreshToken: string
        }>(`${BASE_URL}/auth/refresh`, { refreshToken }, { withCredentials: true })

        const newToken = data.accessToken
        const newRefresh = data.refreshToken

        state.updateToken(newToken, newRefresh, 300)
        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
      } catch (e) {
        processQueue(e, null)
        state.clearAuth()
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }
  }

  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// ─── 401 retry queue ──────────────────────────────────────────────────────────
let isRefreshing = false
type FailedQueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void }
let failedQueue: FailedQueueItem[] = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else if (token) p.resolve(token)
  })
  failedQueue = []
}

// ─── Response interceptor: 401 → refresh → retry ─────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const originalRequest = error.config as typeof error.config & { _retry?: boolean }
    if (!originalRequest) return Promise.reject(error)

    // Skip refresh for auth endpoints
    if (originalRequest.url?.includes('/auth/')) return Promise.reject(error)

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in flight
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers!.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await axios.post<{
          accessToken: string
          refreshToken: string
        }>(`${BASE_URL}/auth/refresh`, { refreshToken }, { withCredentials: true })

        const newToken = data.accessToken
        const newRefresh = data.refreshToken

        localStorage.setItem('access_token', newToken)
        localStorage.setItem('refresh_token', newRefresh)

        // Update store
        const { useAuthStore } = await import('@features/auth/authStore')
        useAuthStore.getState().updateToken(newToken, newRefresh, 300)

        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)

        originalRequest.headers!.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)

        const { useAuthStore } = await import('@features/auth/authStore')
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
