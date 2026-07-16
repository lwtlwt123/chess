<template>
  <div class="gameLobby" :style="lobbyAssetStyle">
    <div v-if="isPageLoading" class="lobbyLoading">
      <svg viewBox="0 0 50 50" class="lobbyLoadingSvg" aria-hidden="true">
        <circle class="lobbyLoadingRing" cx="25" cy="25" r="18" />
        <path class="lobbyLoadingArc" d="M25 7a18 18 0 0 1 18 18" />
        <text class="lobbyLoadingPiece" x="25" y="32" text-anchor="middle">将</text>
      </svg>
      <div class="lobbyLoadingText">加载用户信息...</div>
    </div>

    <template v-if="isUserInfoReady">
      <div class="header">
        <div class="exit" @click="exitFn">退出登录</div>
        <div class="voice" @click="setMusicFn">
          <img :src="assetUrl(assetPaths.lobby.voice)" alt="声音" v-show="musicFlag">
          <img :src="assetUrl(assetPaths.lobby.noVoice)" alt="声音" v-show="!musicFlag">
        </div>
      </div>


      <div class="info">
        <div class="userInfo">
          <div class="img">
            <button
              class="avatarEditor"
              type="button"
              aria-label="更换头像"
              :aria-busy="isUpdatingAvatar"
              :disabled="isUpdatingAvatar"
              @click="openAvatarPicker"
            >
              <img class="avatarImage" :src="userHeadImg" alt="当前头像">
              <span class="avatarOverlay" aria-hidden="true">
                <img class="avatarEditIcon" :src="assetUrl(assetPaths.lobby.edit)" alt="">
              </span>
            </button>
            <input
              ref="avatarInput"
              class="avatarInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              tabindex="-1"
              @change="handleAvatarSelect"
            >
          </div>
          <div class="nameInfo">
            <div class="name">{{ userInfoData.nickname ? userInfoData.nickname : '未设置账户名' }}
              <!-- <span></span> -->
              <img @click="editFn" :src="assetUrl(assetPaths.lobby.edit)" alt="">
            </div>
            <div class="idInfo">
              <span class="id">ID:{{ userInfoData.userId }}</span>
              <span>·</span>
              <span class="message">
                <!-- 连胜三局 -->
              </span>
            </div>
          </div>
        </div>
      </div>
      <img class="lobbyTitle" :src="assetUrl(assetPaths.lobby.title)" alt="楚河汉界">

      <!-- 功能 -->
      <div class="fun">
        <div class="chess">
          <img :src="assetUrl(assetPaths.lobby.pieceRed)" alt="">
          <img :src="assetUrl(assetPaths.lobby.pieceBlack)" alt="">
        </div>
        <div class="funInfo">
          <div class="title">今日宜开局</div>
          <div class="startGame" @click="startFn">
            开始游戏
          </div>
          <div class="gradeList btn" @click="gradeFn">
            查看战绩
          </div>
          <div class="rankingList btn" @click="rankFn">
            排行榜(未做)
          </div>
          <div class="settings btn" @click="setFn">
            设置（未做）
          </div>
        </div>

      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { assetPaths } from '~/constants/assetPaths'
import { toCssUrl, useAssetUrl } from '~/composables/useAssetUrl'
import {
  clearAuthStorage,
  consumeAuthRedirectMessage,
  getAuthStorage,
  getAuthToken,
  saveAuthRedirectMessage,
  saveAuthStorage,
  verifyAuthToken
} from '~/utils/auth'
import { getMusicEnabled, saveMusicEnabled } from '~/utils/music'
const { $audio } = useNuxtApp()

type UserData = {
  userId: number | string
  username: string
  nickname: string | null
  headImg: string | null
}

type EditNameData = UserData & {
  token: string
}

type EditAvatarData = UserData & {
  token: string
}

type Camp = 'red' | 'black'

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
  creator: RoomPlayer
  redPlayer: RoomPlayer | null
  blackPlayer: RoomPlayer | null
  winnerCamp: Camp | null
  gameId?: number | null
  roundNo?: number
  camp?: Camp
}

type RoomCreatedMessage = {
  type: 'roomCreated'
  code: number
  message: string
  data: {
    roomId: string
    camp: Camp
  }
}

type RoomErrorMessage = {
  type: 'error'
  code: number
  message: string
}

type MoveRejectedMessage = {
  type: 'moveRejected'
  code: number
  message: string
}

type RoomStartedMessage = {
  type: 'roomStarted'
  code: number
  message: string
  data: RoomData
}

type RoomWaitingMessage = {
  type: 'roomWaiting'
  code: number
  message: string
  data: RoomData
}

type RoomSocketMessage =
  | RoomCreatedMessage
  | RoomErrorMessage
  | MoveRejectedMessage
  | RoomWaitingMessage
  | RoomStartedMessage

const wait = (delay = 600) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delay)
  })
}

const waitForLobbyFonts = async () => {
  if (!import.meta.client || !document.fonts) return

  try {
    await Promise.all([
      document.fonts.load('24px "ChessTitle"', '楚河汉界'),
      document.fonts.load('24px "ChessKaiti"', '今日宜开局'),
      document.fonts.ready
    ])
  } catch {
    // 网络或浏览器不支持字体时仍允许进入大厅。
  }
}

const userInfoData = ref<UserData>({
  userId: '',
  username: '',
  nickname: null,
  headImg: null
})

const assetUrl = useAssetUrl()
const roomWebSocketUrl = useRoomWebSocketUrl()
const userHeadImg = computed(() => {
  return userInfoData.value.headImg
    ? assetUrl(userInfoData.value.headImg)
    : assetUrl(assetPaths.lobby.fallbackAvatar)
})
const lobbyAssetStyle = computed<Record<string, string>>(() => ({
  '--lobby-bg-image': toCssUrl(assetUrl(assetPaths.background)),
  '--logout-button-image': toCssUrl(assetUrl(assetPaths.lobby.logoutButton)),
  '--user-banner-image': toCssUrl(assetUrl(assetPaths.lobby.userBanner)),
  '--lobby-panel-image': toCssUrl(assetUrl(assetPaths.lobby.panel)),
  '--start-button-image': toCssUrl(assetUrl(assetPaths.lobby.startButton)),
  '--menu-button-image': toCssUrl(assetUrl(assetPaths.lobby.menuButton))
}))

const isUserInfoReady = ref(false)
const isPageLoading = ref(true)
const isExiting = ref(false)
const isCreatingRoom = ref(false)
const isUpdatingAvatar = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const musicFlag = ref(true)
let roomSocket: WebSocket | null = null
let lobbySocket: WebSocket | null = null
let lobbyReconnectTimer: number | null = null
let isLobbyPageActive = false

const ensureRoomSocketAuth = async () => {
  const token = getAuthToken()

  if (token && await verifyAuthToken(token)) return token

  clearAuthStorage()
  saveAuthRedirectMessage('登录已过期，请重新登录')
  await navigateTo('/', { replace: true })
  throw new Error('登录已过期，请重新登录')
}

const createRoomBySocket = async () => {
  const token = await ensureRoomSocketAuth()

  return new Promise<RoomCreatedMessage['data']>((resolve, reject) => {
    roomSocket?.close()

    const ws = new WebSocket(roomWebSocketUrl(token))
    roomSocket = ws

    const timer = window.setTimeout(() => {
      ws.close()
      reject(new Error('连接超时，请稍后再试'))
    }, 8000)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'createRoom'
      }))
    }

    ws.onmessage = (event) => {
      let data: RoomSocketMessage

      try {
        data = JSON.parse(event.data) as RoomSocketMessage
      } catch {
        return
      }

      if (data.type === 'error') {
        window.clearTimeout(timer)
        reject(new Error(data.message || '创建房间失败'))
        ws.close()
        return
      }

      if (data.type === 'roomCreated') {
        window.clearTimeout(timer)
        resolve(data.data)
        ws.close(1000, 'room created')
      }
    }

    ws.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('房间连接失败'))
    }

    ws.onclose = () => {
      if (roomSocket === ws) {
        roomSocket = null
      }
    }
  })
}

const joinRoomBySocket = async (roomId: string) => {
  const token = await ensureRoomSocketAuth()

  return new Promise<RoomData>((resolve, reject) => {
    roomSocket?.close()

    const ws = new WebSocket(roomWebSocketUrl(token))
    roomSocket = ws

    const timer = window.setTimeout(() => {
      ws.close()
      reject(new Error('连接超时，请稍后再试'))
    }, 8000)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'joinRoom',
        roomId
      }))
    }

    ws.onmessage = (event) => {
      let data: RoomSocketMessage

      try {
        data = JSON.parse(event.data) as RoomSocketMessage
      } catch {
        return
      }

      if (data.type === 'error') {
        window.clearTimeout(timer)
        reject(new Error(data.message || '加入房间失败'))
        ws.close()
        return
      }

      if (data.type === 'roomWaiting' || data.type === 'roomStarted') {
        window.clearTimeout(timer)
        resolve(data.data)
        ws.close(1000, 'room validated')
      }
    }

    ws.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('房间连接失败'))
    }

    ws.onclose = () => {
      if (roomSocket === ws) {
        roomSocket = null
      }
    }
  })
}

const clearLobbyReconnectTimer = () => {
  if (!lobbyReconnectTimer) return

  window.clearTimeout(lobbyReconnectTimer)
  lobbyReconnectTimer = null
}

const getMyCampFromRoom = (room: RoomData) => {
  const auth = getAuthStorage()

  if (room.camp === 'red' || room.camp === 'black') return room.camp
  if (auth?.userId && room.redPlayer?.userId === auth.userId) return 'red'
  if (auth?.userId && room.blackPlayer?.userId === auth.userId) return 'black'

  return null
}

const enterRoomFromLobby = async (room: RoomData) => {
  const camp = getMyCampFromRoom(room)

  lobbySocket?.close(1000, 'enter room')
  lobbySocket = null

  await navigateTo({
    path: '/gameCenter',
    query: {
      roomId: room.roomId,
      ...(camp ? { camp } : {})
    }
  })
}

const handleLobbySocketMessage = (event: MessageEvent) => {
  let data: RoomSocketMessage

  try {
    data = JSON.parse(event.data) as RoomSocketMessage
  } catch {
    return
  }

  if (data.type === 'moveRejected') {
    showChessWarning(data.message)
  }
}

const connectLobbySocket = () => {
  const token = getAuthToken()

  if (!token || !isLobbyPageActive) return
  if (lobbySocket && lobbySocket.readyState <= WebSocket.OPEN) return

  clearLobbyReconnectTimer()

  const ws = new WebSocket(roomWebSocketUrl(token))
  lobbySocket = ws

  ws.onmessage = handleLobbySocketMessage

  ws.onclose = () => {
    if (lobbySocket === ws) {
      lobbySocket = null
    }

    if (!isLobbyPageActive) return

    lobbyReconnectTimer = window.setTimeout(() => {
      lobbyReconnectTimer = null
      connectLobbySocket()
    }, 1500)
  }

  ws.onerror = () => {
    ws.close()
  }
}

const searchIdFn = async (id: number | string) => {
  try {
    const res = await apiFetch<UserData>('/api/searchId', {
      method: 'GET',
      query: {
        id
      }
    })
    if (!res.data) return false

    res.data.userId = String(res.data.userId).padStart(6, '0')
    userInfoData.value = res.data
    return true

  } catch (error) {
    showChessError('用户信息获取失败')
    return false
  }

}

// 设置名字
const editFn = async () => {
  const nickname = await showChessPrompt({
    title: '设置昵称',
    message: '请输入新的昵称',
    inputValue: userInfoData.value.nickname ?? '',
    placeholder: '最多7个字符',
    inputPattern: /^.{1,7}$/,
    inputErrorMessage: '账户名不能为空，且不能超过7个字符',
    confirmText: '保存',
    cancelText: '取消'
  })

  if (!nickname) return

  const auth = getAuthStorage()

  if (!auth?.userId) {
    showChessWarning('登录已过期，请重新登录')
    return
  }

  showLoading('修改中...')
  const loadingDelay = wait(700)
  let messageType: 'success' | 'warning' | 'error' = 'success'
  let messageText = '修改成功'
  try {
    const res = await apiFetch<EditNameData>('/api/editName', {
      method: 'POST',
      body: {
        userId: auth.userId,
        nickname
      }
    })

    if (res.code !== 200 || !res.data) {
      messageType = 'warning'
      messageText = res.message || '修改失败'
    } else {
      saveAuthStorage(res.data)
      userInfoData.value = {
        userId: String(res.data.userId).padStart(6, '0'),
        username: res.data.username,
        nickname: res.data.nickname,
        headImg: res.data.headImg
      }
      messageText = res.message || '修改成功'
    }
  } catch {
    messageType = 'error'
    messageText = '修改失败，请稍后再试'
  } finally {
    await loadingDelay
    closeLoading()

    if (messageType === 'success') showChessSuccess(messageText)
    if (messageType === 'warning') showChessWarning(messageText)
    if (messageType === 'error') showChessError(messageText)
  }

}

const openAvatarPicker = () => {
  if (isUpdatingAvatar.value || !avatarInput.value) return

  avatarInput.value.value = ''
  avatarInput.value.click()
}

const handleAvatarSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (!allowedTypes.includes(file.type)) {
    showChessWarning('请选择 JPG、PNG 或 WebP 图片')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    showChessWarning('头像图片不能超过 5MB')
    return
  }

  const previewUrl = URL.createObjectURL(file)
  const confirmed = await showChessConfirm({
    title: '更换头像',
    message: h('div', { class: 'avatar-confirm-content' }, [
      h('img', {
        class: 'avatar-confirm-preview',
        src: previewUrl,
        alt: '新头像预览'
      }),
      h('p', { class: 'avatar-confirm-text' }, '确定使用这张图片作为新头像吗？')
    ]),
    confirmText: '确认更换',
    cancelText: '取消'
  })

  URL.revokeObjectURL(previewUrl)

  if (!confirmed) return

  const formData = new FormData()
  formData.append('avatar', file)
  isUpdatingAvatar.value = true
  showLoading('头像上传中...')

  try {
    const res = await apiFetch<EditAvatarData>('/api/avatar', {
      method: 'POST',
      body: formData
    })

    if (res.code !== 200 || !res.data) {
      showChessWarning(res.message || '头像更换失败')
      return
    }

    saveAuthStorage(res.data)
    userInfoData.value = {
      userId: String(res.data.userId).padStart(6, '0'),
      username: res.data.username,
      nickname: res.data.nickname,
      headImg: res.data.headImg
    }
    showChessSuccess(res.message || '头像更换成功')
  } catch {
    showChessError('头像更换失败，请稍后再试')
  } finally {
    isUpdatingAvatar.value = false
    closeLoading()
  }
}

const setMusicFn = () => {
  const nextMusicFlag = !musicFlag.value

  musicFlag.value = nextMusicFlag
  saveMusicEnabled(nextMusicFlag)
  $audio.unlock()

  if (nextMusicFlag) {
    $audio.play('chess_bgm', { loop: true })
    return
  }

  $audio.stop('chess_bgm')
}

//退出登录方法 需弹出确认框确认
const exitFn = async () => {
  if (isExiting.value) return

  const ok = await showChessConfirm({
    title: '退出登录',
    message: '确定要退出当前账号吗？',
    confirmText: '退出',
    cancelText: '取消'
  })

  if (!ok) return

  isExiting.value = true
  showLoading('退出中...')

  await wait(500)

  clearAuthStorage()
  closeLoading()
  await navigateTo('/', { replace: true })
}

type RoomAction = 'create' | 'join'

// 开始游戏
const startFn = async () => {
  const action = await showChessActionSelect<RoomAction>({
    title: '开始游戏',
    message: '请选择进入方式',
    actions: [
      { label: '创建房间', value: 'create', type: 'primary' },
      { label: '加入房间', value: 'join' }
    ],
    cancelText: '取消'
  })

  if (action === 'create') {
    if (isCreatingRoom.value) return

    isCreatingRoom.value = true
    showLoading('创建房间中...')

    try {
      const room = await createRoomBySocket()

      // showChessSuccess(`房间创建成功，你是${room.camp === 'red' ? '红方' : '黑方'}`)
      await navigateTo({
        path: '/gameCenter',
        query: {
          roomId: room.roomId,
          camp: room.camp
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建房间失败'
      if (message !== '登录已过期，请重新登录') {
        showChessError(message)
      }
    } finally {
      isCreatingRoom.value = false
      closeLoading()
    }

    return
  }

  if (action === 'join') {
    let inputValue = ''

    while (true) {
      const roomId = await showChessPrompt({
        title: '请输入房间号',
        message: '房间号',
        inputValue,
        confirmText: '连接',
        cancelText: '取消'
      })

      if (roomId === null) return

      const normalizedRoomId = roomId.trim()
      inputValue = normalizedRoomId

      if (!normalizedRoomId) {
        showChessWarning('房间号不能为空')
        continue
      }

      try {
        const room = await joinRoomBySocket(normalizedRoomId)
        const camp = getMyCampFromRoom(room)

        await navigateTo({
          path: '/gameCenter',
          query: {
            roomId: room.roomId,
            ...(camp ? { camp } : {})
          }
        })
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : '加入房间失败'

        if (message === '登录已过期，请重新登录') return
        showChessError(message)
      }
    }

    return
  }
}
// 查看战绩
const gradeFn = () => {
  navigateTo('/myRecord')
}
// 排行榜
const rankFn = () => {
}
// 设置
const setFn = () => {
}


onMounted(async () => {
  isLobbyPageActive = true
  musicFlag.value = getMusicEnabled()

  if (musicFlag.value) {
    $audio.play('chess_bgm', { loop: true })
  } else {
    $audio.stop('chess_bgm')
  }

  const authMessage = consumeAuthRedirectMessage()

  if (authMessage) {
    showChessInfo(authMessage)
  }

  const auth = getAuthStorage()
  // console.log(auth?.userId);
  let isLoaded = false
  try {
    if (!auth?.userId) {
      showChessWarning('登录已过期，请重新登录')
      return
    }

    isLoaded = await searchIdFn(auth.userId)

    if (isLoaded) {
      connectLobbySocket()
    }
  } finally {
    if (isLoaded) {
      await waitForLobbyFonts()
      isUserInfoReady.value = true
      await nextTick()
      isPageLoading.value = false
    }
  }

})

onBeforeUnmount(() => {
  isLobbyPageActive = false
  clearLobbyReconnectTimer()
  roomSocket?.close()
  lobbySocket?.close()
})



</script>

<style scoped lang="less">
.gameLobby {
  width: var(--app-page-width);
  height: 100dvh;
  min-height: 100dvh;
  margin-right: auto;
  margin-left: auto;
  position: relative;
  overflow: hidden;
  overscroll-behavior: none;
  .bg-image-var(var(--lobby-bg-image));

  .header {
    padding-left: 20px;
    padding-right: 20px;
    .center(@content: space-between);
    gap: 2vw;

    // display: flex;
    // justify-content: right;
    // align-items: right;
    .exit {
      width: 30vw;
      height: 6vh;
      text-align: center;
      line-height: 6.3vh;
      color: #f1ddb6;
      font-weight: bold;
      letter-spacing: 2px;
      // font-weight: bold;
      font-size: 15px;
      font-family: "ChessKaiti", "KaiTi", "Microsoft YaHei", serif;
      .bg-image-var(var(--logout-button-image), contain);
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition:
        transform 120ms ease,
        filter 120ms ease;
    }


    .exit:active {
      transform: translateY(calc(3 / 430 * var(--app-rpx-base))) scale(0.97);
      filter: brightness(0.9) saturate(0.95);
    }

    @media (hover: hover) {
      .exit:hover {
        filter: brightness(1.05);
      }
    }

    .voice {
      width: 4.5vh;
      height: 4.5vh;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition:
        transform 120ms ease,
        filter 120ms ease;

      img {
        width: 100%;
        height: 100%;
        display: block;
      }
    }

    .voice:active {
      transform: translateY(calc(3 / 430 * var(--app-rpx-base))) scale(0.94);
      filter: brightness(0.9) saturate(0.95);
    }
  }

  .lobbyTitle {
    width: 90vw;
    max-width: 650px;
    height: auto;
    margin: 0 auto;
    transform: translateY(1.8vh);
    pointer-events: none;
  }

  .lobbyLoading {
    position: fixed;
    inset: 0;
    z-index: 20;
    .center(@display: flex);
    flex-direction: column;
    gap: 12px;
    background: rgba(31, 17, 8, 0.72);
    backdrop-filter: blur(calc(2 / 430 * var(--app-rpx-base)));
  }

  .lobbyLoadingSvg {
    width: 64px;
    height: 64px;
    animation: chess-loading-spin 1200ms linear infinite;
    filter: drop-shadow(0 calc(8 / 430 * var(--app-rpx-base)) calc(12 / 430 * var(--app-rpx-base)) rgba(47, 24, 9, 0.38));
  }

  .lobbyLoadingRing {
    fill: rgba(255, 232, 169, 0.18);
    stroke: #f0c15c;
    stroke-width: 3;
  }

  .lobbyLoadingArc {
    fill: none;
    stroke: #fff0a8;
    stroke-width: 5;
    stroke-linecap: round;
  }

  .lobbyLoadingPiece {
    fill: #8c2519;
    font-family: "ChessTitle", "KaiTi", "Microsoft YaHei", serif;
    font-size: 22px;
    font-weight: 900;
  }

  .lobbyLoadingText {
    color: #ffe39a;
    font-family: "ChessTitle", "KaiTi", "Microsoft YaHei", serif;
    font-size: 24px;
    line-height: 1;
    text-shadow:
      0 calc(2 / 430 * var(--app-rpx-base)) 0 #6f3019,
      0 calc(6 / 430 * var(--app-rpx-base)) calc(14 / 430 * var(--app-rpx-base)) rgba(0, 0, 0, 0.42);
  }

  .info {
    .center();

    .userInfo {
      width: 80%;
      max-width: 620px;
      aspect-ratio: 620 / 160;
      .bg-image-var(var(--user-banner-image), 100% 100%);
      position: relative;

      .img {
        position: absolute;
        top: 50%;
        left: 14.193548%;
        width: 13.225806%;
        aspect-ratio: 1;
        transform: translate(-50%, -50%);
        border-radius: 50%;

        .avatarEditor {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          padding: 0;
          overflow: hidden;
          border: 0;
          border-radius: 50%;
          background: #6f3019;
          cursor: pointer;
          isolation: isolate;
        }

        .avatarImage {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          transition: transform 160ms ease;
        }

        .avatarOverlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(45, 23, 12, 0.64);
          opacity: 0;
          pointer-events: none;
          transition: opacity 160ms ease;
        }

        .avatarEditIcon {
          width: 34%;
          height: 34%;
          filter: brightness(0) invert(1) drop-shadow(0 1px 2px rgba(45, 23, 12, 0.45));
        }

        .avatarEditor:focus-visible {
          outline: 2px solid #fff0a8;
          outline-offset: -3px;
        }

        .avatarEditor:disabled {
          cursor: wait;
        }

        .avatarEditor:disabled .avatarOverlay {
          opacity: 1;
        }

        .avatarInput {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          clip-path: inset(50%);
          white-space: nowrap;
        }

        .avatarEditor:hover .avatarOverlay,
        .avatarEditor:focus-visible .avatarOverlay {
          opacity: 1;
        }

        .avatarEditor:hover .avatarImage {
          transform: scale(1.06);
        }

        // 头像默认图在模板里通过 assetUrl 统一处理。
      }

      .nameInfo {
        padding-left: 25%;
        padding-top: 7%;
        // font-family: "ChessTitle", "KaiTi", "Microsoft YaHei", serif;
        font-family: "ChessKaiti", "KaiTi", "Microsoft YaHei", serif;

        .name {
          font-size: 21px;
          color: #875635;
          letter-spacing: 3px;
          display: flex;
          line-height: 18px;

          img {
            width: 18px;
            height: 18px;
            margin-left: 10px;
          }
        }

        .idInfo {
          // display: flex;
          font-size: 14px;
          margin-top: 0.8vh;

          span:first-of-type,
          span:nth-of-type(2) {
            margin-right: 5px;
          }
        }

      }
    }

    // .bg-image-var(var(--user-banner-image))
  }

  .fun {
    position: relative;
    width: 100%;
    height: 60vh;
    .bg-image-var(var(--lobby-panel-image), contain);
    display: flex;
    justify-content: center;

    .chess {
      position: absolute;
      top: 50%;
      left: 50%;
      width: min(100%, calc(60vh * 760 / 1180));
      aspect-ratio: 760 / 1180;
      transform: translate(-50%, -50%);

      img {
        position: absolute;
        width: 19.736842%;
        max-width: 150px;
        height: auto;
        transform: translate(-50%, -50%);
      }

      img:nth-of-type(1) {
        top: 14.40678%;
        left: 86.842105%;
      }

      img:nth-of-type(2) {
        top: 86.610169%;
        left: 10.394737%;
      }
    }

    .funInfo {
      position: absolute;
      top: 50%;
      left: 50%;
      width: min(100%, calc(60vh * 760 / 1180));
      aspect-ratio: 760 / 1180;
      transform: translate(-50%, -50%);
      font-family: "ChessKaiti", "KaiTi", "Microsoft YaHei", serif;

      // font-synthesis: none;
      // font-weight: 400;
      .title {
        position: absolute;
        top: 14.4%;
        left: 50%;
        width: 100%;
        transform: translateX(-50%);
        color: #92683d;
        font-size: 24px;
        // font-synthesis: weight;
        text-align: center;
        line-height: 1;
        font-style: normal;
        font-weight: 700;
      }

      .startGame {
        position: absolute;
        top: 24.576271%;
        left: 50%;
        transform: translateX(-50%);
        // font-synthesis: weight;
        .bg-image-var(var(--start-button-image), 100% 100%);
        width: 77.631579%;
        aspect-ratio: 590 / 156;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        color: #fff4d4;
        font-size: 32px;
        font-weight: 800;
      }

      .startGame,
      .btn {
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition:
          transform 120ms ease,
          filter 120ms ease;
      }

      .startGame:active,
      .btn:active {
        transform: translateX(-50%) translateY(calc(3 / 430 * var(--app-rpx-base))) scale(0.97);
        filter: brightness(0.9) saturate(0.95);
      }

      @media (hover: hover) {

        .startGame:hover,
        .btn:hover {
          filter: brightness(1.05);
        }
      }

      .btn {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        justify-content: center;
        align-items: center;
        .bg-image-var(var(--menu-button-image), 100% 100%);
        width: 65.789474%;
        aspect-ratio: 500 / 126;
        color: #6f2c10;
        font-size: 24px;
        font-weight: 600;
        font-family: "ChessKaiti", "KaiTi", "Microsoft YaHei", serif;
      }

      .gradeList {
        top: 45.338983%;
      }

      .rankingList {
        top: 59.576271%;
      }

      .settings {
        top: 73.813559%;
      }
    }
  }


}
</style>

<style lang="less">
html:has(.gameLobby),
body:has(.gameLobby),
body:has(.gameLobby) #__nuxt,
body:has(.gameLobby) #__nuxt>div {
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}
</style>
