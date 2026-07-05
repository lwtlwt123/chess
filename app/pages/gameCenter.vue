<template>
  <div class="gameCenter" :style="gameCenterStyle">
    <button v-if="!isStarted" class="start" type="button" @pointerdown.stop.prevent="handleStart">
      开始
    </button>
    <div v-else class="status" :class="{ victory: winnerCamp }">
      {{ statusText }}
    </div>
    <button v-if="isStarted" class="bgm-toggle" type="button" @pointerdown.stop.prevent="toggleBgm">
      {{ isBgmPlaying ? '关闭音乐' : '开启音乐' }}
    </button>
    <!-- 棋盘画布：绘制和点击逻辑都在 useChessBoard 里处理 -->
    <div class="board">
      <canvas ref="canvasRef" @pointerdown="handlePointerDown"></canvas>
    </div>
    <!-- 胜利失败弹出框 -->
    <div class="gameStatus" v-show='winnerCamp'>
      <GameVictory v-show="winnerCamp" />
      <GameDefeat v-show='0' />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { chessAssets, type Camp } from '~/data/chessPieceData'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isStarted = ref(false)
const isBgmPlaying = ref(false)
const { $audio } = useNuxtApp()

const playBgm = () => {
  $audio.play('bgm', { loop: true })
  isBgmPlaying.value = true
}

const stopBgm = () => {
  $audio.stop('bgm')
  isBgmPlaying.value = false
}

const handleStart = () => {
  $audio.unlock()
  playBgm()
  isStarted.value = true
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

// 页面只负责挂载 canvas；棋盘状态、绘制、移动都封装在 useChessBoard。
const { handlePointerDown, currentCamp, checkedCamp, winnerCamp } = useChessBoard(canvasRef)

const gameCenterStyle = computed(() => ({
  '--game-background-image': `url("${chessAssets.gameBackground}")`
}))

const statusText = computed(() => {
  if (winnerCamp.value) return `${campText(winnerCamp.value)}胜利`
  if (checkedCamp.value === currentCamp.value) return `${campText(currentCamp.value)}被将军`

  return `${campText(currentCamp.value)}行棋`
})


</script>

<style scoped lang="less">
.gameCenter {
  width: 100%;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
  background-color: #f7f3ec;
  background-image: var(--game-background-image);
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;


  .board {
    width: min(100%, calc(96dvh * 920 / 1010), 920px);
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

  .gameStatus {
    position: fixed;
    inset: 0;
    z-index: 20;
    overflow: hidden;
  }

  .start,
  .bgm-toggle,
  .status {
    position: absolute;
    z-index: 2;
    min-width: 88px;
    height: 42px;
    background-color: #fff;
    top: 2vh;
    left: 50%;
    transform: translateX(-50%);
    border: 1px solid rgba(98, 78, 48, 0.35);
    border-radius: 6px;
    color: #3e2f1d;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    touch-action: manipulation;
    box-shadow: 0 6px 18px rgba(64, 45, 24, 0.16);
  }

  .status {
    pointer-events: none;

    &.victory {
      color: #9d2820;
    }
  }

  .bgm-toggle {
    top: 8vh;
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
