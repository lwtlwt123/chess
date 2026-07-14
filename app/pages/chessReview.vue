<template>
    <div class="review" :style="reviewStyle">
        <div v-if="!pageReady" class="loading">
            <div v-if="!loadError" class="spinner" aria-hidden="true" />
            <div class="loadingText">{{ loadError || '正在加载复盘...' }}</div>
            <button v-if="loadError" type="button" @click="exitReview">返回上一页</button>
        </div>

        <div class="content" :class="{ contentHidden: !pageReady }">
            <div class="header">
                <button class="exit" type="button" aria-label="返回上一页" title="返回上一页" @click="exitReview">
                    <img :src="assetUrl(assetPaths.lobby.quit)" alt="">
                </button>
                <div class="title">对局复盘</div>
                <button class="soundToggle" type="button" :aria-label="musicEnabled ? '关闭声音' : '开启声音'"
                    :title="musicEnabled ? '关闭声音' : '开启声音'" @click="toggleMusic">
                    <img :src="assetUrl(musicEnabled ? assetPaths.lobby.voice : assetPaths.lobby.noVoice)" alt="">
                </button>
            </div>

            <div v-if="gameInfo" class="info">
                <div class="player player--red">
                    <img :src="playerAvatar(gameInfo.redPlayer)" alt="">
                    <div class="playerText">
                        <div class="playerName">{{ playerName(gameInfo.redPlayer) }}</div>
                        <div class="playerCamp">红方 · 先手</div>
                    </div>
                </div>

                <div class="flag" :class="`flag--${gameInfo.winnerCamp || 'draw'}`">
                    {{ resultText }}
                </div>

                <div class="player player--black">
                    <div class="playerText playerText--right">
                        <div class="playerName">{{ playerName(gameInfo.blackPlayer) }}</div>
                        <div class="playerCamp">黑方 · 后手</div>
                    </div>
                    <img :src="playerAvatar(gameInfo.blackPlayer)" alt="">
                </div>
            </div>

            <div class="board">
                <ChessBoardCanvas ref="boardRef" :active="false" @ready="handleBoardReady" />
            </div>

            <div class="progressRow">
                <span>第 {{ value }} / {{ gameData.length }} 步</span>
                <el-slider v-model="value" :max="gameData.length" :show-tooltip="false" />
            </div>

            <div class="controls">
                <button type="button" aria-label="上一步" title="上一步" :disabled="value === 0" @click="previousStep">
                    <img :src="assetUrl(assetPaths.controls.left)" alt="">
                </button>
                <button class="playBtn" type="button" :aria-label="isPlaying ? '暂停' : '播放'"
                    :title="isPlaying ? '暂停' : '播放'" :disabled="gameData.length === 0" @click="togglePlayback">
                    <img :src="assetUrl(playPauseImg)" alt="">
                </button>
                <button type="button" aria-label="下一步" title="下一步" :disabled="value === gameData.length"
                    @click="nextStep">
                    <img :src="assetUrl(assetPaths.controls.right)" alt="">
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ChessBoardCanvas from '~/components/game/ChessBoardCanvas.vue'
import { toCssUrl, useAssetUrl } from '~/composables/useAssetUrl'
import type { ChessMovePayload } from '~/composables/useChessBoard'
import { assetPaths } from '~/constants/assetPaths'
import { getMusicEnabled, saveMusicEnabled } from '~/utils/music'

type ReviewPlayer = {
    userId: number
    username: string
    nickname: string | null
    headImg: string | null
}

type GameInfo = {
    gameId: number
    winnerCamp: 'red' | 'black' | null
    redPlayer: ReviewPlayer
    blackPlayer: ReviewPlayer
}

type ReviewData = {
    game: GameInfo
    moves: ChessMovePayload[]
}

const assetUrl = useAssetUrl()
const route = useRoute()
const boardRef = ref<InstanceType<typeof ChessBoardCanvas> | null>(null)
const gameData = ref<ChessMovePayload[]>([])
const gameInfo = ref<GameInfo | null>(null)
const value = ref(0)
const isDataReady = ref(false)
const isBoardReady = ref(false)
const isInitialBoardReady = ref(false)
const loadError = ref('')
const isPlaying = ref(false)
const musicEnabled = ref(true)
let playbackTimer: number | null = null

const reviewStyle = computed(() => ({
    '--review-bg-image': toCssUrl(assetUrl(assetPaths.lobby.background))
}))
const pageReady = computed(() => isDataReady.value && isBoardReady.value && isInitialBoardReady.value)
const playPauseImg = computed(() => isPlaying.value ? assetPaths.controls.pause : assetPaths.controls.play)
const resultText = computed(() => {
    if (gameInfo.value?.winnerCamp === 'red') return '红方胜'
    if (gameInfo.value?.winnerCamp === 'black') return '黑方胜'
    return '和棋'
})

const playerName = (player: ReviewPlayer) => player.nickname || player.username
const playerAvatar = (player: ReviewPlayer) => assetUrl(player.headImg || assetPaths.lobby.fallbackAvatar)
const exitReview = async() => {
    const ok = await showChessConfirm({
        title: '返回',
        message: '确定返回上一页吗',
        confirmText: '确定',
        cancelText: '取消'
    })

    if (!ok) return

    if (window.history.length > 1) {
        window.history.back()
        return
    }

    navigateTo('/gameLobby')
}
const { $audio } = useNuxtApp()

const toggleMusic = () => {
    musicEnabled.value = !musicEnabled.value
    saveMusicEnabled(musicEnabled.value)

    if (musicEnabled.value) {
        $audio.unlock()
        $audio.play('chess_bgm', { loop: true })
    } else {
        $audio.stop('chess_bgm')
    }
}

const applyCurrentStep = () => {
    if (!isDataReady.value || !isBoardReady.value || !boardRef.value) return
    boardRef.value.applyMoveHistory(gameData.value.slice(0, value.value), {
        playLastMoveSound: value.value > 0
    })
}

const initializeBoard = async () => {
    if (!isDataReady.value || !isBoardReady.value || isInitialBoardReady.value) return
    await nextTick()
    applyCurrentStep()
    isInitialBoardReady.value = true
}

const handleBoardReady = () => {
    isBoardReady.value = true
    void initializeBoard()
}

const stopPlayback = () => {
    if (playbackTimer !== null) {
        window.clearInterval(playbackTimer)
        playbackTimer = null
    }
    isPlaying.value = false
}

const previousStep = () => {
    stopPlayback()
    value.value = Math.max(0, value.value - 1)
}

const nextStep = () => {
    stopPlayback()
    value.value = Math.min(gameData.value.length, value.value + 1)
}

const togglePlayback = () => {
    if (isPlaying.value) return stopPlayback()
    if (!gameData.value.length) return
    if (value.value >= gameData.value.length) value.value = 0

    isPlaying.value = true
    playbackTimer = window.setInterval(() => {
        if (value.value >= gameData.value.length) {
            stopPlayback()
            return
        }
        value.value += 1
    }, 900)
}

const loadReview = async () => {
    const gameId = Number(Array.isArray(route.query.gameId) ? route.query.gameId[0] : route.query.gameId)
    if (!Number.isInteger(gameId) || gameId <= 0) {
        loadError.value = '复盘编号不正确'
        return
    }

    const response = await apiFetch<ReviewData>('/api/chess/review', {
        method: 'GET',
        query: { gameId }
    })

    if (response.code !== 200 || !response.data) {
        loadError.value = response.message || '复盘加载失败'
        return
    }

    gameInfo.value = response.data.game
    gameData.value = response.data.moves
    isDataReady.value = true
    await initializeBoard()
}

watch(value, () => {
    applyCurrentStep()
})

onMounted(() => {
    musicEnabled.value = getMusicEnabled()
    void loadReview()
})

onBeforeUnmount(stopPlayback)
</script>

<style scoped lang="less">
.review {
    width: 100%;
    min-height: 100dvh;
    overflow: hidden;
    .bg-image-var(var(--review-bg-image));

    .content {
        width: 100%;
        max-width: 720px;
        min-height: 100dvh;
        margin: 0 auto;
        padding-top: 10px;
        padding-right: 12px;
        padding-bottom: 14px;
        padding-left: 12px;
        background: rgba(255, 247, 220, 0.08);
    }

    .contentHidden {
        visibility: hidden;
    }

    .loading {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        color: #6f3d22;
        background-image: var(--review-bg-image);
        background-size: cover;
        background-position: center;

        &::before {
            content: '';
            position: absolute;
            inset: 0;
            background: rgba(255, 244, 211, 0.48);
        }

        >* {
            position: relative;
        }

        .spinner {
            width: 42px;
            height: 42px;
            border-width: 4px;
            border-style: solid;
            border-color: rgba(135, 86, 53, 0.22);
            border-top-color: #a23a24;
            border-radius: 50%;
            animation: review-spin 760ms linear infinite;
        }

        .loadingText {
            font-family: "ChessKaiti", "KaiTi", serif;
            font-size: 20px;
            font-weight: 700;
        }

        button {
            min-height: 40px;
            padding-left: 18px;
            padding-right: 18px;
            border-width: 1px;
            border-style: solid;
            border-color: #9b5d36;
            border-radius: 6px;
            color: #fff4d4;
            background: #8d3a22;
            cursor: pointer;
        }
    }

    .header {
        position: relative;
        min-height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;

        .title {
            color: #875635;
            font-family: "ChessKaiti", "KaiTi", serif;
            font-size: 25px;
            letter-spacing: 0;
        }

        .exit,
        .soundToggle {
            position: absolute;
            top: 0;
            width: 40px;
            height: 40px;
            padding: 0;
            border: 0;
            background: transparent;
            cursor: pointer;

            img {
                width: 100%;
                height: 100%;
                display: block;
                object-fit: contain;
            }
        }

        .exit {
            left: 0;
        }

        .soundToggle {
            right: 0;
        }
    }

    .info {
        min-height: 78px;
        margin-top: 8px;
        padding: 9px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 7px;
        border-width: 2px;
        border-style: solid;
        border-color: #e8c585;
        border-radius: 8px;
        background: #23313a;

        .player {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 8px;

            img {
                width: 50px;
                height: 50px;
                flex: 0 0 auto;
                border-width: 2px;
                border-style: solid;
                border-color: #e8c585;
                border-radius: 50%;
                object-fit: cover;
            }
        }

        .player--black {
            justify-content: flex-end;
        }

        .playerText {
            min-width: 0;
        }

        .playerText--right {
            text-align: right;
        }

        .playerName {
            overflow: hidden;
            color: #d9d3bd;
            font-size: 15px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .playerCamp {
            color: #b8b39b;
            font-size: 11px;
            white-space: nowrap;
        }

        .flag {
            min-width: 62px;
            min-height: 28px;
            padding-top: 3px;
            padding-bottom: 3px;
            padding-left: 8px;
            padding-right: 8px;
            display: grid;
            place-items: center;
            border-width: 2px;
            border-style: solid;
            border-color: #e8c585;
            border-radius: 14px;
            color: #faeed1;
            background: #474b45;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
        }

        .flag--red {
            background: #9e2c23;
        }

        .flag--black {
            background: #191919;
        }
    }

    .board {
        width: min(100%, calc((100dvh - (250 / 430 * 100vw)) * 920 / 1010));
        min-width: 0;
        min-height: 0;
        margin-right: auto;
        margin-left: auto;
        margin-top: 6px;
        aspect-ratio: 920 / 1010;
    }

    .progressRow {
        margin-top: 50px;
        color: #2d2f2b;
        font-size: 13px;
        text-align: right;

        :deep(.el-slider) {
            height: 22px;
        }

        :deep(.el-slider__bar) {
            background-color: #d83b2e;
        }

        :deep(.el-slider__button) {
            width: 16px;
            height: 16px;
            border-color: #d83b2e;
        }
    }

    .controls {
        min-height: 62px;
        margin-top: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 32px;

        button {
            width: 44px;
            height: 44px;
            padding: 0;
            border: 0;
            background: transparent;
            cursor: pointer;

            &:disabled {
                opacity: 0.38;
                cursor: default;
            }
        }

        .playBtn {
            width: 82px;
            height: 58px;
        }

        img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
        }
    }

    @media (max-width: 30rem) {
        background-position: 50% center;

        .content {
            padding-top: 8px;
            padding-right: 10px;
            padding-bottom: 10px;
            padding-left: 10px;
        }

        .info {
            min-height: 72px;
            padding: 7px;

            .player {
                img {
                    width: 44px;
                    height: 44px;
                }
            }

            .playerName {
                font-size: 13px;
            }

            .flag {
                min-width: 56px;
                font-size: 12px;
            }
        }

        .board {
            width: min(100%, calc((100dvh - (235 / 430 * 100vw)) * 920 / 1010));
        }

        .controls {
            margin-top: 10px;
            gap: 28px;
        }
    }
}

@keyframes review-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
