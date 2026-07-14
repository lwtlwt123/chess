<template>
  <div class="gameCenter" :style="gameCenterStyle">
    <div v-if="roomPhase !== 'playing'" class="roomOverlay">
      <div class="roomOverlay__panel" :class="`roomOverlay__panel--${roomPhase}`">
        <button class="roomOverlay__close" type="button" aria-label="关闭" title="关闭" @click="closeRoomOverlay" />
        <div class="roomOverlay__title">{{ overlayTitle }}</div>

        <div v-if="myPlayerInfo" class="roomOverlay__players">
          <div class="roomOverlay__player roomOverlay__player--ready">
            <span class="roomOverlay__tag">我方 · {{ campText(myPlayerInfo.camp) }}</span>
            <img :src="playerAvatar(myPlayerInfo)" alt="" class="roomOverlay__avatar">
            <div class="roomOverlay__name">{{ playerName(myPlayerInfo) }}</div>
            <div class="roomOverlay__id">ID:{{ playerId(myPlayerInfo) }}</div>
            <span class="roomOverlay__ready">{{ myReady ? '已确认' : '已就位' }}</span>
          </div>

          <span class="roomOverlay__versus">VS</span>

          <div v-if="opponentInfo" class="roomOverlay__player roomOverlay__player--ready">
            <span class="roomOverlay__tag">对方 · {{ campText(opponentInfo.camp) }}</span>
            <img :src="playerAvatar(opponentInfo)" alt="" class="roomOverlay__avatar">
            <div class="roomOverlay__name">{{ playerName(opponentInfo) }}</div>
            <div class="roomOverlay__id">ID:{{ playerId(opponentInfo) }}</div>
            <span class="roomOverlay__ready">{{ opponentReady ? '已确认' : '已加入' }}</span>
          </div>
          <div v-else class="roomOverlay__player roomOverlay__player--empty">
            <span class="roomOverlay__tag">对方</span>
            <div class="roomOverlay__emptyAvatar">?</div>
            <div class="roomOverlay__emptyName">等待加入</div>
            <div class="roomOverlay__waitingDots" aria-hidden="true"><i></i><i></i><i></i></div>
          </div>
        </div>

        <div class="roomOverlay__message">{{ overlayMessage }}</div>

        <button v-if="canConfirmReady" class="roomOverlay__confirm" type="button" :disabled="myReady"
          @click="confirmReady">
          {{ myReady ? '已确认，等待对方' : '确认开局' }}
        </button>

        <div v-if="roomPhase === 'loading'" class="roomOverlay__loading roomOverlay__loading--countdown"
          aria-live="assertive">
          <span class="roomOverlay__countdown-label">准备开始</span>
          <strong :key="startCountdown" class="roomOverlay__countdown-number">{{ startCountdown }}</strong>
        </div>
        <div v-else-if="roomPhase !== 'error' && !canConfirmReady" class="roomOverlay__loading" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <button v-if="roomLabel" class="roomOverlay__roomId" type="button" @click="copyRoomId">
          <span class="roomOverlay__roomIdText">房间号 {{ roomLabel }}</span>
          <span class="roomOverlay__copyHint">点击复制</span>
        </button>
      </div>
    </div>
    <div class="quit" @click="quitFn">
      <img :src="assetUrl(assetPaths.lobby.quit)" alt="退出">
    </div>

    <div v-show="roomPhase === 'playing' && !winnerCamp" class="status" :class="`status--${turnStatusTone}`">
      <img :src="turnStatusAvatar" alt="" class="status__icon">
      <span class="status__text">{{ statusText }}</span>
    </div>

    <button v-show="roomPhase === 'playing'" class="bgm-toggle" type="button" aria-label="声音开关" @click="toggleBgm">
      <img :src="soundIconUrl" alt="" class="bgm-toggle__icon">
    </button>

    <!-- 棋盘画布：绘制和点击逻辑都在 useChessBoard 里处理 -->
    <div class="board">
      <ChessBoardCanvas ref="boardRef" :player-camp="myCamp" :active="isBoardActive" @move="sendRoomMove"
        @finish="sendRoomFinish" />
    </div>

    <!-- 胜利失败弹出框 -->
    <div class="gameStatus" v-show="winnerCamp">
      <GameVictory v-show="isWinnerView" @retry="requestRematch" @review="openReview" :roomId="roomId" />
      <GameDefeat v-show="!isWinnerView" @retry="requestRematch" @review="openReview" :roomId="roomId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { assetPaths } from '~/constants/assetPaths'
import { chessAssets, type Camp } from '~/data/chessPieceData'
import { toCssUrl, useAssetUrl } from '~/composables/useAssetUrl'
import { getAuthStorage, getAuthToken } from '~/utils/auth'
import type { ChessMovePayload } from '~/composables/useChessBoard'
import ChessBoardCanvas from '~/components/game/ChessBoardCanvas.vue'

type RoomPhase = 'connecting' | 'waiting' | 'loading' | 'playing' | 'error'
type FinishedReason = 'disconnect' | 'resign' | 'normal'

type RoomPlayer = {
  userId: number
  username: string
  nickname: string | null
  headImg: string | null
  camp: Camp
}

type RoomData = {
  roomId: string
  status: 'waiting' | 'playing' | 'finished'
  currentCamp: Camp
  moveIndex: number
  moves: ChessMovePayload[]
  creator: RoomPlayer
  redPlayer: RoomPlayer | null
  blackPlayer: RoomPlayer | null
  winnerCamp: Camp | null
  finishedReason: FinishedReason | null
  rematchRequestedBy?: Camp | null
  rematchRequestedAt?: number | null
  readyCamps?: Camp[]
  gameId?: number | null
  roundNo?: number
  camp?: Camp
}

type RoomSocketMessage =
  | {
    type: 'roomWaiting' | 'roomStarted'
    code: number
    message: string
    data: RoomData
  }
  | {
    type: 'pieceMoved'
    code: number
    message: string
    data: {
      roomId: string
      moveIndex: number
      currentCamp: Camp
      move: ChessMovePayload
    }
  }
  | {
    type: 'moveRejected'
    code: number
    message: string
  }
  | {
    type: 'opponentLeft'
    code: number
    message: string
    data: {
      roomId: string
      camp: Camp
      expiresAt: number
    }
  }
  | {
    type: 'rematchInvite'
    code: number
    message: string
    data: {
      roomId: string
      fromCamp: Camp
      fromPlayer: RoomPlayer
      requestedAt: number
    }
  }
  | {
    type: 'rematchInviteSent'
    code: number
    message: string
  }
  | {
    type: 'rematchInviteDeclined'
    code: number
    message: string
    data: {
      roomId: string
      fromCamp: Camp
    }
  }
  | {
    type: 'rematchInviteCanceled'
    code: number
    message: string
    data: {
      roomId: string
    }
  }
  | {
    type: 'roomFinished'
    code: number
    message: string
    data: RoomData & {
      winnerCamp: Camp
    }
  }
  | {
    type: 'error'
    code: number
    message: string
  }

const route = useRoute()
const boardRef = ref<InstanceType<typeof ChessBoardCanvas> | null>(null)
const isBgmPlaying = ref(false)
const roomData = ref<RoomData | null>(null)
const roomMessage = ref('')
const roomSocket = ref<WebSocket | null>(null)
const roomMoves = ref<ChessMovePayload[]>([])
const isBoardSynced = ref(false)
const localPlayer = ref<RoomPlayer | null>(null)
const disconnectExpiresAt = ref<number | null>(null)
const disconnectNow = ref(Date.now())
const rematchRequested = ref(false)
const startCountdown = ref(3)
const isRematchPromptOpen = ref(false)
const { $audio } = useNuxtApp()
const assetUrl = useAssetUrl()

const roomId = computed(() => {
  return typeof route.query.roomId === 'string' ? route.query.roomId : ''
})

const routeCamp = computed<Camp | null>(() => {
  return route.query.camp === 'red' || route.query.camp === 'black'
    ? route.query.camp
    : null
})

const myCamp = ref<Camp | null>(routeCamp.value)
const roomPhase = ref<RoomPhase>(roomId.value ? 'connecting' : 'playing')
const isBoardActive = computed(() => roomPhase.value === 'playing')

let enterBoardTimer: number | null = null
let startCountdownTimer: number | null = null
let isEnterDelayDone = false
let disconnectCountdownTimer: number | null = null
let rematchPromptSeq = 0

const playBgm = () => {
  $audio.stop('chess_bgm')
  $audio.play('bgm', { loop: true })
  isBgmPlaying.value = true
}

const stopBgm = () => {
  $audio.stop('bgm')
  isBgmPlaying.value = false
}

const startGameBgm = () => {
  $audio.stop('chess_bgm')
  playBgm()
}

const toggleBgm = () => {
  if (isBgmPlaying.value) {
    stopBgm()
    return
  }

  $audio.unlock()
  playBgm()
}

const campText = (camp: Camp) => {
  return camp === 'red' ? '红方' : '黑方'
}

const soundIconUrl = computed(() => {
  return isBgmPlaying.value
    ? assetUrl(assetPaths.lobby.voice)
    : assetUrl(assetPaths.lobby.noVoice)
})

const turnStatusText = computed(() => {
  if (winnerCamp.value) return `${campText(winnerCamp.value)}胜利`
  if (checkedCamp.value) return checkedCamp.value === myCamp.value ? '我方被将军' : '对方被将军'

  return currentCamp.value === myCamp.value ? '我方走棋' : '对方走棋'
})

const turnStatusTone = computed(() => {
  if (winnerCamp.value) return winnerCamp.value
  if (checkedCamp.value) return checkedCamp.value

  return currentCamp.value
})

const sendRoomMove = (move: ChessMovePayload) => {
  if (!roomId.value) return

  const ws = roomSocket.value

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showChessWarning('房间连接已断开')
    return
  }

  ws.send(JSON.stringify({
    type: 'movePiece',
    roomId: roomId.value,
    data: move
  }))
}

const sendRoomFinish = (winner: Camp) => {
  if (!roomId.value) return

  const ws = roomSocket.value

  if (!ws || ws.readyState !== WebSocket.OPEN) return

  ws.send(JSON.stringify({
    type: 'finishRoom',
    roomId: roomId.value,
    winnerCamp: winner
  }))
}

const confirmReady = () => {
  if (!roomId.value || myReady.value) return

  const ws = roomSocket.value

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showChessWarning('房间连接已断开')
    return
  }

  ws.send(JSON.stringify({
    type: 'confirmReady',
    roomId: roomId.value
  }))
}

const applyRoomSnapshot = (data: RoomData) => {
  roomData.value = data
  roomMoves.value = [...(data.moves ?? [])]
  syncMyCampFromRoom(data)
  isBoardSynced.value = false
}

const syncBoardFromRoom = () => {
  if (!roomData.value || !isBoardReady.value) return false

  applyMoveHistory(roomMoves.value)
  isBoardSynced.value = true
  tryEnterBoard()
  return true
}

const currentCamp = computed(() => boardRef.value?.currentCamp ?? 'red')
const checkedCamp = computed(() => boardRef.value?.checkedCamp ?? null)
const winnerCamp = computed(() => boardRef.value?.winnerCamp ?? null)
const isBoardReady = computed(() => boardRef.value?.isBoardReady ?? false)
const applyRemoteMove = (move: ChessMovePayload) => boardRef.value?.applyRemoteMove(move) ?? false
const applyMoveHistory = (moves: ChessMovePayload[]) => boardRef.value?.applyMoveHistory(moves)
const finishGame = (winner: Camp, options?: { playSound?: boolean }) => boardRef.value?.finishGame(winner, options)

const gameCenterStyle = computed(() => ({
  '--game-background-image': toCssUrl(assetUrl(chessAssets.gameBackground))
}))

const playerByCamp = (camp: Camp) => {
  if (camp === 'red') {
    return roomData.value?.redPlayer
      ?? (!roomId.value && localPlayer.value?.camp === 'red' ? localPlayer.value : null)
  }

  return roomData.value?.blackPlayer
    ?? (!roomId.value && localPlayer.value?.camp === 'black' ? localPlayer.value : null)
}

const playerAvatar = (player: RoomPlayer | null) => {
  return player?.headImg
    ? assetUrl(player.headImg)
    : assetUrl(assetPaths.lobby.fallbackAvatar)
}

const turnStatusAvatar = computed(() => {
  return playerAvatar(playerByCamp(currentCamp.value))
})

const playerName = (player: RoomPlayer) => player.nickname || player.username || campText(player.camp)
const playerId = (player: RoomPlayer) => String(player.userId).padStart(6, '0')
const myPlayerInfo = computed(() => {
  if (!myCamp.value) return roomData.value?.creator ?? null
  return playerByCamp(myCamp.value) ?? roomData.value?.creator ?? null
})
const opponentInfo = computed(() => {
  if (!myCamp.value) return null
  return playerByCamp(myCamp.value === 'red' ? 'black' : 'red')
})
const roomLabel = computed(() => roomData.value?.roomId || roomId.value)
const myReady = computed(() => Boolean(myCamp.value && roomData.value?.readyCamps?.includes(myCamp.value)))
const opponentReady = computed(() => {
  if (!myCamp.value) return false
  return Boolean(roomData.value?.readyCamps?.includes(myCamp.value === 'red' ? 'black' : 'red'))
})
const canConfirmReady = computed(() => {
  return roomPhase.value === 'waiting'
    && Boolean(roomData.value?.redPlayer)
    && Boolean(roomData.value?.blackPlayer)
})

const waitingText = computed(() => {
  if (!myCamp.value) return '正在等待对手加入'

  return `你是${campText(myCamp.value)}，等待${campText(myCamp.value === 'red' ? 'black' : 'red')}加入`
})

const disconnectRemainingSeconds = computed(() => {
  if (!disconnectExpiresAt.value) return 0

  return Math.max(0, Math.ceil((disconnectExpiresAt.value - disconnectNow.value) / 1000))
})

const disconnectCountdownText = computed(() => {
  const minutes = Math.floor(disconnectRemainingSeconds.value / 60)
  const seconds = disconnectRemainingSeconds.value % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const overlayTitle = computed(() => {
  if (roomPhase.value === 'connecting') return '连接房间'
  if (roomPhase.value === 'waiting') return '等待对手'
  if (roomPhase.value === 'loading') return '准备开局'
  if (roomPhase.value === 'error') return '房间异常'

  return ''
})

const overlayMessage = computed(() => {
  if (roomPhase.value === 'connecting') return '正在进入房间...'
  if (roomPhase.value === 'waiting' && disconnectExpiresAt.value) {
    return `对方离开页面，倒计时 ${disconnectCountdownText.value}，未重连将自动判负`
  }
  if (roomPhase.value === 'waiting') return roomMessage.value || waitingText.value
  if (roomPhase.value === 'loading') return '对手已就位，正在载入棋盘...'
  if (roomPhase.value === 'error') return roomMessage.value || '房间连接失败'

  return ''
})

const statusText = computed(() => {
  return turnStatusText.value
})

const isWinnerView = computed(() => {
  if (!winnerCamp.value) return false
  if (!myCamp.value) return true

  return winnerCamp.value === myCamp.value
})

const clearRematchUiState = () => {
  rematchRequested.value = false
  rematchPromptSeq += 1

  if (isRematchPromptOpen.value) {
    ElMessageBox.close()
    isRematchPromptOpen.value = false
  }
}

const finishRoomGame = (winner: Camp) => {
  clearDisconnectCountdown()
  clearRematchUiState()
  roomPhase.value = 'playing'
  roomMessage.value = ''
  finishGame(winner, {
    playSound: !myCamp.value || winner === myCamp.value
  })
}

const clearDisconnectCountdown = () => {
  disconnectExpiresAt.value = null

  if (disconnectCountdownTimer) {
    window.clearInterval(disconnectCountdownTimer)
    disconnectCountdownTimer = null
  }
}

const startDisconnectCountdown = (expiresAt: number) => {
  clearDisconnectCountdown()
  disconnectExpiresAt.value = expiresAt
  disconnectNow.value = Date.now()

  disconnectCountdownTimer = window.setInterval(() => {
    disconnectNow.value = Date.now()

    if (disconnectRemainingSeconds.value <= 0) {
      window.clearInterval(disconnectCountdownTimer!)
      disconnectCountdownTimer = null
    }
  }, 1000)
}

const sendRoomCommand = (type: 'requestRematch' | 'declineRematch') => {
  if (!roomId.value) return false

  const ws = roomSocket.value

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showChessWarning('房间连接已断开')
    return false
  }

  ws.send(JSON.stringify({
    type,
    roomId: roomId.value
  }))

  return true
}

const requestRematch = () => {
  if (!roomId.value || !winnerCamp.value) return

  if (rematchRequested.value) {
    showChessInfo('已发送邀请，等待对方确认')
    return
  }

  if (sendRoomCommand('requestRematch')) {
    rematchRequested.value = true
  }
}

const openReview = async () => {
  const gameId = roomData.value?.gameId

  if (!gameId) {
    showChessWarning('暂时找不到本局复盘记录')
    return
  }

  await navigateTo({
    path: '/chessReview',
    query: { gameId: String(gameId) }
  })
}

const declineRematch = () => {
  sendRoomCommand('declineRematch')
}

const handleIncomingRematchInvite = async (invite: {
  fromCamp: Camp
  fromPlayer: RoomPlayer
}) => {
  if (invite.fromCamp === myCamp.value || isRematchPromptOpen.value) return

  const promptSeq = rematchPromptSeq + 1
  rematchPromptSeq = promptSeq
  isRematchPromptOpen.value = true

  const playerName = invite.fromPlayer.nickname || invite.fromPlayer.username || campText(invite.fromCamp)
  const accepted = await showChessConfirm({
    title: '再来一局',
    message: `${playerName} 邀请你再来一局`,
    confirmText: '接受',
    cancelText: '拒绝'
  })

  if (rematchPromptSeq !== promptSeq) return

  isRematchPromptOpen.value = false

  if (accepted) {
    if (sendRoomCommand('requestRematch')) {
      rematchRequested.value = true
    }
    return
  }

  declineRematch()
}

const copyRoomId = async () => {
  const value = roomLabel.value

  if (!value) return

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', 'readonly')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    showChessSuccess('房间号已复制')
  } catch {
    showChessError('复制失败，请手动复制房间号')
  }
}

const closeRoomOverlay = async () => {
  const confirmed = await showChessConfirm({
    title: '退出房间',
    message: '确定退出当前房间并返回游戏大厅吗？',
    confirmText: '返回大厅',
    cancelText: '取消'
  })

  if (!confirmed) return

  await navigateTo('/gameLobby', { replace: true })
}

const syncMyCampFromRoom = (data: RoomData) => {
  const auth = getAuthStorage()

  if (!auth) return

  if (data.redPlayer?.userId === auth.userId) {
    myCamp.value = 'red'
    return
  }

  if (data.blackPlayer?.userId === auth.userId) {
    myCamp.value = 'black'
  }
}

const tryEnterBoard = () => {
  if (roomPhase.value !== 'loading') return
  if (!isEnterDelayDone || !isBoardReady.value || !isBoardSynced.value) return

  roomPhase.value = 'playing'
  if (startCountdownTimer) {
    window.clearInterval(startCountdownTimer)
    startCountdownTimer = null
  }
  startGameBgm()
}

const scheduleEnterBoard = () => {
  if (enterBoardTimer) {
    window.clearTimeout(enterBoardTimer)
  }

  isEnterDelayDone = false
  startCountdown.value = 3
  if (startCountdownTimer) {
    window.clearInterval(startCountdownTimer)
  }
  startCountdownTimer = window.setInterval(() => {
    startCountdown.value = Math.max(1, startCountdown.value - 1)
  }, 800)
  enterBoardTimer = window.setTimeout(() => {
    enterBoardTimer = null
    isEnterDelayDone = true
    tryEnterBoard()
  }, 2400)
}

const getRoomWsUrl = (token: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${window.location.host}/ws/room?token=${encodeURIComponent(token)}`
}

const connectRoomSocket = () => {
  if (!roomId.value) {
    roomPhase.value = 'playing'
    startGameBgm()
    return
  }

  const token = getAuthToken()

  if (!token) {
    roomPhase.value = 'error'
    roomMessage.value = '登录已过期，请重新登录'
    return
  }

  const ws = new WebSocket(getRoomWsUrl(token))
  roomSocket.value = ws

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'joinRoom',
      roomId: roomId.value
    }))
  }

  ws.onmessage = (event) => {
    let message: RoomSocketMessage

    try {
      message = JSON.parse(event.data) as RoomSocketMessage
    } catch {
      return
    }

    if (message.type === 'pieceMoved') {
      roomMoves.value = [...roomMoves.value, message.data.move]

      if (roomPhase.value === 'playing') {
        const applied = applyRemoteMove(message.data.move)

        if (!applied) {
          isBoardSynced.value = false
          syncBoardFromRoom()
        }

        return
      }

      isBoardSynced.value = false
      syncBoardFromRoom()
      return
    }

    if (message.type === 'moveRejected') {
      rematchRequested.value = false
      showChessWarning(message.message)
      return
    }

    if (message.type === 'opponentLeft') {
      if (message.data.camp !== myCamp.value) {
        roomPhase.value = 'waiting'
        roomMessage.value = ''
        startDisconnectCountdown(message.data.expiresAt)
      }

      return
    }

    if (message.type === 'rematchInvite') {
      void handleIncomingRematchInvite(message.data)
      return
    }

    if (message.type === 'rematchInviteSent') {
      rematchRequested.value = true
      showChessInfo(message.message)
      return
    }

    if (message.type === 'rematchInviteDeclined') {
      clearRematchUiState()
      showChessWarning(message.message)
      return
    }

    if (message.type === 'rematchInviteCanceled') {
      clearRematchUiState()
      showChessInfo(message.message)
      return
    }

    if (message.type === 'roomFinished') {
      clearRematchUiState()
      applyRoomSnapshot(message.data)
      syncBoardFromRoom()

      if (!winnerCamp.value) {
        finishRoomGame(message.data.winnerCamp)
      }

      return
    }

    if (message.type === 'error') {
      roomPhase.value = 'error'
      roomMessage.value = message.message
      ws.close()
      showChessError(message.message)
      return
    }

    if (message.type === 'roomWaiting') {
      clearDisconnectCountdown()
      clearRematchUiState()
      applyRoomSnapshot(message.data)
      roomPhase.value = 'waiting'
      roomMessage.value = message.message
      syncBoardFromRoom()
      return
    }

    if (message.type === 'roomStarted') {
      clearDisconnectCountdown()
      clearRematchUiState()
      applyRoomSnapshot(message.data)
      roomPhase.value = 'loading'
      roomMessage.value = message.message
      scheduleEnterBoard()
      syncBoardFromRoom()
    }
  }

  ws.onerror = () => {
    roomPhase.value = 'error'
    roomMessage.value = '房间连接失败'
  }

  ws.onclose = () => {
    if (roomSocket.value === ws) {
      roomSocket.value = null
    }

    if (roomPhase.value === 'connecting') {
      roomPhase.value = 'error'
      roomMessage.value = '房间连接失败'
    }
  }
}

const quitFn = async () => {
  const ok = await showChessConfirm({
    title: '退出对局',
    message: '你确定要退出当前对局吗？这会导致你直接输掉比赛',
    confirmText: '退出',
    cancelText: '取消'
  })

  if (!ok) return

  const ws = roomSocket.value

  if (ws && ws.readyState === WebSocket.OPEN && roomId.value && !winnerCamp.value) {
    ws.send(JSON.stringify({
      type: 'resignRoom',
      roomId: roomId.value
    }))
  }

  clearDisconnectCountdown()
  clearRematchUiState()
  roomSocket.value = null
  ws?.close(1000, 'quit room')
  await navigateTo('/gameLobby', { replace: true })
}
watch(isBoardReady, () => {
  syncBoardFromRoom()
  tryEnterBoard()
})

onMounted(() => {
  const auth = getAuthStorage()

  if (auth) {
    localPlayer.value = {
      userId: auth.userId,
      username: auth.username,
      nickname: auth.nickname,
      headImg: auth.headImg,
      camp: routeCamp.value ?? 'red'
    }
  }
  connectRoomSocket()
})

onBeforeUnmount(() => {
  roomSocket.value?.close()
  stopBgm()
  clearDisconnectCountdown()
  clearRematchUiState()

  if (enterBoardTimer) {
    window.clearTimeout(enterBoardTimer)
  }

  if (startCountdownTimer) {
    window.clearInterval(startCountdownTimer)
  }
})
</script>

<style scoped lang="less">
.gameCenter {

  width: 100%;
  height: 100dvh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
  background-color: #f7f3ec;
  background-image: var(--game-background-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  .board {
    width: min(100%, calc(96dvh * 920 / 1010));
    max-width: 920px;
    aspect-ratio: 920 / 1010;
    position: absolute;
    top: 14%;

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: pointer;
      touch-action: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      outline: none;
    }
  }

  .quit {
    position: absolute;
    z-index: 5;
    top: 2vh;
    left: 4vw;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;

    img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
    }
  }

  .roomOverlay {
    position: fixed;
    inset: 0;
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(45, 27, 13, 0.62);
    backdrop-filter: blur(calc(2 / 430 * 100vw));
  }

  .roomOverlay__panel {
    position: relative;
    width: min(82vw, calc(430 / 430 * 100vw));
    max-width: 430px;
    min-height: 300px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: #fff4d4;
    background:
      linear-gradient(180deg, rgba(119, 51, 21, 0.96), rgba(71, 31, 15, 0.96)),
      #6f3019;
    border: calc(2 / 430 * 100vw) solid rgba(255, 218, 126, 0.78);
    border-radius: 8px;
    box-shadow:
      0 calc(16 / 430 * 100vw) calc(42 / 430 * 100vw) rgba(0, 0, 0, 0.36),
      inset 0 0 0 calc(1 / 430 * 100vw) rgba(255, 245, 203, 0.26);
    font-family: "ChessKaiti", "KaiTi", "Microsoft YaHei", serif;
  }

  .roomOverlay__close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(42, 20, 11, 0.34);
    cursor: pointer;
  }

  .roomOverlay__close::before,
  .roomOverlay__close::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 19px;
    height: 3px;
    border-radius: 2px;
    background: #ffe9a7;
    transform-origin: center;
  }

  .roomOverlay__close::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .roomOverlay__close::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  .roomOverlay__close:active {
    transform: scale(0.92);
  }

  .roomOverlay__close:focus-visible {
    outline: 2px solid #ffe9a7;
    outline-offset: 2px;
  }

  .roomOverlay__confirm {
    min-width: 190px;
    min-height: 48px;
    padding: 0 18px;
    border: 1px solid rgba(255, 224, 139, 0.62);
    border-radius: 8px;
    color: #fff3c4;
    background: linear-gradient(180deg, #c56b2d, #8e351b);
    box-shadow: 0 5px 12px rgba(42, 20, 11, 0.28);
    font: inherit;
    font-size: 18px;
    cursor: pointer;
  }

  .roomOverlay__confirm:disabled {
    color: rgba(255, 243, 196, 0.72);
    background: rgba(90, 54, 30, 0.72);
    cursor: default;
  }

  .roomOverlay__title {
    font-size: 30px;
    line-height: 1;
    font-weight: 800;
    text-shadow:
      0 calc(2 / 430 * 100vw) 0 #6f3019,
      0 calc(8 / 430 * 100vw) calc(16 / 430 * 100vw) rgba(0, 0, 0, 0.3);
  }

  .roomOverlay__players {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }

  .roomOverlay__player {
    min-width: 0;
    min-height: 174px;
    padding: 11px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: calc(1 / 430 * 100vw) solid rgba(255, 224, 139, 0.3);
    border-radius: 8px;
    background: rgba(255, 237, 181, 0.11);
  }

  .roomOverlay__player--empty {
    border-style: dashed;
    background: rgba(42, 20, 11, 0.18);
  }

  .roomOverlay__tag {
    margin-bottom: 8px;
    color: #f3d794;
    font-size: 12px;
    white-space: nowrap;
  }

  .roomOverlay__versus {
    color: #f7cc66;
    font-size: 18px;
    font-weight: 900;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.42);
  }

  .roomOverlay__avatar {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    object-fit: cover;
    border: calc(2 / 430 * 100vw) solid rgba(255, 232, 166, 0.82);
    background: #ecd9b2;
  }

  .roomOverlay__name {
    width: 100%;
    margin-top: 7px;
    overflow: hidden;
    font-size: 16px;
    line-height: 1.2;
    font-weight: 700;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .roomOverlay__id {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1;
    color: #f3d794;
  }

  .roomOverlay__ready {
    margin-top: 7px;
    padding: 2px 7px;
    border-radius: 7px;
    color: #d9ffd7;
    background: rgba(54, 135, 65, 0.38);
    font-size: 10px;
  }

  .roomOverlay__emptyAvatar {
    width: 54px;
    height: 54px;
    display: grid;
    place-items: center;
    border: calc(2 / 430 * 100vw) dashed rgba(255, 226, 154, 0.4);
    border-radius: 50%;
    color: rgba(255, 232, 166, 0.55);
    font-size: 25px;
  }

  .roomOverlay__emptyName {
    margin-top: 8px;
    color: #efd691;
    font-size: 15px;
  }

  .roomOverlay__waitingDots {
    height: 18px;
    display: flex;
    align-items: center;
    gap: 4px;

    i {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #ffe29a;
      animation: room-waiting-dot 920ms ease-in-out infinite;
    }

    i:nth-child(2) {
      animation-delay: 120ms;
    }

    i:nth-child(3) {
      animation-delay: 240ms;
    }
  }

  .roomOverlay__message {
    min-height: calc(24 / 430 * 100vw);
    font-size: 20px;
    line-height: 1.25;
    color: #ffe9a7;
    text-align: center;
  }

  .roomOverlay__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    span {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ffe29a;
      box-shadow: 0 0 calc(12 / 430 * 100vw) rgba(255, 226, 154, 0.72);
      animation: room-waiting-dot 920ms ease-in-out infinite;
    }

    span:nth-child(2) {
      animation-delay: 120ms;
    }

    span:nth-child(3) {
      animation-delay: 240ms;
    }
  }

  .roomOverlay__loading--countdown {
    min-height: 110px;
    flex-direction: column;
    gap: 5px;
  }

  .roomOverlay__countdown-label {
    color: #ffe9a7;
    font-size: 18px;
  }

  .roomOverlay__countdown-number {
    display: block;
    color: #fff2ae;
    font: 800 64px / 1 "ChessKaiti", "KaiTi", serif;
    text-shadow: 0 4px 12px rgba(255, 203, 91, 0.42);
    animation: room-countdown-pop 800ms ease both;
  }

  .roomOverlay__roomId {
    min-width: min(64vw, calc(280 / 430 * 100vw));
    min-height: 48px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    appearance: none;
    -webkit-appearance: none;
    background: rgba(255, 239, 195, 0.1);
    border: calc(1 / 430 * 100vw) solid rgba(255, 224, 139, 0.38);
    border-radius: 8px;
    color: #f2c86d;
    font: inherit;
    font-size: 17px;
    line-height: 1.1;
    text-align: center;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition:
      transform 120ms ease,
      filter 120ms ease,
      background 120ms ease;
  }

  .roomOverlay__roomId:active {
    transform: translateY(calc(2 / 430 * 100vw)) scale(0.98);
    filter: brightness(0.94);
  }

  .roomOverlay__roomId:focus-visible {
    outline: calc(2 / 430 * 100vw) solid rgba(255, 236, 181, 0.7);
    outline-offset: calc(2 / 430 * 100vw);
  }

  .roomOverlay__roomIdText {
    text-align: center;
  }

  .roomOverlay__copyHint {
    font-size: 12px;
    line-height: 1;
    color: rgba(255, 238, 187, 0.78);
  }

  .gameStatus {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow: hidden;
  }

  .status {
    position: absolute;
    z-index: 4;
    top: 2vh;
    left: 50%;
    transform: translateX(-50%);
    min-width: 128px;
    height: 44px;
    padding-left: 12px;
    padding-right: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(255, 248, 226, 0.94);
    border-width: 1px;
    border-style: solid;
    border-color: rgba(146, 90, 33, 0.34);
    border-radius: 8px;
    color: #5a371c;
    font-family: "ChessKaiti", "KaiTi", "Microsoft YaHei", serif;
    box-shadow:
      0 calc(6 / 430 * 100vw) calc(18 / 430 * 100vw) rgba(64, 45, 24, 0.18),
      inset 0 0 0 calc(1 / 430 * 100vw) rgba(255, 255, 255, 0.42);
    pointer-events: none;
  }

  .status__icon {
    width: 26px;
    height: 26px;
    display: block;
    flex: 0 0 auto;
    border-radius: 50%;
    object-fit: cover;
    background: #ecd9b2;
    box-shadow: 0 0 0 2px rgba(255, 232, 166, 0.82);
  }

  .status__text {
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
    white-space: nowrap;
  }

  .status--red {
    background: rgba(255, 243, 210, 0.96);
    border-color: rgba(181, 83, 43, 0.46);
    color: #9d2820;
  }

  .status--black {
    background: rgba(238, 232, 222, 0.96);
    border-color: rgba(22, 18, 14, 0.42);
    color: #19140f;
  }

  .bgm-toggle {
    position: absolute;
    z-index: 5;
    top: 2vh;
    right: 4vw;
    width: 38px;
    height: 38px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border: 0;
    border-radius: 0;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition:
      transform 120ms ease,
      filter 120ms ease;
  }

  .bgm-toggle:active {
    transform: translateY(calc(2 / 430 * 100vw)) scale(0.94);
    filter: brightness(0.92);
  }

  .bgm-toggle__icon {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    filter: drop-shadow(0 calc(4 / 430 * 100vw) calc(6 / 430 * 100vw) rgba(64, 45, 24, 0.2));
  }

}

@keyframes room-waiting-dot {

  0%,
  100% {
    transform: translateY(0) scale(0.84);
    opacity: 0.56;
  }

  50% {
    transform: translateY(calc(-7 / 430 * 100vw)) scale(1);
    opacity: 1;
  }
}

@keyframes room-countdown-pop {
  0% {
    opacity: 0;
    transform: scale(1.35);
  }

  35% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0.86;
    transform: scale(0.94);
  }
}
</style>

<style lang="less">
html:has(.gameCenter),
body:has(.gameCenter),
body:has(.gameCenter) #__nuxt {
  height: 100%;
  overflow: hidden;
}
</style>
