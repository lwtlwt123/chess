import bcrypt from 'bcryptjs'
import type { ResultSetHeader } from 'mysql2'
import db from '../db'
import { withApiHandler } from '../utils/api'
import { createToken } from '../utils/token'

type RegisterBody = {
    userName?: string
    password?: string
}

type UserRow = {
    userId: number
    username: string
}

export default withApiHandler(async event => {
    const body = await readBody<RegisterBody>(event)
    const userName = body.userName?.trim()
    const password = body.password?.trim()

    if (!userName || !password) {
        return {
            code: 400,
            message: '账号或密码不能为空'
        }
    }

    const users = await db.query(
        'SELECT userId, username FROM users WHERE username = ? LIMIT 1',
        [userName]
    ) as UserRow[]

    if (users.length) {
        return {
            code: 409,
            message: '账号已存在'
        }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await db.query(
        'INSERT INTO users (username, passwordHash) VALUES (?, ?)',
        [userName, passwordHash]
    ) as ResultSetHeader

    return {
        code: 200,
        message: '注册成功',
        data: {
            userId: result.insertId,
            username: userName,
            nickname: null,
            headImg: null,
            token: createToken({
                userId: result.insertId,
                username: userName,
                nickname: null,
                headImg: null
            })
        }
    }
})
