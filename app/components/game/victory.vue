<template>
  <section class="victory">
    <div class="quit" @click="clickFn">
      <img :src="assetUrl(assetPaths.lobby.quit)" alt="退出">
    </div>
    <div class="victory__stage">
      <!-- <div class="victory__board" aria-hidden="true"></div> -->

      <div class="victory__rays" aria-hidden="true">
        <span v-for="ray in rays" :key="ray" class="victory__ray" :style="{ '--rotate': `${ray}deg` }" />
      </div>

      <div class="victory__confetti" aria-hidden="true">
        <span v-for="piece in confetti" :key="piece.id" class="victory__confetti-piece" :style="{
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

      <div class="victory__medal">
        <img :src="assetUrl(assetPaths.game.victory)" alt="" class="victory__trophy">
      </div>

      <div class="victory__card">
        <h2 class="victory__title">胜 利</h2>
        <p class="victory__subtitle">你赢了</p>
        <div class="victory__divider"></div>
        <!-- <p class="victory__desc">漂亮的一手，礼花已经喷出来了。</p> -->

        <button class="victory__primary" type="button" @click="$emit('retry')">再来一局</button>
        <button class="victory__secondary" type="button" @click="$emit('review')">查看复盘</button>
      </div>

      <div class="victory__watermark" aria-hidden="true">WINNER</div>
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
const props = defineProps(['roomId'])
// console.log(props.roomId);


const assetUrl = useAssetUrl()
const rays = [-72, -62, -52, -42, -32, -22, -12, 0, 12, 22, 32, 42, 52, 62, 72]

const confettiColors = ['#ffd66b', '#ff8d58', '#e84d3d', '#36c7a8', '#6aa7ff', '#fff1a8']

const confettiCount = 156
const topConfettiCount = 84
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
.victory {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 18%,
      rgba(176, 87, 37, 0.62) 0%,
      rgba(116, 39, 25, 0.48) 30%,
      rgba(67, 17, 12, 0.92) 58%,
      #120f12 100%),
    #120f12;
  z-index: 10;

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

.victory *,
.victory *::before,
.victory *::after {
  box-sizing: border-box;
}

.victory::before {
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
      rgba(202, 106, 45, 0.46) 0%,
      rgba(148, 62, 29, 0.26) 52%,
      rgba(148, 62, 29, 0) 72%);
}

.victory::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(74, 18, 11, 0.04) 0%, rgba(15, 12, 15, 0.66) 100%);
}

.victory__stage {
  position: relative;
  width: min(100dvw, 56.25dvh);
  .rpx(max-width, 720);
  max-width: 100%;
  aspect-ratio: 720 / 1280;
  z-index: 1;
  overflow: hidden;
  container-type: inline-size;
}

.victory__board {
  position: absolute;
  left: 7%;
  right: 7%;
  top: 12%;
  height: 70%;
  .rpx(border-width, 14);
  border-style: solid;
  border-color: rgba(151, 119, 83, 0.82);
  border-radius: 5%;
  background:
    linear-gradient(rgba(56, 35, 26, 0.26), rgba(56, 35, 26, 0.42)),
    linear-gradient(135deg, rgba(234, 206, 151, 0.64), rgba(118, 82, 54, 0.62));
  box-shadow:
    inset 0 0 0 calc(8 / 430 * 100vw) rgba(62, 35, 24, 0.66),
    0 calc(28 / 430 * 100vw) calc(44 / 430 * 100vw) rgba(0, 0, 0, 0.32);
  opacity: 0.82;
}

.victory__rays {
  position: absolute;
  left: 50%;
  top: 12%;
  .rpx(width, 1);
  height: 39%;
  z-index: 2;
}

.victory__ray {
  position: absolute;
  left: 0;
  bottom: 0;
  .rpx(width, 3);
  height: 100%;
  border-radius: 999em;
  transform: translateX(-50%) rotate(var(--rotate));
  transform-origin: 50% 100%;
  background: linear-gradient(180deg, rgba(255, 235, 141, 0.95), rgba(255, 214, 95, 0.12));
  animation: ray-pulse 1800ms ease-in-out infinite alternate;
}

.victory__confetti {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}

.victory__confetti-piece {
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

.victory__medal {
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
  border-color: #c52b1f;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background:
    radial-gradient(circle at 50% 42%, rgba(255, 157, 105, 0.4) 0%, rgba(255, 157, 105, 0) 48%),
    #df4d31;
  box-shadow:
    inset 0 0 0 calc(16 / 430 * 100vw) rgba(177, 45, 27, 0.28),
    0 calc(18 / 430 * 100vw) calc(34 / 430 * 100vw) rgba(85, 24, 13, 0.34);
}

.victory__trophy {
  width: 46%;
  height: 46%;
  object-fit: contain;
  opacity: 0.92;
}

.victory__card {
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
    radial-gradient(circle at 8% 8%, rgba(255, 255, 255, 0.72) 0 12%, rgba(255, 255, 255, 0) 13%),
    radial-gradient(circle at 96% 92%, rgba(191, 88, 34, 0.28) 0 20%, rgba(191, 88, 34, 0) 21%),
    linear-gradient(180deg, rgba(255, 252, 222, 0.96) 0%, rgba(255, 209, 111, 0.94) 100%);
  .rpx(border-width, 2);
  border-style: solid;
  border-color: rgba(255, 246, 194, 0.86);
  box-shadow: 0 calc(24 / 430 * 100vw) calc(38 / 430 * 100vw) rgba(83, 35, 14, 0.26);
  overflow: hidden;
}

.victory__card::before {
  content: '';
  position: absolute;
  .rpx(inset, 12);
  .rpx(border-width, 2);
  border-style: solid;
  border-color: rgba(255, 255, 231, 0.64);
  .rpx(border-radius, 18);
  pointer-events: none;
}

.victory__title {
  margin: 0;
  color: #982a18;
  .rpx(font-size, 50);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  text-shadow: 0 calc(6 / 430 * 100vw) calc(8 / 430 * 100vw) rgba(97, 38, 16, 0.22);
}

.victory__subtitle {
  margin: 0;
  .rpx(margin-top, 18);
  color: #a34228;
  .rpx(font-size, 22);
  font-weight: 800;
  line-height: 1.2;
}

.victory__divider {
  width: 72%;
  .rpx(height, 2);
  .rpx(margin-top, 22);
  .rpx(margin-bottom, 22);
  background: rgba(191, 112, 66, 0.34);
}

.victory__desc {
  margin: 0;
  color: rgba(90, 64, 39, 0.72);
  .rpx(font-size, 18);
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
}

.victory__primary,
.victory__secondary {
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

.victory__primary {
  .rpx(margin-top, 42);
  color: #fff8e9;
  .rpx(border-width, 5);
  border-style: solid;
  border-color: #bd2f21;
  background: #e74732;
}

.victory__secondary {
  .rpx(margin-top, 16);
  color: #9b321d;
  .rpx(border-width, 2);
  border-style: solid;
  border-color: rgba(164, 75, 43, 0.42);
  background: rgba(255, 243, 212, 0.42);
}

.victory__watermark {
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
  .victory__card {
    left: 11.2%;
    right: 11.2%;
  }

  .victory__desc {
    max-width: 14em;
  }
}
</style>
