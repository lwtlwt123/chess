import db from '../../db'
import { withAuthHandler } from '../../utils/api'

export default withAuthHandler(async (event, auth) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const games = await db.query(
    `SELECT g.id AS gameId, g.room_id AS roomId, g.round_no AS roundNo,
      g.red_user_id AS redUserId, g.black_user_id AS blackUserId,
      g.winner_user_id AS winnerUserId, g.winner_camp AS winnerCamp,
      g.finish_reason AS finishReason, g.started_at AS startedAt,
      g.finished_at AS finishedAt, g.created_at AS createdAt,
      opponent.userId AS opponentUserId, opponent.username AS opponentUsername,
      opponent.nickName AS opponentNickname, opponent.headImg AS opponentHeadImg
    FROM chess_game AS g
    INNER JOIN users AS opponent ON opponent.userId = CASE
      WHEN g.red_user_id = ? THEN g.black_user_id ELSE g.red_user_id END
    WHERE g.red_user_id = ? OR g.black_user_id = ?
    ORDER BY g.created_at DESC
    LIMIT ? OFFSET ?`,
    [auth.userId, auth.userId, auth.userId, pageSize, offset]
  )

  const summaryRows = await db.query(
    `SELECT COUNT(*) AS total,
      SUM(CASE WHEN winner_user_id = ? THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN winner_user_id IS NOT NULL AND winner_user_id <> ? THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN winner_user_id IS NULL THEN 1 ELSE 0 END) AS draws
    FROM chess_game
    WHERE red_user_id = ? OR black_user_id = ?`,
    [auth.userId, auth.userId, auth.userId, auth.userId]
  ) as Array<{ total: number; wins: number; losses: number; draws: number }>

  const rawSummary = summaryRows[0] || { total: 0, wins: 0, losses: 0, draws: 0 }
  const summary = {
    total: Number(rawSummary.total) || 0,
    wins: Number(rawSummary.wins) || 0,
    losses: Number(rawSummary.losses) || 0,
    draws: Number(rawSummary.draws) || 0
  }

  return { code: 200, message: '查询成功', data: { page, pageSize, userId: auth.userId, summary, games } }
})
