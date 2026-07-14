import type { ResultSetHeader } from 'mysql2'
import db from '../db'
import { withAuthHandler } from '../utils/api'
import { createToken } from '../utils/token'

type EditNameBody = {
    id?: unknown
    userId?: unknown
    name?: unknown
    newName?: unknown
    nickname?: unknown
    nickName?: unknown
}

type UserRow = {
    userId: number
    username: string
    nickname: string | null
    headImg: string | null
}

export default withAuthHandler(async (event, auth) => {
    const body = await readBody<EditNameBody>(event)
    const rawUserId = body.userId ?? body.id
    const userId = Number(String(rawUserId ?? '').trim())
    const rawNickname = body.nickname ?? body.nickName ?? body.name ?? body.newName
    const nickname = String(rawNickname ?? '').trim()

    if (!Number.isInteger(userId) || userId <= 0) {
        return {
            code: 400,
            message: '用户ID不能为空'
        }
    }

    if (userId !== auth.userId) {
        return {
            code: 403,
            message: '不能修改其他用户信息'
        }
    }

    if (!nickname) {
        return {
            code: 400,
            message: '昵称不能为空'
        }
    }

    if (nickname.length > 20) {
        return {
            code: 400,
            message: '昵称不能超过7个字符'
        }
    }

    const updateResult = await db.query(
        'UPDATE users SET nickName = ? WHERE userId = ?',
        [nickname, userId]
    ) as ResultSetHeader

    if (!updateResult.affectedRows) {
        return {
            code: 404,
            message: '用户不存在'
        }
    }

    const rows = await db.query(
        'SELECT userId, username, nickName AS nickname, headImg FROM users WHERE userId = ? LIMIT 1',
        [userId]
    ) as UserRow[]
    const user = rows[0]

    if (!user) {
        return {
            code: 404,
            message: '用户不存在'
        }
    }

    return {
        code: 200,
        message: '修改成功',
        data: {
            userId: user.userId,
            username: user.username,
            nickname: user.nickname,
            headImg: user.headImg,
            token: createToken({
                userId: user.userId,
                username: user.username,
                nickname: user.nickname,
                headImg: user.headImg
            })
        }
    }
})
