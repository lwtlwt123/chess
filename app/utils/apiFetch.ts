import { navigateTo } from '#app'
import {
  clearAuthStorage,
  getAuthToken,
  isAuthTokenExpired,
  saveAuthRedirectMessage
} from './auth'

export type ApiResponse<T = unknown> = {
  code: number
  message: string
  data?: T
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  body?: BodyInit | Record<string, unknown> | null
  query?: Record<string, unknown>
  params?: Record<string, unknown>
  headers?: HeadersInit
}

const goLogin = async (message = '登录已过期，请重新登录') => {
  if (!import.meta.client) return

  clearAuthStorage()
  saveAuthRedirectMessage(message)
  await navigateTo('/', {
    external: true,
    replace: true
  })
}

export const apiFetch = async <T = unknown>(url: string, options: ApiFetchOptions = {}) => {
  if (import.meta.client && isAuthTokenExpired()) {
    await goLogin()

    return {
      code: 401,
      message: '登录已过期，请重新登录'
    } as ApiResponse<T>
  }

  const headers = new Headers(options.headers)
  const token = getAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await $fetch<ApiResponse<T>>(url, {
    ...options,
    headers
  })

  if (response.code === 401) {
    await goLogin(response.message)
  }

  return response
}
