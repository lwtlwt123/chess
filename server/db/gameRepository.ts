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

const TRANSIENT_DB_ERROR_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST'
])

const withTransientDbRetry = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation()
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''

    if (!TRANSIENT_DB_ERROR_CODES.has(code)) throw error
    return operation()
  }
}

export const createGame = async (input: {
  roomId: string
  roundNo: number
  redUserId: number
  blackUserId: number
}) => {
  const execute = () => db.execute<ResultSetHeader>(
    `INSERT INTO chess_game (
      room_id, round_no, red_user_id, black_user_id, status, current_camp
    ) VALUES (?, ?, ?, ?, 'waiting', 'red')
    ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [input.roomId, input.roundNo, input.redUserId, input.blackUserId]
  )

  const [result] = await withTransientDbRetry(execute)
  return result.insertId
}

export const startGame = async (gameId: number) => {
  await withTransientDbRetry(() => db.execute(
    `UPDATE chess_game
      SET status = 'playing', current_camp = 'red', started_at = COALESCE(started_at, NOW())
      WHERE id = ?`,
    [gameId]
  ))
}

export const createStartedGame = async (input: {
  roomId: string
  roundNo: number
  redUserId: number
  blackUserId: number
}) => {
  const execute = () => db.execute<ResultSetHeader>(
    `INSERT INTO chess_game (
      room_id, round_no, red_user_id, black_user_id,
      status, current_camp, started_at
    ) VALUES (?, ?, ?, ?, 'playing', 'red', NOW())
    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id),
      red_user_id = VALUES(red_user_id),
      black_user_id = VALUES(black_user_id),
      status = 'playing',
      current_camp = 'red',
      winner_user_id = NULL,
      winner_camp = NULL,
      finish_reason = NULL,
      finished_at = NULL,
      started_at = COALESCE(started_at, NOW())`,
    [input.roomId, input.roundNo, input.redUserId, input.blackUserId]
  )

  const [result] = await withTransientDbRetry(execute)
  return result.insertId
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

export const deleteLastMoves = async (input: {
  gameId: number
  fromStepNo: number
  nextCamp: GameCamp
}) => {
  const connection = await db.getConnection()

  try {
    await connection.beginTransaction()
    await connection.execute(
      'DELETE FROM chess_move WHERE game_id = ? AND step_no >= ?',
      [input.gameId, input.fromStepNo]
    )
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
  winnerUserId: number | null
  winnerCamp: GameCamp | null
  reason: GameFinishReason
}) => {
  await withTransientDbRetry(() => db.execute(
    `UPDATE chess_game
      SET status = 'finished', winner_user_id = ?, winner_camp = ?,
          finish_reason = ?, finished_at = NOW()
      WHERE id = ? AND status <> 'finished'`,
    [input.winnerUserId, input.winnerCamp, input.reason, input.gameId]
  ))
}
