<template>
  <main class="login" :style="loginAssetStyle">
    <div v-if="!isLoginReady" class="loginLoading" aria-live="polite">
      <svg viewBox="0 0 50 50" class="loginLoading__svg" aria-hidden="true">
        <circle class="loginLoading__ring" cx="25" cy="25" r="18" />
        <path class="loginLoading__arc" d="M25 7a18 18 0 0 1 18 18" />
        <text class="loginLoading__piece" x="25" y="32" text-anchor="middle">将</text>
      </svg>
      <div class="loginLoading__text">资源加载中...</div>
    </div>
    <section class="loginPopBox" aria-labelledby="login-title">
      <el-card class="login-box">
        <h2 id="login-title">游戏登陆</h2>
        <el-form ref="loginRef" :model="form" :rules="rules" label-width="0">
          <el-form-item prop="userName">
            <el-input v-model="form.userName" :disabled="!isLoginReady" prefix-icon="User" clearable placeholder="账号"></el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" :disabled="!isLoginReady" prefix-icon="Lock" show-password placeholder="密码"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :disabled="!isLoginReady" style="width:100%" @click="loginFn">登录</el-button>
          </el-form-item>
          <el-form-item>
            <el-button type="info" :disabled="!isLoginReady" style="width:100%" @click="registerFn">注册</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </section>
  </main>
</template>

<script setup lang="ts">
// await navigateTo('/gameCenter', { replace: true })
import { computed, onBeforeUnmount, onMounted } from "vue";
import { assetPaths } from '~/constants/assetPaths'
import { toCssUrl, useAssetUrl } from '~/composables/useAssetUrl'

const form = ref({ userName: '', password: '' })
const isLoginReady = ref(false)
const rules = ref({
  userName: [{ required: true, message: '必填账号', trigger: 'blur' }],
  password: [{ required: true, message: '必填密码', trigger: 'blur' }]
})
const loginRef = ref(null)

type ApiResponse<T = unknown> = {
  code: number
  message: string
  data?: T
}

type BasicUserData = {
  userId: number
  username: string
}

type UserData = BasicUserData & {
  token: string
  nickname?: string | null
  headImg?: string | null
}

type CheckUserData = {
  exists: boolean
  user: BasicUserData | null
}

const timers = new Set<ReturnType<typeof setTimeout>>()
const assetUrl = useAssetUrl()
const loginAssetStyle = computed<Record<string, string>>(() => ({
  '--login-bg-image': toCssUrl(assetUrl(assetPaths.login.background))
}))

const wait = (delay = 600) => {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      resolve()
    }, delay)

    timers.add(timer)
  })
}

const waitForLoginAssets = async () => {
  const backgroundReady = new Promise<void>((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = assetUrl(assetPaths.login.background)
  })
  const fontsReady = document.fonts
    ? Promise.all([
        document.fonts.load('24px "ChessTitle"', '游戏登陆'),
        document.fonts.ready
      ]).then(() => undefined).catch(() => undefined)
    : Promise.resolve()

  await Promise.race([
    Promise.all([backgroundReady, fontsReady]),
    new Promise<void>((resolve) => window.setTimeout(resolve, 5000))
  ])
}

const closeLoadingLater = async () => {
  await wait()
  closeLoading()
}

const getFormPayload = () => {
  const userName = form.value.userName.trim()
  const password = form.value.password.trim()

  if (!userName || !password) {
    showChessWarning('请先输入账号和密码')
    return null
  }

  return {
    userName,
    password
  }
}
const loginFn = async () => {
  if (!isLoginReady.value) return false

  const payload = getFormPayload()

  if (!payload) return false

  showLoading('登录中...')
  try {
    const res = await $fetch<ApiResponse<UserData>>('/api/login', {
      method: 'POST',
      body: payload
    })

    await closeLoadingLater()

    if (res.code === 200) {
      if (res.data) {
        saveAuthStorage(res.data)
      }

      await navigateTo('/gameLobby')
      showChessSuccess(res.message || '登录成功')
      return true
    }

    showChessWarning(res.message || '登录失败')
    return false
  } catch {
    await closeLoadingLater()
    showChessError('登录失败，请稍后再试')
    return false
  }
}

const registerFn = async () => {
  if (!isLoginReady.value) return

  const payload = getFormPayload()

  if (!payload) return

  showLoading('查询账号中...')
  try {
    const checkRes = await $fetch<ApiResponse<CheckUserData>>('/api/checkUser', {
      method: 'POST',
      body: {
        userName: payload.userName
      }
    })

    await closeLoadingLater()

    if (checkRes.code !== 200 || !checkRes.data) {
      showChessWarning(checkRes.message || '账号查询失败')
      return
    }

    if (checkRes.data.exists) {
      const shouldLogin = await showChessConfirm({
        title: '账号已存在',
        message: '该账号已存在，是否直接登录？',
        confirmText: '登录',
        cancelText: '取消'
      })

      if (shouldLogin) {
        await loginFn()
      }

      return
    }

    const shouldRegister = await showChessConfirm({
      title: '注册账号',
      message: '当前账号不存在，是否立即注册？',
      confirmText: '注册',
      cancelText: '取消'
    })

    if (!shouldRegister) return

    showLoading('注册中...')
    const registerRes = await $fetch<ApiResponse<UserData>>('/api/register', {
      method: 'POST',
      body: payload
    })

    await closeLoadingLater()

    if (registerRes.code !== 200) {
      showChessWarning(registerRes.message || '注册失败')
      return
    }

    if (registerRes.data) {
      saveAuthStorage(registerRes.data)
    }

    await navigateTo('/gameLobby')
    showChessSuccess(registerRes.message || '注册成功')
  } catch {
    await closeLoadingLater()
    showChessError('注册失败，请稍后再试')
  }
}

onMounted(async () => {
  await waitForLoginAssets()
  isLoginReady.value = true

  const authMessage = consumeAuthRedirectMessage()

  if (authMessage) {
    showChessWarning(authMessage)
  }
})

onBeforeUnmount(() => {
  timers.forEach((timer) => clearTimeout(timer))
  timers.clear()
  closeLoading()
})
</script>

<style scoped lang="less">
.login {
  width: var(--app-page-width);
  height: 100dvh;
  margin-right: auto;
  margin-left: auto;
  .bg-image-var(var(--login-bg-image));
  position: relative;
  overflow: hidden;

  .loginLoading {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #7f3d27;
    background: #f7e1ad;
  }

  .loginLoading__svg {
    width: 64px;
    height: 64px;
    animation: chess-loading-spin 1200ms linear infinite;
    filter: drop-shadow(0 calc(8 / 430 * var(--app-rpx-base)) calc(12 / 430 * var(--app-rpx-base)) rgba(47, 24, 9, 0.38));
  }

  .loginLoading__ring {
    fill: rgba(255, 232, 169, 0.18);
    stroke: #f0c15c;
    stroke-width: 3;
  }

  .loginLoading__arc {
    fill: none;
    stroke: #fff0a8;
    stroke-width: 5;
    stroke-linecap: round;
  }

  .loginLoading__piece {
    fill: #8c2519;
    font-family: "ChessTitle", "KaiTi", "Microsoft YaHei", serif;
    font-size: 22px;
    font-weight: 900;
  }

  .loginLoading__text {
    font-family: "ChessKaiti", "KaiTi", serif;
    font-size: 18px;
    font-weight: 700;
  }

  .loginPopBox {
    position: absolute;
    top: 30%;
    left: 50%;
    width: 100%;
    transform: translateX(-50%);

    .el-card {
      border: 0;
      background: transparent;
      box-shadow: none;
      --el-card-border-color: transparent;

      :deep(.el-card__body) {
        overflow: hidden;
        padding: 0;
      }
    }

    h2 {
      margin: 0;
      color: #8f2d1f;
      font-family: "ChessTitle", "KaiTi", "Microsoft YaHei", serif;
      font-size: 74px;
      font-weight: normal;
      line-height: 1;
      text-align: center;
      animation: loginTitlePulse 1.8s ease-in-out infinite;
      text-shadow:
        calc(2 / 430 * var(--app-rpx-base)) calc(2 / 430 * var(--app-rpx-base)) 0 #f5d27a,
        calc(4 / 430 * var(--app-rpx-base)) calc(4 / 430 * var(--app-rpx-base)) 0 #5b351f,
        0 calc(6 / 430 * var(--app-rpx-base)) calc(12 / 430 * var(--app-rpx-base)) rgba(69, 39, 20, 0.35);
    }

    .el-form {
      margin-top: 40px;
      padding: 22px;
    }

    :deep(.el-form-item) {
      margin-bottom: 20px;
    }

    :deep(.el-form-item__content) {
      margin-left: 0 !important;
    }

    :deep(.el-input) {
      width: 100%;
    }

    :deep(.el-input__wrapper),
    :deep(.el-button) {
      min-height: 48px;
    }

    :deep(.el-input__inner) {
      font-size: 18px;
      line-height: 1.2;
    }

    :deep(.el-input__icon) {
      font-size: 18px;
    }

    :deep(.el-button) {
      width: 100%;
      font-family: "ChessTitle", "KaiTi", "Microsoft YaHei", serif;
      font-size: 24px;
      line-height: 1;
      letter-spacing: 4px;
      transform: translateY(0) scale(1);
      transition:
        transform 120ms ease,
        filter 120ms ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }

    :deep(.el-button:active) {
      transform: translateY(calc(3 / 430 * var(--app-rpx-base))) scale(0.98);
      filter: brightness(0.9) saturate(0.95);
    }

    :deep(.el-form-item__error) {
      font-size: 13px;
      line-height: 1.2;
    }

    :deep(.el-button--primary) {
      border: 0;
      background-color: #8f2d1f;
    }
  }
}

@keyframes loginTitlePulse {
  50% {
    transform: scale(1.04);
    text-shadow: 0 0 calc(12 / 430 * var(--app-rpx-base)) #ffd36a;
  }
}
</style>
