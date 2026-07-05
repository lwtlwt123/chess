<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  const { $audio } = useNuxtApp()

  // 先预加载音效，真正点击时直接用 key 播放。
  $audio.preload({
    drop: '/chessPrice/sounds/pick_piece_fast.wav',
    eat: '/chessPrice/sounds/eat_piece_fast.wav',
    check: '/chessPrice/sounds/check_general.wav',
    victory: '/chessPrice/sounds/victory_piece.mp3',
    bgm: '/chessPrice/sounds/chess_bgm.mp3'
  })
})
</script>
