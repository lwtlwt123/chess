import type { PoolConnection, ResultSetHeader } from 'mysql2/promise'
import { db } from './index'

export type GameCamp = 'red' | 'black'
export type GameFinishReason = 'normal' | 'resign' | 'disconnect'

export type StoredMove = {
  pieceId: string
  camp: GameCamp
  fromGridX: number
  fromGridY: number
  toGridX: number
  toGridY: number
  capturedPieceId: string | null
}

export const createGame = async (input: {
  roomId: string
  roundNo: number
  redUserId: number
  blackUserId: number
}) => {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO chess_game (
      room_id, round_no, red_user_id, black_user_id, status, current_camp
    ) VALUES (?, ?, ?, ?, 'waiting', 'red')`,
    [input.roomId, input.roundNo, input.redUserId, input.blackUserId]
  )

  return result.insertId
}

export const startGame = async (gameId: number) => {
  await db.execute(
    `UPDATE chess_game
      SET status = 'playing', current_camp = 'red', started_at = COALESCE(started_at, NOW())
      WHERE id = ?`,
    [gameId]
  )
}

export const saveMove = async (input: {
  gameId: number
  stepNo: number
  nextCamp: GameCamp
  move: StoredMove
}) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    await insertMove(connection, input)
    await connection.execute(
      'UPDATE chess_game SET current_camp = ? WHERE id = ? AND status = \'playing\'',
      [input.nextCamp, input.gameId]
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

const insertMove = async (connection: PoolConnection, input: {
  gameId: number
  stepNo: number
  move: StoredMove
}) => {
  const { move } = input

  await connection.execute(
    `INSERT INTO chess_move (
      game_id, step_no, camp, piece_id,
      from_x, from_y, to_x, to_y, captured_piece_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.gameId,
      input.stepNo,
      move.camp,
      move.pieceId,
      move.fromGridX,
      move.fromGridY,
      move.toGridX,
      move.toGridY,
      move.capturedPieceId
    ]
  )
}

export const finishGame = async (input: {
  gameId: number
  winnerUserId: number
  winnerCamp: GameCamp
  reason: GameFinishReason
}) => {
  await db.execute(
    `UPDATE chess_game
      SET status = 'finished', winner_user_id = ?, winner_camp = ?,
          finish_reason = ?, finished_at = NOW()
      WHERE id = ? AND status <> 'finished'`,
    [input.winnerUserId, input.winnerCamp, input.reason, input.gameId]
  )
}
