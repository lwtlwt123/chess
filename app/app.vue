<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { assetPaths } from '~/constants/assetPaths'
import { useAssetUrl } from '~/composables/useAssetUrl'
import { getMusicEnabled } from '~/utils/music'
import { getAuthToken } from '~/utils/auth'

const clickSoundSelector = [
  'button',
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '.el-button',
  '.btn',
  '.exit',
  '.startGame',
  '.name img'
].join(',')

let handleButtonSound: ((event: PointerEvent) => void) | null = null
let presenceSocket: WebSocket | null = null
let presenceToken = ''
let presenceReconnectTimer: number | null = null
let presenceRematchPromptOpen = false
let presenceRematchPromptSeq = 0
let isEnteringRematchRoom = false
const assetUrl = useAssetUrl()
const roomWebSocketUrl = useRoomWebSocketUrl()
const route = useRoute()

type PresenceRematchInvite = {
  roomId: string
  fromCamp: 'red' | 'black'
  fromPlayer: {
    username: string
    nickname: string | null
  }
  requestedAt: number
}

type PresenceSocketMessage =
  | { type: 'rematchInvite'; message: string; data: PresenceRematchInvite }
  | { type: 'roomStarted'; message: string; data: { roomId: string; camp?: 'red' | 'black' } }
  | { type: 'moveRejected' | 'rematchInviteDeclined' | 'rematchInviteCanceled' | 'error'; message: string }

const isGameCenterRoute = () => route.path === '/gameCenter'

const closePresenceRematchPrompt = () => {
  presenceRematchPromptSeq += 1

  if (!presenceRematchPromptOpen) return

  presenceRematchPromptOpen = false
  ElMessageBox.close()
}

const sendPresenceRoomCommand = (type: 'requestRematch' | 'declineRematch', roomId: string) => {
  const socket = presenceSocket

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showChessWarning('房间连接已断开')
    return false
  }

  socket.send(JSON.stringify({ type, roomId }))
  return true
}

const handlePresenceRematchInvite = async (invite: PresenceRematchInvite) => {
  if (presenceRematchPromptOpen) return

  const promptSeq = presenceRematchPromptSeq + 1
  presenceRematchPromptSeq = promptSeq
  presenceRematchPromptOpen = true

  const playerName = invite.fromPlayer.nickname || invite.fromPlayer.username || '对方'
  const accepted = await showChessConfirm({
    title: '再来一局',
    message: `${playerName} 邀请你再来一局`,
    confirmText: '接受',
    cancelText: '拒绝'
  })

  if (presenceRematchPromptSeq !== promptSeq) return

  presenceRematchPromptOpen = false
  sendPresenceRoomCommand(accepted ? 'requestRematch' : 'declineRematch', invite.roomId)
}

const enterRematchRoom = async (data: { roomId: string; camp?: 'red' | 'black' }) => {
  if (isGameCenterRoute() || isEnteringRematchRoom) return

  isEnteringRematchRoom = true
  closePresenceRematchPrompt()

  await navigateTo({
    path: '/gameCenter',
    query: {
      roomId: data.roomId,
      ...(data.camp ? { camp: data.camp } : {})
    }
  })
}

const handlePresenceSocketMessage = (event: MessageEvent) => {
  let message: PresenceSocketMessage

  try {
    message = JSON.parse(event.data) as PresenceSocketMessage
  } catch {
    return
  }

  if (message.type === 'rematchInvite') {
    void handlePresenceRematchInvite(message.data)
    return
  }

  if (message.type === 'roomStarted') {
    void enterRematchRoom(message.data)
    return
  }

  closePresenceRematchPrompt()
  showChessWarning(message.message)
}

const clearPresenceReconnect = () => {
  if (presenceReconnectTimer === null) return
  window.clearTimeout(presenceReconnectTimer)
  presenceReconnectTimer = null
}

const closePresence = () => {
  clearPresenceReconnect()
  closePresenceRematchPrompt()
  const socket = presenceSocket
  presenceSocket = null
  presenceToken = ''
  socket?.close(1000, 'logout')
}

const connectPresence = () => {
  const token = getAuthToken()

  if (!token) {
    closePresence()
    return
  }

  if (presenceToken === token && presenceSocket && presenceSocket.readyState <= WebSocket.OPEN) return

  closePresence()
  presenceToken = token
  const socket = new WebSocket(roomWebSocketUrl(token))
  presenceSocket = socket
  socket.onmessage = handlePresenceSocketMessage

  socket.onclose = () => {
    if (presenceSocket !== socket) return
    presenceSocket = null

    if (getAuthToken() !== token) {
      presenceToken = ''
      return
    }

    clearPresenceReconnect()
    presenceReconnectTimer = window.setTimeout(connectPresence, 2000)
  }
}

const isDisabledButton = (element: HTMLElement) => {
  return ('disabled' in element && Boolean((element as HTMLButtonElement).disabled))
    || element.classList.contains('is-disabled')
    || element.getAttribute('aria-disabled') === 'true'
}

const shouldPlayButtonSound = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false

  const buttonElement = target.closest<HTMLElement>(clickSoundSelector)
  if (!buttonElement) return false
  if (buttonElement.closest('[data-click-sound="off"]')) return false

  return !isDisabledButton(buttonElement)
}

onMounted(() => {
  const { $audio } = useNuxtApp()


  // 先预加载音效，真正点击时直接用 key 播放。
  $audio.preload({
    drop: assetUrl(assetPaths.sounds.drop),
    eat: assetUrl(assetPaths.sounds.eat),
    check: assetUrl(assetPaths.sounds.check),
    victory: assetUrl(assetPaths.sounds.victory),
    bgm: assetUrl(assetPaths.sounds.bgm),
    click: assetUrl(assetPaths.sounds.click),
    chess_bgm: assetUrl(assetPaths.sounds.chessBgm),
  })
  if (route.path !== '/gameCenter' && getMusicEnabled()) {
    $audio.play('chess_bgm', { loop: true })
  }

  handleButtonSound = (event) => {
    if (event.button !== 0) return
    if (!shouldPlayButtonSound(event.target)) return

    $audio.play('click')
  }

  window.addEventListener('pointerdown', handleButtonSound, true)
  connectPresence()
})

watch(() => route.fullPath, () => {
  if (!import.meta.client) return

  isEnteringRematchRoom = false
  connectPresence()
})

onBeforeUnmount(() => {
  closePresence()

  if (handleButtonSound) {
    window.removeEventListener('pointerdown', handleButtonSound, true)
    handleButtonSound = null
  }
})
</script>
