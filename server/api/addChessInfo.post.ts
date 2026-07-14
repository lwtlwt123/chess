import type { ResultSetHeader } from 'mysql2'
import db from '../db'
import { withAuthHandler } from '../utils/api'

type Camp = 'red' | 'black'

type AddChessInfoBody = {
  gameId?: number
  stepNo?: number
  camp?: Camp
  pieceId?: string
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
  capturedPieceId?: string | null
}

type GameRow = {
  redUserId: number
  blackUserId: number
  status: 'waiting' | 'playing' | 'finished' | 'cancelled'
}

type ExistingMoveRow = {
  id: number
}

const isBoardCoordinate = (value: unknown, max: number) => {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max
}

export default withAuthHandler(async (event, auth) => {
  const body = await readBody<AddChessInfoBody>(event)
  const pieceId = body.pieceId?.trim()
  const capturedPieceId = body.capturedPieceId?.trim() || null

  if (!Number.isInteger(body.gameId) || Number(body.gameId) <= 0) {
    return { code: 400, message: '对局ID不正确' }
  }

  if (!Number.isInteger(body.stepNo) || Number(body.stepNo) <= 0) {
    return { code: 400, message: '走棋步数不正确' }
  }

  if (body.camp !== 'red' && body.camp !== 'black') {
    return { code: 400, message: '走棋阵营不正确' }
  }

  if (!pieceId || pieceId.length > 32 || (capturedPieceId && capturedPieceId.length > 32)) {
    return { code: 400, message: '棋子ID不正确' }
  }

  if (
    !isBoardCoordinate(body.fromX, 8)
    || !isBoardCoordinate(body.toX, 8)
    || !isBoardCoordinate(body.fromY, 9)
    || !isBoardCoordinate(body.toY, 9)
  ) {
    return { code: 400, message: '棋子坐标不正确' }
  }

  const games = await db.query(
    `SELECT
      red_user_id AS redUserId,
      black_user_id AS blackUserId,
      status
    FROM chess_game
    WHERE id = ?
    LIMIT 1`,
    [body.gameId]
  ) as GameRow[]
  const game = games[0]

  if (!game) {
    return { code: 404, message: '对局不存在' }
  }

  const expectedUserId = body.camp === 'red' ? game.redUserId : game.blackUserId

  if (expectedUserId !== auth.userId) {
    return { code: 403, message: '你不能为该阵营保存走棋记录' }
  }

  if (game.status !== 'playing') {
    return { code: 409, message: '当前对局不能继续走棋' }
  }

  const existingMoves = await db.query(
    'SELECT id FROM chess_move WHERE game_id = ? AND step_no = ? LIMIT 1',
    [body.gameId, body.stepNo]
  ) as ExistingMoveRow[]

  if (existingMoves.length) {
    return { code: 409, message: '该步走棋记录已存在' }
  }

  const result = await db.query(
    `INSERT INTO chess_move (
      game_id,
      step_no,
      camp,
      piece_id,
      from_x,
      from_y,
      to_x,
      to_y,
      captured_piece_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.gameId,
      body.stepNo,
      body.camp,
      pieceId,
      body.fromX,
      body.fromY,
      body.toX,
      body.toY,
      capturedPieceId
    ]
  ) as ResultSetHeader

  return {
    code: 200,
    message: '走棋记录保存成功',
    data: {
      moveId: result.insertId,
      gameId: body.gameId,
      stepNo: body.stepNo
    }
  }
})
