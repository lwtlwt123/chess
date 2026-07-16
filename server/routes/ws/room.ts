import { defineWebSocketHandler } from 'h3'
import { verifyToken, type AuthUser } from '../../utils/token'
import {
  createGame,
  createStartedGame,
  deleteLastMoves,
  finishGame as persistFinishedGame,
  saveMove,
  startGame as persistStartedGame
} from '../../db/gameRepository'

type Camp = 'red' | 'black'

type RoomPlayer = AuthUser & {
  camp: Camp
}

type RoomStatus = 'waiting' | 'playing' | 'finished'
type FinishedReason = 'disconnect' | 'resign' | 'normal'

type RoomState = {
  roomId: string
  createdAt: number
  creator: RoomPlayer
  redPlayer: RoomPlayer | null
  blackPlayer: RoomPlayer | null
  status: RoomStatus
  currentCamp: Camp
  moveIndex: number
  moves: MovePayload[]
  winnerCamp: Camp | null
  finishedReason: FinishedReason | null
  rematchRequestedBy: Camp | null
  rematchRequestedAt: number | null
  readyCamps: Camp[]
  gameId: number | null
  roundNo: number
}

type MovePayload = {
  pieceId: string
  camp: Camp
  fromGridX: number
  fromGridY: number
  toGridX: number
  toGridY: number
  capturedPieceId: string | null
  
}

type ClientMessage =
  | { type: 'createRoom' }
  | { type: 'joinRoom'; roomId?: string }
  | { type: 'confirmReady'; roomId?: string }
  | { type: 'movePiece'; roomId?: string; data?: unknown }
  | { type: 'finishRoom'; roomId?: string; winnerCamp?: unknown }
  | { type: 'resignRoom'; roomId?: string }
  | { type: 'requestDraw'; roomId?: string }
  | { type: 'declineDraw'; roomId?: string }
  | { type: 'requestUndo'; roomId?: string }
  | { type: 'declineUndo'; roomId?: string }
  | { type: 'requestRematch'; roomId?: string }
  | { type: 'declineRematch'; roomId?: string }

const rooms = new Map<string, RoomState>()
const userConnections = new Map<number, Set<unknown>>()
const roomConnections = new Map<string, Map<Camp, Set<unknown>>>()
const disconnectTimers = new Map<string, Map<Camp, {
  expiresAt: number
  timer: ReturnType<typeof setTimeout>
}>>()
const drawRequests = new Map<string, Camp>()
const undoRequests = new Map<string, Camp>()
const DISCONNECT_FORFEIT_DELAY = 60_000

const randomCamp = (): Camp => {
  return Math.random() < 0.5 ? 'red' : 'black'
}

const createRoomId = () => {
  let roomId = ''

  do {
    roomId = String(Math.floor(100000 + Math.random() * 900000))
  } while (rooms.has(roomId))

  return roomId
}

const oppositeCamp = (camp: Camp): Camp => {
  return camp === 'red' ? 'black' : 'red'
}

const assignPlayerCamp = (player: RoomPlayer, camp: Camp): RoomPlayer => {
  return {
    ...player,
    camp
  }
}

const campText = (camp: Camp) => {
  return camp === 'red' ? '红方' : '黑方'
}

const isCamp = (value: unknown): value is Camp => {
  return value === 'red' || value === 'black'
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const getPeerUserId = (peer: unknown) => {
  if (!isRecord(peer) || !isRecord(peer.context)) return null
  if (!isRecord(peer.context.auth)) return null

  const userId = peer.context.auth.userId

  return typeof userId === 'number' ? userId : null
}

const setPeerCamp = (peer: unknown, camp: Camp) => {
  if (!isRecord(peer) || !isRecord(peer.context)) return

  peer.context.camp = camp
}

const isBoardNumber = (value: unknown, max: number) => {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max
}

const isMovePayload = (value: unknown): value is MovePayload => {
  if (!isRecord(value)) return false

  return typeof value.pieceId === 'string'
    && isCamp(value.camp)
    && isBoardNumber(value.fromGridX, 8)
    && isBoardNumber(value.toGridX, 8)
    && isBoardNumber(value.fromGridY, 9)
    && isBoardNumber(value.toGridY, 9)
    && (value.capturedPieceId === null || typeof value.capturedPieceId === 'string')
}

const getUndoMoveCount = (moves: MovePayload[], requesterCamp: Camp) => {
  const lastMove = moves[moves.length - 1]

  if (!lastMove) return 0
  if (lastMove.camp === requesterCamp) return 1

  const requesterLastMove = moves[moves.length - 2]
  return requesterLastMove?.camp === requesterCamp ? 2 : 0
}

const isSendablePeer = (value: unknown): value is { send: (data: unknown) => unknown } => {
  return isRecord(value) && typeof value.send === 'function'
}

const safeSendPayload = (peer: { send: (data: unknown) => unknown }, payload: string) => {
  try {
    peer.send(payload)
    return true
  } catch {
    return false
  }
}

const sendJson = (peer: { send: (data: unknown) => unknown }, data: unknown) => {
  return safeSendPayload(peer, JSON.stringify(data))
}

const broadcastRoom = (roomId: string, data: unknown) => {
  const roomCampConnections = roomConnections.get(roomId)
  const payload = JSON.stringify(data)

  roomCampConnections?.forEach((campConnections) => {
    campConnections.forEach((peer) => {
      if (isSendablePeer(peer)) {
        safeSendPayload(peer, payload)
      }
    })
  })
}

const broadcastRoomCamp = (roomId: string, camp: Camp, data: unknown) => {
  const campConnections = roomConnections.get(roomId)?.get(camp)
  const payload = JSON.stringify(data)

  campConnections?.forEach((peer) => {
    if (isSendablePeer(peer)) {
      safeSendPayload(peer, payload)
    }
  })
}

const broadcastRoomExcept = (roomId: string, excludedPeer: unknown, data: unknown) => {
  const roomCampConnections = roomConnections.get(roomId)
  const payload = JSON.stringify(data)

  roomCampConnections?.forEach((campConnections) => {
    campConnections.forEach((peer) => {
      if (peer !== excludedPeer && isSendablePeer(peer)) {
        safeSendPayload(peer, payload)
      }
    })
  })
}

const sendMoveRejected = (peer: { send: (data: unknown) => unknown }, message: string, code = 400) => {
  sendJson(peer, {
    type: 'moveRejected',
    code,
    message
  })
}

const trackUserConnection = (userId: number, peer: unknown) => {
  let connections = userConnections.get(userId)

  if (!connections) {
    connections = new Set()
    userConnections.set(userId, connections)
  }

  connections.add(peer)
}

const untrackUserConnection = (userId: number, peer: unknown) => {
  const connections = userConnections.get(userId)

  if (!connections) return

  connections.delete(peer)

  if (connections.size === 0) {
    userConnections.delete(userId)
  }
}

const hasUserConnection = (userId: number) => {
  return Boolean(userConnections.get(userId)?.size)
}

const broadcastUser = (userId: number, data: unknown) => {
  const connections = userConnections.get(userId)
  const payload = JSON.stringify(data)

  connections?.forEach((peer) => {
    if (isSendablePeer(peer)) {
      safeSendPayload(peer, payload)
    }
  })
}

const sendRoomStartedToPlayers = (room: RoomState, message: string) => {
  if (room.redPlayer) {
    broadcastUser(room.redPlayer.userId, {
      type: 'roomStarted',
      code: 200,
      message,
      data: {
        ...getRoomPayload(room),
        camp: 'red'
      }
    })
  }

  if (room.blackPlayer) {
    broadcastUser(room.blackPlayer.userId, {
      type: 'roomStarted',
      code: 200,
      message,
      data: {
        ...getRoomPayload(room),
        camp: 'black'
      }
    })
  }
}

const getRoomPayload = (room: RoomState) => ({
  roomId: room.roomId,
  status: room.status,
  currentCamp: room.currentCamp,
  moveIndex: room.moveIndex,
  moves: room.moves,
  creator: {
    userId: room.creator.userId,
    username: room.creator.username,
    nickname: room.creator.nickname,
    headImg: room.creator.headImg,
    camp: room.creator.camp
  },
  redPlayer: room.redPlayer,
  blackPlayer: room.blackPlayer,
  winnerCamp: room.winnerCamp,
  finishedReason: room.finishedReason,
  rematchRequestedBy: room.rematchRequestedBy,
  rematchRequestedAt: room.rematchRequestedAt,
  readyCamps: room.readyCamps,
  gameId: room.gameId,
  roundNo: room.roundNo
})

const findPlayer = (room: RoomState, userId: number) => {
  if (room.redPlayer?.userId === userId) return room.redPlayer
  if (room.blackPlayer?.userId === userId) return room.blackPlayer

  return null
}

const ensureStoredGame = async (room: RoomState) => {
  if (room.gameId) return room.gameId
  if (!room.redPlayer || !room.blackPlayer) return null

  room.gameId = await createGame({
    roomId: room.roomId,
    roundNo: room.roundNo,
    redUserId: room.redPlayer.userId,
    blackUserId: room.blackPlayer.userId
  })
  return room.gameId
}

const trackRoomConnection = (roomId: string, camp: Camp, peer: unknown) => {
  let roomCampConnections = roomConnections.get(roomId)

  if (!roomCampConnections) {
    roomCampConnections = new Map()
    roomConnections.set(roomId, roomCampConnections)
  }

  let campConnections = roomCampConnections.get(camp)

  if (!campConnections) {
    campConnections = new Set()
    roomCampConnections.set(camp, campConnections)
  }

  campConnections.add(peer)
  clearDisconnectTimer(roomId, camp)
}

const untrackRoomConnection = (roomId: string, camp: Camp, peer: unknown) => {
  const roomCampConnections = roomConnections.get(roomId)
  const campConnections = roomCampConnections?.get(camp)

  if (!roomCampConnections || !campConnections) return 0

  campConnections.delete(peer)

  const remainingCampConnections = campConnections.size

  if (remainingCampConnections === 0) {
    roomCampConnections.delete(camp)
  }

  if (roomCampConnections.size === 0) {
    roomConnections.delete(roomId)
  }

  return remainingCampConnections
}

const hasCampConnection = (roomId: string, camp: Camp) => {
  return Boolean(roomConnections.get(roomId)?.get(camp)?.size)
}

const getDisconnectTimerMap = (roomId: string) => {
  let roomTimers = disconnectTimers.get(roomId)

  if (!roomTimers) {
    roomTimers = new Map()
    disconnectTimers.set(roomId, roomTimers)
  }

  return roomTimers
}

const clearDisconnectTimer = (roomId: string, camp: Camp) => {
  const roomTimers = disconnectTimers.get(roomId)
  const timerInfo = roomTimers?.get(camp)

  if (!roomTimers || !timerInfo) return false

  clearTimeout(timerInfo.timer)
  roomTimers.delete(camp)

  if (roomTimers.size === 0) {
    disconnectTimers.delete(roomId)
  }

  return true
}

const clearRoomDisconnectTimers = (roomId: string) => {
  clearDisconnectTimer(roomId, 'red')
  clearDisconnectTimer(roomId, 'black')
}

const clearRematchRequest = (room: RoomState) => {
  room.rematchRequestedBy = null
  room.rematchRequestedAt = null
}

const clearActionRequests = (roomId: string) => {
  drawRequests.delete(roomId)
  undoRequests.delete(roomId)
}

const serializePlayer = (player: RoomPlayer) => ({
  userId: player.userId,
  username: player.username,
  nickname: player.nickname,
  headImg: player.headImg,
  camp: player.camp
})

const reassignRoomConnections = (roomId: string, redPlayer: RoomPlayer, blackPlayer: RoomPlayer) => {
  const roomCampConnections = roomConnections.get(roomId)

  if (!roomCampConnections) return

  const nextConnections = new Map<Camp, Set<unknown>>()

  roomCampConnections.forEach((campConnections) => {
    campConnections.forEach((peer) => {
      const userId = getPeerUserId(peer)
      const camp = userId === redPlayer.userId
        ? 'red'
        : userId === blackPlayer.userId
          ? 'black'
          : null

      if (!camp) return

      setPeerCamp(peer, camp)

      let nextCampConnections = nextConnections.get(camp)

      if (!nextCampConnections) {
        nextCampConnections = new Set()
        nextConnections.set(camp, nextCampConnections)
      }

      nextCampConnections.add(peer)
    })
  })

  if (nextConnections.size) {
    roomConnections.set(roomId, nextConnections)
  } else {
    roomConnections.delete(roomId)
  }
}

const getRematchPlayers = (room: RoomState) => {
  const previousRedPlayer = room.redPlayer
  const previousBlackPlayer = room.blackPlayer

  if (!previousRedPlayer || !previousBlackPlayer) return null

  const firstCamp = randomCamp()
  const firstPlayer = assignPlayerCamp(previousRedPlayer, firstCamp)
  const secondPlayer = assignPlayerCamp(previousBlackPlayer, oppositeCamp(firstCamp))
  const redPlayer = firstPlayer.camp === 'red' ? firstPlayer : secondPlayer
  const blackPlayer = firstPlayer.camp === 'black' ? firstPlayer : secondPlayer
  const creator = room.creator.userId === redPlayer.userId
    ? redPlayer
    : room.creator.userId === blackPlayer.userId
      ? blackPlayer
      : room.creator

  return { redPlayer, blackPlayer, creator }
}

const resetRoomForRematch = async (room: RoomState) => {
  const players = getRematchPlayers(room)

  if (!players) throw new Error('重赛玩家信息不存在')

  const nextRoundNo = room.roundNo + 1
  const gameId = await createStartedGame({
    roomId: room.roomId,
    roundNo: nextRoundNo,
    redUserId: players.redPlayer.userId,
    blackUserId: players.blackPlayer.userId
  })

  room.redPlayer = players.redPlayer
  room.blackPlayer = players.blackPlayer
  room.creator = players.creator
  room.status = 'playing'
  room.currentCamp = 'red'
  room.moveIndex = 0
  room.moves = []
  room.winnerCamp = null
  room.finishedReason = null
  room.readyCamps = ['red', 'black']
  room.roundNo = nextRoundNo
  room.gameId = gameId
  reassignRoomConnections(room.roomId, players.redPlayer, players.blackPlayer)
  clearRoomDisconnectTimers(room.roomId)
  clearRematchRequest(room)
  clearActionRequests(room.roomId)
}

const finishRoom = async (room: RoomState, winnerCamp: Camp | null, reason: FinishedReason, message: string) => {
  if (room.status === 'finished') return

  const winner = winnerCamp === 'red'
    ? room.redPlayer
    : winnerCamp === 'black'
      ? room.blackPlayer
      : null

  if (!room.gameId) throw new Error('对局记录不存在')
  if (winnerCamp && !winner) throw new Error('胜方不存在')

  await persistFinishedGame({
    gameId: room.gameId,
    winnerUserId: winner?.userId ?? null,
    winnerCamp,
    reason
  })

  room.status = 'finished'
  room.winnerCamp = winnerCamp
  room.finishedReason = reason
  clearRematchRequest(room)
  clearActionRequests(room.roomId)
  clearRoomDisconnectTimers(room.roomId)

  broadcastRoom(room.roomId, {
    type: 'roomFinished',
    code: 200,
    message,
    data: getRoomPayload(room)
  })
}

const getRoomAndPlayer = (
  peer: { send: (data: unknown) => unknown; context: Record<string, unknown> },
  data: { roomId?: string }
) => {
  const auth = peer.context.auth as AuthUser
  const roomId = data.roomId?.trim() || (typeof peer.context.roomId === 'string' ? peer.context.roomId : '')

  if (!roomId) {
    sendMoveRejected(peer, '房间号不能为空')
    return null
  }

  const room = rooms.get(roomId)

  if (!room) {
    sendMoveRejected(peer, '房间不存在', 404)
    return null
  }

  const player = findPlayer(room, auth.userId)

  if (!player) {
    sendMoveRejected(peer, '你不在这个房间里', 403)
    return null
  }

  return { roomId, room, player }
}

const getOpponentPlayer = (room: RoomState, camp: Camp) => {
  return camp === 'red' ? room.blackPlayer : room.redPlayer
}

const scheduleDisconnectForfeit = (roomId: string, camp: Camp) => {
  clearDisconnectTimer(roomId, camp)

  const expiresAt = Date.now() + DISCONNECT_FORFEIT_DELAY
  const timer = setTimeout(() => {
    const room = rooms.get(roomId)

    if (!room || room.status !== 'playing' || room.winnerCamp) return
    if (hasCampConnection(roomId, camp)) return

    const winnerCamp = oppositeCamp(camp)

    void finishRoom(
      room,
      winnerCamp,
      'disconnect',
      `${campText(camp)}掉线超时，${campText(winnerCamp)}胜利`
    ).catch((error) => {
      console.error('处理掉线判负失败:', error)
    })
  }, DISCONNECT_FORFEIT_DELAY)

  getDisconnectTimerMap(roomId).set(camp, {
    expiresAt,
    timer
  })

  return expiresAt
}

export default defineWebSocketHandler({
  upgrade(request) {
    const url = new URL(request.url)
    const token = url.searchParams.get('token') || ''
    const auth = token ? verifyToken(token) : null

    if (!auth) {
      return new Response('Unauthorized', { status: 401 })
    }

    request.context.auth = auth
  },

  open(peer) {
    const auth = peer.context.auth as AuthUser

    trackUserConnection(auth.userId, peer)
  },

  message(peer, message) {
    void (async () => {
      let data: ClientMessage

    try {
      data = message.json<ClientMessage>()
    } catch {
      sendJson(peer, {
        type: 'error',
        code: 400,
        message: '消息格式不对'
      })
      return
    }

    if (data.type === 'createRoom') {
      const auth = peer.context.auth as AuthUser
      const roomId = createRoomId()
      const camp = randomCamp()
      const creator: RoomPlayer = { ...auth, camp }

      const room: RoomState = {
        roomId,
        createdAt: Date.now(),
        creator,
        redPlayer: camp === 'red' ? creator : null,
        blackPlayer: camp === 'black' ? creator : null,
        status: 'waiting',
        currentCamp: 'red',
        moveIndex: 0,
        moves: [],
        winnerCamp: null,
        finishedReason: null,
        rematchRequestedBy: null,
        rematchRequestedAt: null,
        readyCamps: [],
        gameId: null,
        roundNo: 1
      }

      rooms.set(roomId, room)

      sendJson(peer, {
        type: 'roomCreated',
        code: 200,
        message: '房间创建成功',
        data: {
          ...getRoomPayload(room),
          camp
        }
      })

      return
    }

    if (data.type === 'joinRoom') {
      const roomId = data.roomId?.trim()
      const auth = peer.context.auth as AuthUser

      if (!roomId) {
        sendJson(peer, {
          type: 'error',
          code: 400,
          message: '房间号不能为空'
        })
        return
      }

      const room = rooms.get(roomId)

      if (!room) {
        sendJson(peer, {
          type: 'error',
          code: 404,
          message: '房间不存在'
        })
        return
      }

      let player = findPlayer(room, auth.userId)

      if (!player) {
        if (room.redPlayer && room.blackPlayer) {
          sendJson(peer, {
            type: 'error',
            code: 409,
            message: '房间已满'
          })
          return
        }

        const camp = room.redPlayer ? 'black' : 'red'

        if (room[camp === 'red' ? 'redPlayer' : 'blackPlayer']) {
          sendJson(peer, {
            type: 'error',
            code: 409,
            message: '房间已满'
          })
          return
        }

        player = { ...auth, camp }

        if (camp === 'red') {
          room.redPlayer = player
        } else {
          room.blackPlayer = player
        }
      }

      peer.context.roomId = roomId
      peer.context.camp = player.camp
      trackRoomConnection(roomId, player.camp, peer)
      peer.subscribe(`room:${roomId}`)

      if (room.status === 'finished') {
        sendJson(peer, {
          type: 'roomFinished',
          code: 200,
          message: room.winnerCamp ? `${campText(room.winnerCamp)}胜利` : '双方和棋',
          data: {
            ...getRoomPayload(room),
            camp: player.camp
          }
        })
        return
      }

      if (room.status === 'playing') {
        sendRoomStartedToPlayers(room, '对局已恢复')
        return
      }

      if (room.redPlayer && room.blackPlayer) {
        try {
          await ensureStoredGame(room)
        } catch (error) {
          console.error('创建对局记录失败:', error)
          sendJson(peer, { type: 'error', code: 500, message: '创建对局记录失败' })
          return
        }

        broadcastRoom(roomId, {
          type: 'roomWaiting',
          code: 200,
          message: '双方已就位，请确认开局',
          data: getRoomPayload(room)
        })
        return
      }

      sendJson(peer, {
        type: 'roomWaiting',
        code: 200,
        message: `等待${oppositeCamp(player.camp) === 'red' ? '红方' : '黑方'}加入`,
        data: {
          ...getRoomPayload(room),
          camp: player.camp
        }
      })

      return
    }

    if (data.type === 'confirmReady') {
      const auth = peer.context.auth as AuthUser
      const roomId = data.roomId?.trim() || (typeof peer.context.roomId === 'string' ? peer.context.roomId : '')
      const room = rooms.get(roomId)

      if (!room) {
        sendJson(peer, { type: 'error', code: 404, message: '房间不存在' })
        return
      }

      const player = findPlayer(room, auth.userId)

      if (!player) {
        sendJson(peer, { type: 'error', code: 403, message: '你不是该房间玩家' })
        return
      }

      if (!room.redPlayer || !room.blackPlayer) {
        sendJson(peer, { type: 'error', code: 409, message: '请等待对手加入' })
        return
      }

      if (room.status !== 'waiting') return

      if (!room.readyCamps.includes(player.camp)) {
        room.readyCamps.push(player.camp)
      }

      if (room.readyCamps.includes('red') && room.readyCamps.includes('black')) {
        const gameId = await ensureStoredGame(room)
        if (!gameId) {
          sendJson(peer, { type: 'error', code: 500, message: '对局记录创建失败' })
          return
        }
        await persistStartedGame(gameId)
        room.status = 'playing'
        sendRoomStartedToPlayers(room, '双方已确认，开始对局')
        return
      }

      broadcastRoom(roomId, {
        type: 'roomWaiting',
        code: 200,
        message: `等待${campText(oppositeCamp(player.camp))}确认开局`,
        data: getRoomPayload(room)
      })
      return
    }

    if (data.type === 'movePiece') {
      const auth = peer.context.auth as AuthUser
      const roomId = data.roomId?.trim() || (typeof peer.context.roomId === 'string' ? peer.context.roomId : '')

      if (!roomId) {
        sendMoveRejected(peer, '房间号不能为空')
        return
      }

      const room = rooms.get(roomId)

      if (!room) {
        sendMoveRejected(peer, '房间不存在', 404)
        return
      }

      const player = findPlayer(room, auth.userId)

      if (!player) {
        sendMoveRejected(peer, '你不在这个房间里', 403)
        return
      }

      if (room.status === 'finished' || room.winnerCamp) {
        sendMoveRejected(peer, '对局已结束')
        return
      }

      if (room.status !== 'playing') {
        sendMoveRejected(peer, '对局还没开始')
        return
      }

      if (!isMovePayload(data.data)) {
        sendMoveRejected(peer, '走棋消息格式不对')
        return
      }

      // if (data.data.camp !== player.camp) {
      //   sendMoveRejected(peer, '不能操作对方棋子', 403)
      //   return
      // }

      // if (room.currentCamp !== player.camp) {
      //   sendMoveRejected(peer, '还没轮到你走棋')
      //   return
      // }

      const move: MovePayload = {
        ...data.data,
        camp: player.camp
      }

      if (!room.gameId) {
        sendMoveRejected(peer, '对局记录不存在')
        return
      }

      const nextMoveIndex = room.moveIndex + 1
      const nextCamp = oppositeCamp(player.camp)

      try {
        await saveMove({
          gameId: room.gameId,
          stepNo: nextMoveIndex,
          nextCamp,
          move
        })
      } catch (error) {
        console.error('保存走棋记录失败:', error)
        sendMoveRejected(peer, '走棋记录保存失败')
        return
      }

      room.moves.push(move)
      room.moveIndex = nextMoveIndex
      room.currentCamp = nextCamp

      peer.context.roomId = roomId
      peer.context.camp = player.camp

      broadcastRoomExcept(roomId, peer, {
        type: 'pieceMoved',
        code: 200,
        message: '对方已落子',
        data: {
          roomId,
          moveIndex: room.moveIndex,
          currentCamp: room.currentCamp,
          move
        }
      })
    }

    if (data.type === 'finishRoom') {
      const auth = peer.context.auth as AuthUser
      const roomId = data.roomId?.trim() || (typeof peer.context.roomId === 'string' ? peer.context.roomId : '')

      if (!roomId) {
        sendMoveRejected(peer, '房间号不能为空')
        return
      }

      const room = rooms.get(roomId)

      if (!room) {
        sendMoveRejected(peer, '房间不存在', 404)
        return
      }

      const player = findPlayer(room, auth.userId)

      if (!player) {
        sendMoveRejected(peer, '你不在这个房间里', 403)
        return
      }

      if (room.status !== 'playing' || room.winnerCamp) {
        return
      }

      if (!isCamp(data.winnerCamp) || data.winnerCamp !== player.camp) {
        sendMoveRejected(peer, '胜负消息格式不对')
        return
      }

      await finishRoom(
        room,
        data.winnerCamp,
        'normal',
        `${campText(data.winnerCamp)}胜利`
      )
    }

    if (data.type === 'resignRoom') {
      const auth = peer.context.auth as AuthUser
      const roomId = data.roomId?.trim() || (typeof peer.context.roomId === 'string' ? peer.context.roomId : '')

      if (!roomId) {
        sendMoveRejected(peer, '房间号不能为空')
        return
      }

      const room = rooms.get(roomId)

      if (!room) {
        sendMoveRejected(peer, '房间不存在', 404)
        return
      }

      const player = findPlayer(room, auth.userId)

      if (!player) {
        sendMoveRejected(peer, '你不在这个房间里', 403)
        return
      }

      if (room.status !== 'playing' || room.winnerCamp) {
        return
      }

      const winnerCamp = oppositeCamp(player.camp)

      await finishRoom(
        room,
        winnerCamp,
        'resign',
        `${campText(player.camp)}退出对局，${campText(winnerCamp)}胜利`
      )
    }

    if (data.type === 'requestDraw') {
      const result = getRoomAndPlayer(peer, data)
      if (!result) return

      const { roomId, room, player } = result

      if (room.status !== 'playing' || room.winnerCamp) {
        sendMoveRejected(peer, '当前不能请求和棋')
        return
      }

      const opponentCamp = oppositeCamp(player.camp)
      const opponentPlayer = getOpponentPlayer(room, player.camp)

      if (!opponentPlayer || !hasUserConnection(opponentPlayer.userId)) {
        sendMoveRejected(peer, '对方不在线，无法请求和棋')
        return
      }

      if (drawRequests.get(roomId) === player.camp) {
        sendMoveRejected(peer, '已发送和棋请求，等待对方确认')
        return
      }

      if (drawRequests.get(roomId) === opponentCamp) {
        clearActionRequests(roomId)
        await finishRoom(room, null, 'normal', '双方同意和棋')
        return
      }

      drawRequests.set(roomId, player.camp)

      broadcastUser(opponentPlayer.userId, {
        type: 'drawInvite',
        code: 200,
        message: `${campText(player.camp)}请求和棋`,
        data: {
          roomId,
          fromCamp: player.camp,
          fromPlayer: serializePlayer(player)
        }
      })

      sendJson(peer, {
        type: 'drawInviteSent',
        code: 200,
        message: '已发送和棋请求'
      })
    }

    if (data.type === 'declineDraw') {
      const result = getRoomAndPlayer(peer, data)
      if (!result) return

      const { roomId, room, player } = result
      const requesterCamp = drawRequests.get(roomId)

      if (!requesterCamp || requesterCamp === player.camp) {
        drawRequests.delete(roomId)
        return
      }

      const requesterPlayer = requesterCamp === 'red' ? room.redPlayer : room.blackPlayer
      drawRequests.delete(roomId)

      if (requesterPlayer) {
        broadcastUser(requesterPlayer.userId, {
          type: 'drawInviteDeclined',
          code: 200,
          message: `${campText(player.camp)}拒绝了和棋`,
          data: { roomId, fromCamp: player.camp }
        })
      }
    }

    if (data.type === 'requestUndo') {
      const result = getRoomAndPlayer(peer, data)
      if (!result) return

      const { roomId, room, player } = result

      if (room.status !== 'playing' || room.winnerCamp) {
        sendMoveRejected(peer, '当前不能请求悔棋')
        return
      }

      if (!room.gameId) {
        sendMoveRejected(peer, '还没有可悔的走棋')
        return
      }

      const opponentCamp = oppositeCamp(player.camp)
      const opponentPlayer = getOpponentPlayer(room, player.camp)

      if (!opponentPlayer || !hasUserConnection(opponentPlayer.userId)) {
        sendMoveRejected(peer, '对方不在线，无法请求悔棋')
        return
      }

      if (undoRequests.get(roomId) === player.camp) {
        sendMoveRejected(peer, '已发送悔棋请求，等待对方确认')
        return
      }

      if (undoRequests.get(roomId) === opponentCamp) {
        const requesterCamp = opponentCamp
        const undoMoveCount = getUndoMoveCount(room.moves, requesterCamp)

        if (undoMoveCount === 0) {
          undoRequests.delete(roomId)
          sendMoveRejected(peer, '还没有可悔的走棋')
          return
        }

        const nextMoveIndex = room.moveIndex - undoMoveCount

        try {
          await deleteLastMoves({
            gameId: room.gameId,
            fromStepNo: nextMoveIndex + 1,
            nextCamp: requesterCamp
          })
        } catch (error) {
          console.error('删除悔棋记录失败:', error)
          sendMoveRejected(peer, '悔棋记录保存失败')
          return
        }

        room.moves.splice(-undoMoveCount, undoMoveCount)
        room.moveIndex = nextMoveIndex
        room.currentCamp = requesterCamp
        clearActionRequests(roomId)

        broadcastRoom(roomId, {
          type: 'undoAccepted',
          code: 200,
          message: `双方同意悔棋，已撤回${undoMoveCount}步`,
          data: getRoomPayload(room)
        })
        return
      }

      if (getUndoMoveCount(room.moves, player.camp) === 0) {
        sendMoveRejected(peer, '还没有可悔的走棋')
        return
      }

      undoRequests.set(roomId, player.camp)

      broadcastUser(opponentPlayer.userId, {
        type: 'undoInvite',
        code: 200,
        message: `${campText(player.camp)}请求悔棋`,
        data: {
          roomId,
          fromCamp: player.camp,
          fromPlayer: serializePlayer(player)
        }
      })

      sendJson(peer, {
        type: 'undoInviteSent',
        code: 200,
        message: '已发送悔棋请求'
      })
    }

    if (data.type === 'declineUndo') {
      const result = getRoomAndPlayer(peer, data)
      if (!result) return

      const { roomId, room, player } = result
      const requesterCamp = undoRequests.get(roomId)

      if (!requesterCamp || requesterCamp === player.camp) {
        undoRequests.delete(roomId)
        return
      }

      const requesterPlayer = requesterCamp === 'red' ? room.redPlayer : room.blackPlayer
      undoRequests.delete(roomId)

      if (requesterPlayer) {
        broadcastUser(requesterPlayer.userId, {
          type: 'undoInviteDeclined',
          code: 200,
          message: `${campText(player.camp)}拒绝了悔棋`,
          data: { roomId, fromCamp: player.camp }
        })
      }
    }

    if (data.type === 'requestRematch') {
      const auth = peer.context.auth as AuthUser
      const roomId = data.roomId?.trim() || (typeof peer.context.roomId === 'string' ? peer.context.roomId : '')

      if (!roomId) {
        sendMoveRejected(peer, '房间号不能为空')
        return
      }

      const room = rooms.get(roomId)

      if (!room) {
        sendMoveRejected(peer, '房间不存在', 404)
        return
      }

      const player = findPlayer(room, auth.userId)

      if (!player) {
        sendMoveRejected(peer, '你不在这个房间里', 403)
        return
      }

      if (room.status !== 'finished') {
        sendMoveRejected(peer, '对局还没结束')
        return
      }

      const opponentCamp = oppositeCamp(player.camp)
      const opponentPlayer = opponentCamp === 'red' ? room.redPlayer : room.blackPlayer

      if (!opponentPlayer || !hasUserConnection(opponentPlayer.userId)) {
        sendMoveRejected(peer, '对方不在线，无法邀请再来一局')
        return
      }

      if (room.rematchRequestedBy === player.camp) {
        sendMoveRejected(peer, '已发送邀请，等待对方确认')
        return
      }

      if (room.rematchRequestedBy === opponentCamp) {
        try {
          await resetRoomForRematch(room)
        } catch (error) {
          console.error('重新开始对局失败:', error)
          clearRematchRequest(room)
          sendMoveRejected(peer, '重新开始失败，请重试')
          broadcastUser(opponentPlayer.userId, {
            type: 'rematchInviteCanceled',
            code: 500,
            message: '重新开始失败，请重试',
            data: { roomId }
          })
          return
        }

        sendRoomStartedToPlayers(room, '双方已重新开始')
        return
      }

      room.rematchRequestedBy = player.camp
      room.rematchRequestedAt = Date.now()

      broadcastUser(opponentPlayer.userId, {
        type: 'rematchInvite',
        code: 200,
        message: `${campText(player.camp)}邀请你再来一局`,
        data: {
          roomId,
          fromCamp: player.camp,
          fromPlayer: {
            userId: player.userId,
            username: player.username,
            nickname: player.nickname,
            headImg: player.headImg,
            camp: player.camp
          },
          requestedAt: room.rematchRequestedAt
        }
      })

      sendJson(peer, {
        type: 'rematchInviteSent',
        code: 200,
        message: '已发送再来一局邀请'
      })
    }

    if (data.type === 'declineRematch') {
      const auth = peer.context.auth as AuthUser
      const roomId = data.roomId?.trim() || (typeof peer.context.roomId === 'string' ? peer.context.roomId : '')

      if (!roomId) {
        sendMoveRejected(peer, '房间号不能为空')
        return
      }

      const room = rooms.get(roomId)

      if (!room) {
        sendMoveRejected(peer, '房间不存在', 404)
        return
      }

      const player = findPlayer(room, auth.userId)

      if (!player) {
        sendMoveRejected(peer, '你不在这个房间里', 403)
        return
      }

      if (room.status !== 'finished') {
        return
      }

      if (!room.rematchRequestedBy || room.rematchRequestedBy === player.camp) {
        clearRematchRequest(room)
        return
      }

      const requesterCamp = room.rematchRequestedBy
      const requesterPlayer = requesterCamp === 'red' ? room.redPlayer : room.blackPlayer

      clearRematchRequest(room)

      if (requesterPlayer) {
        broadcastUser(requesterPlayer.userId, {
          type: 'rematchInviteDeclined',
          code: 200,
          message: `${campText(player.camp)}拒绝了再来一局`,
          data: {
            roomId,
            fromCamp: player.camp
          }
        })
      }
    }
    })().catch((error) => {
      console.error('处理房间消息失败:', error)
      sendMoveRejected(peer, '服务器处理失败，请重试', 500)
    })
  },

  close(peer) {
    const auth = peer.context.auth as AuthUser | undefined

    if (auth?.userId) {
      untrackUserConnection(auth.userId, peer)
    }

    const roomId = typeof peer.context.roomId === 'string' ? peer.context.roomId : ''
    const camp = isCamp(peer.context.camp) ? peer.context.camp : null

    if (!roomId || !camp) return

    const remainingCampConnections = untrackRoomConnection(roomId, camp, peer)

    if (remainingCampConnections > 0) return

    const room = rooms.get(roomId)

    if (!room) return

    if (room.status !== 'playing') return

    const expiresAt = scheduleDisconnectForfeit(roomId, camp)

    broadcastRoom(roomId, {
      type: 'opponentLeft',
      code: 200,
      message: `${campText(camp)}离开了页面`,
      data: {
        roomId,
        camp,
        expiresAt
      }
    })
  }
})
