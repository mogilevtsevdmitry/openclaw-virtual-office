import axios from 'axios'

const BASE_URL = '/api'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
type FailedQueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void }
let failedQueue: FailedQueueItem[] = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error)
    } else if (token) {
      p.resolve(token)
    }
  })
  failedQueue = []
}

// 401 → refresh → retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const originalRequest = error.config
    if (!originalRequest) return Promise.reject(error)

    if (error.response?.status === 401 && !(originalRequest as typeof originalRequest & { _retry?: boolean })._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      ;(originalRequest as typeof originalRequest & { _retry?: boolean })._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await axios.post<{ accessToken: string }>(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        })

        const newToken = data.accessToken
        localStorage.setItem('access_token', newToken)
        apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
