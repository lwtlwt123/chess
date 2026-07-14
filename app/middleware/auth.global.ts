import { navigateTo } from '#app'
import { useCookie } from '#imports'
import {
  clearAuthStorage,
  isAuthTokenExpired,
  saveAuthRedirectMessage,
  verifyAuthToken
} from '~/utils/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const tokenCookie = useCookie<string | null>('token', {
    path: '/',
    sameSite: 'lax'
  })
  const token = tokenCookie.value || ''

  if (to.path === '/') {
    if (!token) return

    if (isAuthTokenExpired(token)) {
      tokenCookie.value = null
      clearAuthStorage()
      return
    }

    const isVerified = await verifyAuthToken(token)

    if (!isVerified) {
      tokenCookie.value = null
      clearAuthStorage()
      return
    }

    saveAuthRedirectMessage('已登录')

    return navigateTo('/gameLobby', {
      replace: true
    })
  }

  if (!token || isAuthTokenExpired(token)) {
    tokenCookie.value = null
    clearAuthStorage()
    saveAuthRedirectMessage('登录已过期，请重新登录')

    return navigateTo('/', {
      external: true,
      replace: true
    })
  }

  const isVerified = await verifyAuthToken(token)

  if (isVerified) return

  tokenCookie.value = null
  clearAuthStorage()
  saveAuthRedirectMessage('登录已过期，请重新登录')

  return navigateTo('/', {
    external: true,
    replace: true
  })
})
