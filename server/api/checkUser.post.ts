import db from '../db'
import { withApiHandler } from '../utils/api'

type CheckUserBody = {
    userName?: string
}

type UserRow = {
    userId: number
    username: string
}

export default withApiHandler(async event => {
    const body = await readBody<CheckUserBody>(event)
    const userName = body.userName?.trim()

    if (!userName) {
        return {
            code: 400,
            message: '账号不能为空'
        }
    }

    const rows = await db.query(
        'SELECT userId, username FROM users WHERE username = ? LIMIT 1',
        [userName]
    ) as UserRow[]

    const user = rows[0]

    return {
        code: 200,
        message: user ? '账号已存在' : '账号可注册',
        data: {
            exists: Boolean(user),
            user: user
                ? {
                    userId: user.userId,
                    username: user.username
                }
                : null
        }
    }
})
