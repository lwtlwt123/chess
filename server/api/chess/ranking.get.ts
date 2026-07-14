import db from '../../db'
import { withAuthHandler } from '../../utils/api'

type RankingRow = {
  userId: number
  username: string
  nickname: string | null
  headImg: string | null
  total: number
  wins: number
  losses: number
  draws: number
}

export default withAuthHandler(async (event, auth) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const rows = await db.query(
    `SELECT u.userId, u.username, u.nickName AS nickname, u.headImg,
      COUNT(p.gameId) AS total,
      SUM(CASE WHEN p.winnerUserId = u.userId THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN p.winnerUserId IS NOT NULL AND p.winnerUserId <> u.userId THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN p.winnerUserId IS NULL THEN 1 ELSE 0 END) AS draws
    FROM users AS u
    LEFT JOIN (
      SELECT id AS gameId, red_user_id AS userId, winner_user_id AS winnerUserId
      FROM chess_game
      WHERE status = 'finished'
      UNION ALL
      SELECT id AS gameId, black_user_id AS userId, winner_user_id AS winnerUserId
      FROM chess_game
      WHERE status = 'finished'
    ) AS p ON p.userId = u.userId
    GROUP BY u.userId, u.username, u.nickName, u.headImg
    ORDER BY wins DESC, (wins / NULLIF(total, 0)) DESC, total DESC, u.userId ASC
    LIMIT ? OFFSET ?`,
    [pageSize, offset]
  ) as RankingRow[]

  const totalRows = await db.query(
    'SELECT COUNT(*) AS total FROM users'
  ) as Array<{ total: number }>

  const allRows = await db.query(
    `SELECT u.userId,
      COUNT(p.gameId) AS total,
      SUM(CASE WHEN p.winnerUserId = u.userId THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN p.winnerUserId IS NOT NULL AND p.winnerUserId <> u.userId THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN p.winnerUserId IS NULL THEN 1 ELSE 0 END) AS draws
    FROM users AS u
    LEFT JOIN (
      SELECT id AS gameId, red_user_id AS userId, winner_user_id AS winnerUserId
      FROM chess_game
      WHERE status = 'finished'
      UNION ALL
      SELECT id AS gameId, black_user_id AS userId, winner_user_id AS winnerUserId
      FROM chess_game
      WHERE status = 'finished'
    ) AS p ON p.userId = u.userId
    GROUP BY u.userId
    ORDER BY wins DESC, (wins / NULLIF(total, 0)) DESC, total DESC, u.userId ASC`
  ) as RankingRow[]

  const list = rows.map((row, index) => {
    const total = Number(row.total) || 0
    const wins = Number(row.wins) || 0
    const losses = Number(row.losses) || 0
    const draws = Number(row.draws) || 0

    return {
      rank: offset + index + 1,
      userId: row.userId,
      username: row.username,
      nickname: row.nickname,
      headImg: row.headImg,
      total,
      wins,
      losses,
      draws,
      winRate: total ? Math.round(wins / total * 100) : 0
    }
  })

  const myRankIndex = allRows.findIndex(row => row.userId === auth.userId)
  const myRaw = myRankIndex >= 0 ? allRows[myRankIndex] : null
  const myTotal = Number(myRaw?.total) || 0
  const myWins = Number(myRaw?.wins) || 0
  const myLosses = Number(myRaw?.losses) || 0
  const myDraws = Number(myRaw?.draws) || 0
  const myRanking = myRaw
    ? {
        rank: myRankIndex + 1,
        userId: auth.userId,
        username: auth.username,
        nickname: auth.nickname,
        headImg: auth.headImg,
        total: myTotal,
        wins: myWins,
        losses: myLosses,
        draws: myDraws,
        winRate: myTotal ? Math.round(myWins / myTotal * 100) : 0
      }
    : null

  return {
    code: 200,
    message: '查询成功',
    data: {
      page,
      pageSize,
      total: Number(totalRows[0]?.total) || 0,
      myRanking,
      list
    }
  }
})
