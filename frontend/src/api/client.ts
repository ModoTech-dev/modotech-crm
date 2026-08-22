import axios from 'axios'

const ACCESS_KEY = 'modotech_access_token'
const REFRESH_KEY = 'modotech_refresh_token'

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing: Promise<string | null> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry && tokenStore.getRefresh()) {
      original._retry = true
      refreshing =
        refreshing ??
        api
          .post('/auth/refresh/', { refresh: tokenStore.getRefresh() })
          .then((res) => {
            tokenStore.set(res.data.access, tokenStore.getRefresh()!)
            return res.data.access as string
          })
          .catch(() => {
            tokenStore.clear()
            window.location.href = '/login'
            return null
          })
          .finally(() => {
            refreshing = null
          })

      const newToken = await refreshing
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
    }
    return Promise.reject(error)
  }
)
