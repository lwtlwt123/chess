<template>
  <div class="gameCenter">
    <!-- 棋盘部分 -->
    <div class="board">
      <canvas ref="canvasRef" @click="handleClick"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { chessAssets, initialPieces } from '~/data/chessPieceData'
import { getCoordinates, getPixels, drawPiece } from '~/constants/chessAssets'

// 创建canvas画布
const canvasRef = ref<HTMLCanvasElement | null>(null)


// 生命周期 onMounted dom挂载完成阶段
onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.src = chessAssets.boardWood

  img.onload = () => {
    canvas.width = 920
    canvas.height = 1010

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }

  //初始化棋盘
  init()
})

// 调用点击方法
const handleClick = (event: MouseEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return

  const position = getCoordinates(canvas, event)

  // console.log(position)
}

// 初始化棋盘
const init = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // getPixels(6,0)
  initialPieces.forEach((piece) => {
    const { x, y } = getPixels(piece.gridX, piece.gridY)

    // console.log(piece.name, x, y)
    drawPiece(ctx, piece.imgUrl, piece.gridX, piece.gridY)
  })

}
</script>

<style scoped lang="less">
.gameCenter {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  .board {
    width: min(100vw, calc(80vh * 920 / 1010));
    aspect-ratio: 920 / 1010;
    margin-top: 20vh;

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  }
}
</style>
