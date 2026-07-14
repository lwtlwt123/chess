import db from '../../db'
import { withAuthHandler } from '../../utils/api'

type GameRow = {
  gameId: number
  roomId: string
  roundNo: number
  redUserId: number
  blackUserId: number
  status: string
  winnerUserId: number | null
  winnerCamp: 'red' | 'black' | null
  finishReason: string | null
  startedAt: Date | null
  finishedAt: Date | null
  redUsername: string
  redNickname: string | null
  redHeadImg: string | null
  blackUsername: string
  blackNickname: string | null
  blackHeadImg: string | null
}

export default withAuthHandler(async (event, auth) => {
  const gameId = Number(getQuery(event).gameId)
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return { code: 400, message: '对局ID不正确' }
  }

  const games = await db.query(
    `SELECT g.id AS gameId, g.room_id AS roomId, g.round_no AS roundNo,
      g.red_user_id AS redUserId, g.black_user_id AS blackUserId,
      g.status, g.winner_user_id AS winnerUserId, g.winner_camp AS winnerCamp,
      g.finish_reason AS finishReason, g.started_at AS startedAt, g.finished_at AS finishedAt,
      red_user.username AS redUsername, red_user.nickName AS redNickname,
      red_user.headImg AS redHeadImg,
      black_user.username AS blackUsername, black_user.nickName AS blackNickname,
      black_user.headImg AS blackHeadImg
    FROM chess_game AS g
    INNER JOIN users AS red_user ON red_user.userId = g.red_user_id
    INNER JOIN users AS black_user ON black_user.userId = g.black_user_id
    WHERE g.id = ?
    LIMIT 1`,
    [gameId]
  ) as GameRow[]
  const game = games[0]

  if (!game) return { code: 404, message: '对局不存在' }
  if (game.redUserId !== auth.userId && game.blackUserId !== auth.userId) {
    return { code: 403, message: '无权查看该局复盘' }
  }

  const moves = await db.query(
    `SELECT step_no AS stepNo, camp, piece_id AS pieceId,
      from_x AS fromGridX, from_y AS fromGridY,
      to_x AS toGridX, to_y AS toGridY,
      captured_piece_id AS capturedPieceId, created_at AS createdAt
    FROM chess_move WHERE game_id = ? ORDER BY step_no ASC`,
    [gameId]
  )

  const gameData = {
    gameId: game.gameId,
    roomId: game.roomId,
    roundNo: game.roundNo,
    status: game.status,
    winnerUserId: game.winnerUserId,
    winnerCamp: game.winnerCamp,
    finishReason: game.finishReason,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    redPlayer: {
      userId: game.redUserId,
      username: game.redUsername,
      nickname: game.redNickname,
      headImg: game.redHeadImg
    },
    blackPlayer: {
      userId: game.blackUserId,
      username: game.blackUsername,
      nickname: game.blackNickname,
      headImg: game.blackHeadImg
    }
  }

  return { code: 200, message: '查询成功', data: { game: gameData, moves } }
})
