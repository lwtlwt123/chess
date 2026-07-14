import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'chess-game-local-secret'

export type AuthUser = {
    userId: number
    username: string
    nickname: string | null
    headImg: string | null
}

type TokenPayload = AuthUser & {
    exp: number
}

const toBase64Url = (value: string) => {
    return Buffer.from(value)
        .toString('base64url')
}

const fromBase64Url = (value: string) => {
    return Buffer.from(value, 'base64url')
        .toString('utf8')
}

const sign = (value: string) => {
    return createHmac('sha256', TOKEN_SECRET)
        .update(value)
        .digest('base64url')
}

export const createToken = (user: AuthUser) => {
    const header = toBase64Url(JSON.stringify({
        alg: 'HS256',
        typ: 'JWT'
    }))
    const payload = toBase64Url(JSON.stringify({
        userId: user.userId,
        username: user.username,
        nickname: user.nickname,
        headImg: user.headImg,
        exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRES_IN
    }))
    const unsignedToken = `${header}.${payload}`

    return `${unsignedToken}.${sign(unsignedToken)}`
}

export const verifyToken = (token: string): AuthUser | null => {
    try {
        const [header, payload, signature] = token.split('.')

        if (!header || !payload || !signature) return null

        const expectedSignature = sign(`${header}.${payload}`)
        const signatureBuffer = Buffer.from(signature)
        const expectedSignatureBuffer = Buffer.from(expectedSignature)

        if (signatureBuffer.length !== expectedSignatureBuffer.length) return null
        if (!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) return null

        const data = JSON.parse(fromBase64Url(payload)) as TokenPayload

        if (!data.userId || !data.username || !data.exp) return null
        if (data.exp < Math.floor(Date.now() / 1000)) return null

        return {
            userId: data.userId,
            username: data.username,
            nickname: data.nickname ?? null,
            headImg: data.headImg ?? null
        }
    } catch {
        return null
    }
}
