import { useCookie } from '#imports'

const AUTH_TOKEN_KEY = 'token'
const AUTH_REDIRECT_MESSAGE_KEY = 'authRedirectMessage'
const LEGACY_AUTH_USERNAME_KEY = 'username'
const LEGACY_AUTH_USER_ID_KEY = 'userId'
const AUTH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60
const AUTH_REDIRECT_MESSAGE_MAX_AGE = 60

export type AuthStorage = {
  userId: number
  username: string
  nickname: string | null
  headImg: string | null
  token: string
}

type TokenPayload = {
  userId?: number
  username?: string
  nickname?: string | null
  headImg?: string | null
  exp?: number
}

const decodeTokenPayload = (token: string): TokenPayload | null => {
  try {
    const payload = token.split('.')[1]

    if (!payload) return null

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedBase64 = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=')

    const bytes = Uint8Array.from(atob(paddedBase64), char => char.charCodeAt(0))

    return JSON.parse(new TextDecoder().decode(bytes)) as TokenPayload
  } catch {
    return null
  }
}

const clearLegacyAuthStorage = () => {
  localStorage.removeItem(LEGACY_AUTH_USERNAME_KEY)
  localStorage.removeItem(LEGACY_AUTH_USER_ID_KEY)
}

const readClientCookie = (name: string) => {
  if (typeof document === 'undefined') return ''

  const encodedName = `${name}=`
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(encodedName))

  if (!cookie) return ''

  return decodeURIComponent(cookie.slice(encodedName.length))
}

const setClientCookie = (name: string, value: string, maxAgeSeconds: number) => {
  if (typeof document === 'undefined') return

  const encodedValue = encodeURIComponent(value)
  document.cookie = `${name}=${encodedValue}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

const clearClientCookie = (name: string) => {
  if (typeof document === 'undefined') return

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

export const saveAuthStorage = (auth: Pick<AuthStorage, 'token'>) => {
  if (!import.meta.client) return

  clearLegacyAuthStorage()
  localStorage.setItem(AUTH_TOKEN_KEY, auth.token)
  setClientCookie(AUTH_TOKEN_KEY, auth.token, AUTH_TOKEN_MAX_AGE)
}

export const getAuthStorage = (): AuthStorage | null => {
  if (!import.meta.client) return null

  clearLegacyAuthStorage()

  const token = localStorage.getItem(AUTH_TOKEN_KEY) || readClientCookie(AUTH_TOKEN_KEY)
  const payload = token ? decodeTokenPayload(token) : null

  if (!token || !payload?.userId || !payload.username) return null

  return {
    userId: payload.userId,
    username: payload.username,
    nickname: payload.nickname ?? null,
    headImg: payload.headImg ?? null,
    token
  }
}

export const getAuthToken = () => {
  if (!import.meta.client) return ''

  clearLegacyAuthStorage()

  const token = localStorage.getItem(AUTH_TOKEN_KEY) || readClientCookie(AUTH_TOKEN_KEY)

  if (token && !localStorage.getItem(AUTH_TOKEN_KEY)) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  }

  return token
}

export const isAuthTokenExpired = (token = getAuthToken()) => {

  if (!token) return true

  const payload = decodeTokenPayload(token)

  if (!payload?.exp) return true

  return payload.exp <= Math.floor(Date.now() / 1000)
}

export const verifyAuthToken = async (token: string) => {
  if (!token || isAuthTokenExpired(token)) return false

  try {
    const response = await $fetch<{ code: number }>('/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    return response.code === 200
  } catch {
    return false
  }
}

export const clearAuthStorage = () => {
  if (!import.meta.client) return

  clearLegacyAuthStorage()
  localStorage.removeItem(AUTH_TOKEN_KEY)
  clearClientCookie(AUTH_TOKEN_KEY)
}

export const saveAuthRedirectMessage = (message: string) => {
  const cookie = useCookie<string | null>(AUTH_REDIRECT_MESSAGE_KEY, {
    maxAge: AUTH_REDIRECT_MESSAGE_MAX_AGE,
    path: '/',
    sameSite: 'lax'
  })

  cookie.value = message
}

export const consumeAuthRedirectMessage = () => {
  const cookie = useCookie<string | null>(AUTH_REDIRECT_MESSAGE_KEY, {
    path: '/',
    sameSite: 'lax'
  })
  const message = cookie.value || ''

  cookie.value = null
  return message
}
