import bcrypt from 'bcryptjs'
import db from '../db'
import { withApiHandler } from '../utils/api'
import { createToken } from '../utils/token'

type LoginBody = {
    userName?: string,
    password?: string
}

type UserRow = {
    userId: number
    username: string
    nickname: string | null
    headImg: string | null
    passwordHash: string
}

export default withApiHandler(async event => {
    const body = await readBody<LoginBody>(event)
    const userName = body.userName?.trim()
    const password = body.password?.trim()
    if (!userName || !password) {
        return {
            code: 400,
            message: '账号或密码不能为空'
        }
    }
    const rows = await db.query(
        'SELECT userId, username, nickName AS nickname, headImg, passwordHash FROM users WHERE username = ? LIMIT 1',
        [userName]
    ) as UserRow[]

    const user = rows[0]

    if (!user) {
        return {
            code: 401,
            message: '账号不存在，请点击注册'
        }
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)

    if (!isMatch) {
        return {
            code: 401,
            message: '账号或密码错误'
        }
    }

    return {
        code: 200,
        message: '登录成功',
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
