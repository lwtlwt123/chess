import db from '../db'
// import { withApiHandler } from '../utils/api'
import { withAuthHandler } from '../utils/api'

type UserRow = {
    userId: number
    username: string
    nickname: string | null
    headImg: string | null
}

const getQueryValue = (value: unknown) => {
    return Array.isArray(value) ? value[0] : value
}

export default withAuthHandler(async event => {
    const query = getQuery(event)
    const rawId = getQueryValue(query.id ?? query.userId)
    const userId = Number(rawId)

    if (!rawId || !Number.isInteger(userId) || userId <= 0) {
        return {
            code: 400,
            message: '用户ID不能为空'
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
        message: '查询成功',
        data: {
            userId: user.userId,
            username: user.username,
            nickname: user.nickname,
            headImg: user.headImg
        }
    }
})
