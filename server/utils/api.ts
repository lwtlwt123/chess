import { getHeader, type H3Event } from 'h3'
import type { AuthUser } from './token'
import { verifyToken } from './token'

type ApiHandler<T> = (event: H3Event) => T | Promise<T>
type AuthApiHandler<T> = (event: H3Event, auth: AuthUser) => T | Promise<T>

export const withApiHandler = <T>(handler: ApiHandler<T>) => {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    } catch (err) {
      console.error('接口异常:', err)

      return {
        code: 500,
        message: '服务器异常，请稍后再试'
      }
    }
  })
}

export const withAuthHandler = <T>(handler: AuthApiHandler<T>) => {
  return withApiHandler(async (event) => {
    const authorization = getHeader(event, 'authorization') || ''
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : ''
    const auth = token ? verifyToken(token) : null

    if (!auth) {
      return {
        code: 401,
        message: '登录已过期，请重新登录'
      }
    }

    return handler(event, auth)
  })
}
