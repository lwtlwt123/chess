<template>
  <section class="defeat">
    <div class="quit" @click="clickFn">
      <img :src="assetUrl(assetPaths.lobby.quit)" alt="退出">
    </div>
    <div class="defeat__stage">
      <!-- <div class="defeat__board" aria-hidden="true"></div> -->

      <div class="defeat__rays" aria-hidden="true">
        <span v-for="ray in rays" :key="ray" class="defeat__ray" :style="{ '--rotate': `${ray}deg` }" />
      </div>

      <div class="defeat__confetti" aria-hidden="true">
        <span v-for="piece in confetti" :key="piece.id" class="defeat__confetti-piece" :style="{
          '--w': `${piece.w}px`,
          '--h': `${piece.h}px`,
          '--rotate': `${piece.rotate}deg`,
          '--x': `${piece.x}%`,
          '--y': `${piece.y}%`,
          '--sway-x': `${piece.swayX}cqw`,
          '--float-y': `${piece.floatY}cqw`,
          '--delay': `${piece.delay}ms`,
          '--duration': `${piece.duration}ms`,
          '--color': piece.color
        }" />
      </div>

      <div class="defeat__medal">
        <img :src="assetUrl(assetPaths.game.defeat)" alt="" class="defeat__trophy">
      </div>

      <div class="defeat__card">
        <h2 class="defeat__title">失败</h2>
        <p class="defeat__subtitle">你输了</p>
        <div class="defeat__divider"></div>
        <!-- <p class="defeat__desc">漂亮的一手，礼花已经喷出来了。</p> -->

        <button class="defeat__primary" type="button" @click="$emit('retry')">再来一局</button>
        <button class="defeat__secondary" type="button" @click="$emit('review')">查看复盘</button>
      </div>

      <div class="defeat__watermark" aria-hidden="true">DEFEAT</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useAssetUrl } from '~/composables/useAssetUrl'
import { assetPaths } from '~/constants/assetPaths'

defineEmits<{
  (event: 'retry'): void
  (event: 'review'): void
}>()

const assetUrl = useAssetUrl()
const rays = [-72, -62, -52, -42, -32, -22, -12, 0, 12, 22, 32, 42, 52, 62, 72]

const confettiColors = ['#7f94bd', '#aab4c5', '#d9dee8', '#c8a86d', '#68768d', '#4f5d73']

const confettiCount = 48
const topConfettiCount = 24
const sideConfettiCount = (confettiCount - topConfettiCount) / 2

const confetti = Array.from({ length: confettiCount }, (_, index) => {
  const isTopPiece = index < topConfettiCount
  const localIndex = index - topConfettiCount
  const isLeftSidePiece = localIndex < sideConfettiCount
  const sideIndex = isLeftSidePiece ? localIndex : localIndex - sideConfettiCount
  const side = isTopPiece
    ? (index % 14 < 7 ? -1 : 1)
    : (isLeftSidePiece ? -1 : 1)

  const topColumn = index % 14
  const topRow = Math.floor(index / 14)
  const sideColumn = sideIndex % 4
  const sideRow = Math.floor(sideIndex / 4)

  const x = isTopPiece
    ? 5 + ((topColumn + 0.5 + (topRow % 2) * 0.5) / 14) * 90
    : side < 0
      ? 3 + sideColumn * 3.4 + (sideRow % 2) * 0.9
      : 84.5 + sideColumn * 3.4 + (sideRow % 2) * 0.9
  const y = isTopPiece
    ? 5 + topRow * 5.4 + (((index * 11) % 5) - 2) * 0.5
    : 18 + sideRow * 5.7 + (((sideIndex * 13) % 5) - 2) * 0.5

  return {
    id: index,
    w: 7 + (index % 4) * 3,
    h: 14 + (index % 5) * 5,
    rotate: (index * 31) % 180,
    x,
    y,
    swayX: isTopPiece ? side * (1.2 + (index % 4) * 0.45) : -side * (1.4 + (index % 4) * 0.45),
    floatY: 2 + (index % 4),
    delay: (index * 137) % 2600,
    duration: 5200 + (index % 6) * 640,
    color: confettiColors[index % confettiColors.length]
  }
})

const clickFn = async () => {
  const ok = await showChessConfirm({
    title: '退出',
    message: '确认退出并回到首页？',
    confirmText: '退出',
    cancelText: '取消'
  })

  if (!ok) return
  await navigateTo('/gameLobby', { replace: true })
}
</script>

<style scoped lang="less">
.defeat {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 18%,
      rgba(80, 93, 122, 0.74) 0%,
      rgba(38, 45, 62, 0.72) 32%,
      rgba(16, 22, 32, 0.94) 62%,
      #080d14 100%),
    #080d14;

  .quit {
    position: absolute;
    .rpx(top, 20);
    .rpx(left, 20);
    // top: 0;
    // left: 0;
    z-index: 11;
    .rpx(width, 50);
    .rpx(height, 50);

    img {
      width: 100%;
      height: 100%;
    }
  }
}

.defeat *,
.defeat *::before,
.defeat *::after {
  box-sizing: border-box;
}

.defeat::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 2%;
  width: 92vw;
  .rpx(max-width, 720);
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle,
      rgba(111, 129, 166, 0.48) 0%,
      rgba(76, 88, 116, 0.28) 52%,
      rgba(76, 88, 116, 0) 72%);
}

.defeat::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(9, 14, 22, 0.02) 0%, rgba(8, 12, 18, 0.7) 100%);
}

.defeat__stage {
  position: relative;
  width: min(100dvw, 56.25dvh);
  .rpx(max-width, 720);
  max-width: 100%;
  aspect-ratio: 720 / 1280;
  z-index: 1;
  overflow: hidden;
  container-type: inline-size;
}

.defeat__board {
  position: absolute;
  left: 7%;
  right: 7%;
  top: 12%;
  height: 70%;
  .rpx(border-width, 14);
  border-style: solid;
  border-color: rgba(92, 87, 73, 0.82);
  border-radius: 5%;
  background:
    linear-gradient(rgba(36, 42, 52, 0.38), rgba(25, 31, 40, 0.5)),
    linear-gradient(135deg, rgba(151, 155, 150, 0.5), rgba(57, 61, 61, 0.62));
  box-shadow:
    inset 0 0 0 calc(8 / 430 * 100vw) rgba(26, 27, 25, 0.62),
    0 calc(28 / 430 * 100vw) calc(44 / 430 * 100vw) rgba(0, 0, 0, 0.32);
  opacity: 0.82;
}

.defeat__rays {
  position: absolute;
  left: 50%;
  top: 12%;
  .rpx(width, 1);
  height: 39%;
  z-index: 2;
}

.defeat__ray {
  position: absolute;
  left: 0;
  bottom: 0;
  .rpx(width, 3);
  height: 100%;
  border-radius: 999em;
  transform: translateX(-50%) rotate(var(--rotate));
  transform-origin: 50% 100%;
  background: linear-gradient(180deg, rgba(139, 162, 204, 0.72), rgba(104, 124, 160, 0.08));
  animation: ray-pulse 1800ms ease-in-out infinite alternate;
}

.defeat__confetti {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}

.defeat__confetti-piece {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--w);
  height: var(--h);
  .rpx(border-radius, 2);
  background: var(--color);
  opacity: 0.88;
  transform: translate3d(0, 0, 0) rotate(var(--rotate));
  box-shadow: 0 calc(1 / 430 * 100vw) calc(2 / 430 * 100vw) rgba(0, 0, 0, 0.16);
  animation: confetti-float var(--duration) ease-in-out var(--delay) infinite alternate both;
}

.defeat__medal {
  position: absolute;
  left: 50%;
  top: 20%;
  width: 20%;
  aspect-ratio: 1;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  .rpx(border-width, 8);
  border-style: solid;
  border-color: #30374e;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background:
    radial-gradient(circle at 50% 42%, rgba(144, 154, 181, 0.32) 0%, rgba(144, 154, 181, 0) 48%),
    #535d76;
  box-shadow:
    inset 0 0 0 calc(16 / 430 * 100vw) rgba(32, 38, 57, 0.3),
    0 calc(18 / 430 * 100vw) calc(34 / 430 * 100vw) rgba(9, 13, 22, 0.36),
    0 0 calc(28 / 430 * 100vw) rgba(115, 142, 171, 0.22);
}

.defeat__trophy {
  width: 46%;
  height: 46%;
  object-fit: contain;
  opacity: 0.92;
}

.defeat__card {
  position: absolute;
  left: 11.2%;
  right: 11.2%;
  top: 20.2%;
  min-height: 45.5%;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  .rpx(padding-top, 88);
  .rpx(padding-right, 28);
  .rpx(padding-bottom, 20);
  .rpx(padding-left, 28);
  .rpx(border-radius, 22);
  background:
    radial-gradient(circle at 8% 8%, rgba(255, 255, 255, 0.66) 0 12%, rgba(255, 255, 255, 0) 13%),
    radial-gradient(circle at 96% 92%, rgba(75, 94, 125, 0.24) 0 20%, rgba(75, 94, 125, 0) 21%),
    linear-gradient(180deg, rgba(239, 243, 250, 0.96) 0%, rgba(199, 209, 225, 0.94) 100%);
  .rpx(border-width, 2);
  border-style: solid;
  border-color: rgba(237, 243, 252, 0.86);
  box-shadow: 0 calc(24 / 430 * 100vw) calc(38 / 430 * 100vw) rgba(10, 14, 22, 0.28);
  overflow: hidden;
}

.defeat__card::before {
  content: '';
  position: absolute;
  .rpx(inset, 12);
  .rpx(border-width, 2);
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.56);
  .rpx(border-radius, 18);
  pointer-events: none;
}

.defeat__title {
  margin: 0;
  color: #273041;
  .rpx(font-size, 50);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  text-shadow: 0 calc(6 / 430 * 100vw) calc(8 / 430 * 100vw) rgba(30, 38, 54, 0.22);
}

.defeat__subtitle {
  margin: 0;
  .rpx(margin-top, 18);
  color: #4f5b70;
  .rpx(font-size, 22);
  font-weight: 800;
  line-height: 1.2;
}

.defeat__divider {
  width: 72%;
  .rpx(height, 2);
  .rpx(margin-top, 22);
  .rpx(margin-bottom, 22);
  background: rgba(91, 103, 124, 0.3);
}

.defeat__desc {
  margin: 0;
  color: rgba(92, 89, 85, 0.72);
  .rpx(font-size, 18);
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
}

.defeat__primary,
.defeat__secondary {
  position: relative;
  z-index: 1;
  width: 78%;
  .rpx(height, 56);
  .rpx(border-radius, 12);
  .rpx(font-size, 22);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  cursor: pointer;
}

.defeat__primary {
  .rpx(margin-top, 42);
  color: #fffaf0;
  .rpx(border-width, 5);
  border-style: solid;
  border-color: #3e4d69;
  background: #5a6d8a;
}

.defeat__secondary {
  .rpx(margin-top, 16);
  color: #2d3546;
  .rpx(border-width, 2);
  border-style: solid;
  border-color: rgba(86, 99, 119, 0.42);
  background: rgba(238, 243, 250, 0.42);
}

.defeat__watermark {
  position: absolute;
  left: 50%;
  bottom: 4.8%;
  z-index: 4;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.12);
  font-family: Arial, Helvetica, sans-serif;
  .rpx(font-size, 62);
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
}

@keyframes confetti-float {
  0% {
    opacity: 0.78;
    transform: translate3d(0, 0, 0) rotate(var(--rotate));
  }

  100% {
    opacity: 0.96;
    transform: translate3d(var(--sway-x), var(--float-y), 0) rotate(calc(var(--rotate) + 48deg));
  }
}

@keyframes ray-pulse {
  from {
    opacity: 0.48;
  }

  to {
    opacity: 0.95;
  }
}

@media (max-width: 26.25em) {
  .defeat__card {
    left: 11.2%;
    right: 11.2%;
  }

  .defeat__desc {
    max-width: 14em;
  }
}
</style>
