<template>
  <canvas ref="canvasRef" class="chess-board-canvas" @pointerdown="handlePointerDown" />
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useChessBoard, type ChessMovePayload } from '~/composables/useChessBoard'
import type { Camp } from '~/data/chessPieceData'

const props = withDefaults(defineProps<{
  playerCamp?: Camp | null
  active?: boolean
}>(), {
  playerCamp: null,
  active: true
})

const emit = defineEmits<{
  (event: 'move', move: ChessMovePayload): void
  (event: 'finish', winner: Camp): void
  (event: 'ready'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const board = useChessBoard(canvasRef, {
  playerCamp: toRef(props, 'playerCamp'),
  isActive: toRef(props, 'active'),
  onMove: (move) => emit('move', move),
  onFinish: (winner) => emit('finish', winner)
})
const { handlePointerDown } = board

watch(board.isBoardReady, (ready) => {
  if (ready) emit('ready')
})

defineExpose(board)
</script>

<style scoped>
.chess-board-canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}
</style>
