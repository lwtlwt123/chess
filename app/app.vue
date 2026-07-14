<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
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
const assetUrl = useAssetUrl()
const route = useRoute()

const clearPresenceReconnect = () => {
  if (presenceReconnectTimer === null) return
  window.clearTimeout(presenceReconnectTimer)
  presenceReconnectTimer = null
}

const closePresence = () => {
  clearPresenceReconnect()
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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws/room?token=${encodeURIComponent(token)}`)
  presenceSocket = socket

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
  if (import.meta.client) connectPresence()
})

onBeforeUnmount(() => {
  closePresence()

  if (handleButtonSound) {
    window.removeEventListener('pointerdown', handleButtonSound, true)
    handleButtonSound = null
  }
})
</script>
