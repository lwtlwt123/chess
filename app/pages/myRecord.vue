<template>
  <div class="myRecord" :style="recordStyle">
    <header class="header">
      <button class="exit" type="button" aria-label="返回大厅" title="返回大厅" @click="exitReview">
        <img :src="assetUrl(assetPaths.lobby.quit)" alt="">
      </button>
      <h1>我的战绩</h1>
      <button class="soundToggle" type="button" :aria-label="musicEnabled ? '关闭声音' : '开启声音'"
        :title="musicEnabled ? '关闭声音' : '开启声音'" @click="toggleMusic">
        <img :src="assetUrl(musicEnabled ? assetPaths.lobby.voice : assetPaths.lobby.noVoice)" alt="">
      </button>
    </header>
    <div class="info">
      <div class="top">
        <div class="userInfo">
          <div class="headImg">
            <img :src="userAvatar" alt="头像">
          </div>
          <div class="othInfo">
            <div class="name">
              {{ userInfo?.nickname || userInfo?.username || '未设置账户名' }}
            </div>
            <div class="id">
              ID:<span>{{ String(userInfo?.userId).padStart(6, '0') || '--' }}</span>
              <span>·</span>
              <span>共奕
                <span>{{ gameInfo.total }}</span>局</span>
            </div>
          </div>
        </div>
      <div class="winRate">
        <span>胜率</span>
        <span>{{ winRate }}</span>
        <span>%</span>
      </div>
      </div>
      <div class="breakLine"></div>
      <div class="bot">
        <div class="left">
          <span>{{ gameInfo.wins }}</span>
          <span>胜</span>
        </div>
        <div class="center">
          <span>{{ gameInfo.losses }}</span>
          <span>负</span>
        </div>
        <div class="right">
          <span>{{ gameInfo.draws }}</span>
          <span>和</span>
        </div>
      </div>

    </div>
    <div class="tab">
      <el-tabs v-model="activeName" class="demo-tabs" @tab-click="handleClick">
        <el-tab-pane label="全部" name="first">
          <div class="list" @scroll="handleListScroll">
            <div v-if="isPageLoading" class="recordLoading">
              <div class="loadingPiece">将</div>
              <div class="loadingText">战绩加载中...</div>
            </div>
            <div class="line" v-for="value in rankList" :key="value.gameId">
              <div class="info">
                <div class="result" :class="resultClass(value)">
                  {{ resultText(value) }}
                </div>
                <div class="userInfo">
                  <div class="name" :class="campClass(value)">
                    {{ playerName(value) }}
                    <span>{{ myCampText(value) }}</span>
                  </div>
                  <div class="time">
                    {{ formatDate(value.startedAt || value.createdAt) }}
                  </div>
                </div>
              </div>
              <button class="review" type="button" @click="openReview(value.gameId)">
                复盘
                <img :src="assetUrl(assetPaths.right)" alt="">
              </button>
            </div>
            <div v-if="isLoadingMore" class="recordLoading">
              <div class="loadingPiece">将</div>
              <div class="loadingText">加载中...</div>
            </div>
            <div v-else-if="!hasMore && rankList.length" class="listText">没有更多了</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="胜局" name="second">
          <div class="list" @scroll="handleListScroll">
            <div class="line" v-for="value in winList" :key="value.gameId">
              <div class="info">
                <div class="result" :class="resultClass(value)">
                  {{ resultText(value) }}
                </div>
                <div class="userInfo">
                  <div class="name" :class="campClass(value)">
                    {{ playerName(value) }}
                    <span>{{ myCampText(value) }}</span>
                  </div>
                  <div class="time">
                    {{ formatDate(value.startedAt || value.createdAt) }}
                  </div>
                </div>
              </div>
              <button class="review" type="button" @click="openReview(value.gameId)">
                复盘
                <img :src="assetUrl(assetPaths.right)" alt="">
              </button>
            </div>
            <div v-if="isLoadingMore" class="recordLoading">
              <div class="loadingPiece">将</div>
              <div class="loadingText">加载中...</div>
            </div>
            <div v-else-if="!hasMore && winList.length" class="listText">没有更多了</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="负局" name="third">
          <div class="list" @scroll="handleListScroll">
            <div class="line" v-for="value in loseList" :key="value.gameId">
              <div class="info">
                <div class="result" :class="resultClass(value)">
                  {{ resultText(value) }}
                </div>
                <div class="userInfo">
                  <div class="name" :class="campClass(value)">
                    {{ playerName(value) }}
                    <span>{{ myCampText(value) }}</span>
                  </div>
                  <div class="time">
                    {{ formatDate(value.startedAt || value.createdAt) }}
                  </div>
                </div>
              </div>
              <button class="review" type="button" @click="openReview(value.gameId)">
                复盘
                <img :src="assetUrl(assetPaths.right)" alt="">
              </button>
            </div>
            <div v-if="isLoadingMore" class="recordLoading">
              <div class="loadingPiece">将</div>
              <div class="loadingText">加载中...</div>
            </div>
            <div v-else-if="!hasMore && loseList.length" class="listText">没有更多了</div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="和棋" name="fourth">
          <div class="list" @scroll="handleListScroll">
            <div class="line" v-for="value in drawList" :key="value.gameId">
              <div class="info">
                <div class="result" :class="resultClass(value)">
                  {{ resultText(value) }}
                </div>
                <div class="userInfo">
                  <div class="name" :class="campClass(value)">
                    {{ playerName(value) }}
                    <span>{{ myCampText(value) }}</span>
                  </div>
                  <div class="time">
                    {{ formatDate(value.startedAt || value.createdAt) }}
                  </div>
                </div>
              </div>
              <button class="review" type="button" @click="openReview(value.gameId)">
                复盘
                <img :src="assetUrl(assetPaths.right)" alt="">
              </button>
            </div>
            <div v-if="isLoadingMore" class="recordLoading">
              <div class="loadingPiece">将</div>
              <div class="loadingText">加载中...</div>
            </div>
            <div v-else-if="!hasMore && drawList.length" class="listText">没有更多了</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { TabsPaneContext } from 'element-plus'
import { toCssUrl, useAssetUrl } from '~/composables/useAssetUrl'
import { assetPaths } from '~/constants/assetPaths'
import { getMusicEnabled, saveMusicEnabled } from '~/utils/music'
import { getAuthStorage, type AuthStorage } from '~/utils/auth'

type GameRecord = {
  gameId: number
  redUserId: number
  blackUserId: number
  winnerUserId: number | null
  startedAt: string | null
  createdAt: string
  opponentUsername: string
  opponentNickname: string | null
  opponentHeadImg: string | null
}

type GameSummary = {
  total: number
  wins: number
  losses: number
  draws: number
}

type HistoryData = {
  page: number
  pageSize: number
  userId: number
  summary: GameSummary
  games: GameRecord[]
}

const activeName = ref('first')
const rankList = ref<GameRecord[]>([])
const gameInfo = ref<GameSummary>({
  total: 0,
  wins: 0,
  losses: 0,
  draws: 0
})
const userInfo = ref<AuthStorage | null>(getAuthStorage())
const currentUserId = ref<number>(userInfo.value?.userId || 0)
const musicEnabled = ref(true)
const page = ref(1)
const pageSize = 20
const isPageLoading = ref(true)
const isLoadingMore = ref(false)

const assetUrl = useAssetUrl()
const { $audio } = useNuxtApp()
const recordStyle = computed(() => ({
  '--record-bg-image': toCssUrl(assetUrl(assetPaths.record.background))
}))
const winRate = computed(() => {
  if (!gameInfo.value.total) return 0

  return Math.round(gameInfo.value.wins / gameInfo.value.total * 100)
})
const hasMore = computed(() => rankList.value.length < gameInfo.value.total)
const winList = computed(() => rankList.value.filter(item => item.winnerUserId === currentUserId.value))
const loseList = computed(() => rankList.value.filter(item => item.winnerUserId !== null && item.winnerUserId !== currentUserId.value))
const drawList = computed(() => rankList.value.filter(item => item.winnerUserId === null))
const userAvatar = computed(() => assetUrl(userInfo.value?.headImg || assetPaths.lobby.fallbackAvatar))

const handleClick = (tab: TabsPaneContext, event: Event) => {
  // console.log(tab, event)
}

const formatDate = (value: string) => {
  return new Date(value).toLocaleString()
}

const isWin = (game: GameRecord) => game.winnerUserId === currentUserId.value
const resultText = (game: GameRecord) => {
  if (game.winnerUserId === null) return '和'

  return isWin(game) ? '胜' : '负'
}
const resultClass = (game: GameRecord) => {
  if (game.winnerUserId === null) return 'draw'

  return isWin(game) ? 'win' : 'lose'
}
const campClass = (game: GameRecord) => game.redUserId === userInfo.value?.userId ? 'red' : ''
const myCampText = (game: GameRecord) => game.redUserId === userInfo.value?.userId ? '红方' : '黑方'
const playerName = (game: GameRecord) => game.opponentNickname || game.opponentUsername || '未知棋手'

const openReview = (gameId: number) => {
  navigateTo({
    path: '/chessReview',
    query: { gameId: String(gameId) }
  })
}

const exitReview = async () => {
  const ok = await showChessConfirm({
    title: '返回',
    message: '确定返回大厅吗',
    confirmText: '确定',
    cancelText: '取消'
  })

  if (!ok) return

  navigateTo('/gameLobby')
}

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

const getRecordFn = async (targetPage = 1) => {
  if (targetPage === 1) {
    isPageLoading.value = true
  } else {
    isLoadingMore.value = true
  }

  try {
    const res = await apiFetch<HistoryData>('/api/chess/history', {
      method: 'GET',
      query: {
        page: targetPage,
        pageSize
      }
    })

    if (res.code !== 200 || !res.data) {
      showChessError(res.message || '战绩加载失败')
      return
    }

    currentUserId.value = res.data.userId
    gameInfo.value = res.data.summary
    rankList.value = targetPage === 1 ? res.data.games : [...rankList.value, ...res.data.games]
    page.value = targetPage
  } catch (error) {
    showChessError(error instanceof Error ? error.message : '服务器错误')
  } finally {
    isPageLoading.value = false
    isLoadingMore.value = false
  }
}

const loadMore = () => {
  if (isPageLoading.value || isLoadingMore.value || !hasMore.value) return

  getRecordFn(page.value + 1)
}

const handleListScroll = (event: Event) => {
  const target = event.target as HTMLElement
  const distance = target.scrollHeight - target.scrollTop - target.clientHeight

  if (distance <= 40) loadMore()
}

onMounted(() => {
  userInfo.value = getAuthStorage()
  currentUserId.value = userInfo.value?.userId || 0
  musicEnabled.value = getMusicEnabled()
  getRecordFn()
})
</script>

<style scoped lang="less">
.myRecord {
  width: 100%;
  min-height: 100dvh;
  overflow: hidden;
  .bg-image-var(var(--record-bg-image));
  padding: 15px;

  header {
    // position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;


    img {
      width: 40px;
      height: 40px;
    }

    h1 {
      margin: 0;
      color: #875635;
      font-family: "ChessKaiti", "KaiTi", serif;
      font-size: 25px;
      letter-spacing: 0;
    }
  }

  >.info {
    margin-top: 20px;
    border-radius: 10px;
    width: 100%;
    // height: 150px;
    border: 3px solid #e2be70;
    background-color: #303730;
    padding: 15px;

    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .userInfo {
        display: flex;

        .headImg {
          width: 50px;
          height: 50px;
          border: 3px solid #e2be70;
          border-radius: 50%;
          margin-right: 10px;

          img {
            width: 100%;
            height: 100%;
          }
        }

        .othInfo {
          color: #fae9bd;

          .name {
            font-size: 17px;
          }

          .id {
            font-size: 12px;
            color: #a69f86;

            span:nth-of-type(2) {
              margin: 0 4px;
            }

            span:nth-of-type(3) {
              span {
                margin: 0 2px;
              }
            }
          }
        }
      }

      .winRate {
        min-width: 92px;
        padding-left: 26px;
        border-left: 1px solid rgba(232, 197, 133, 0.28);
        text-align: center;

        span:nth-of-type(1) {
          color: #b1aa90;
          font-size: 12px;
          display: block;
        }

        span:nth-of-type(2) {
          color: #f4cd73;
          font-size: 25px;
          font-weight: 800;
        }

        span:nth-of-type(3) {
          color: #f4cd73;
          font-size: 16px;
          // font-weight: 800;
        }
      }
    }

    .breakLine {
      display: flex;
      align-items: center;
      width: 100%;
      height: 1px;
      margin: 12px 0;

      &::before {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(232, 197, 133, 0.28);
      }

      &::after {
        content: '';
        width: 92px;
        height: 1px;
        margin-left: 0px;
        background: rgba(232, 197, 133, 0.28);
      }
    }

    .bot {
      display: flex;
      align-items: center;
      justify-content: space-around;

      >div {
        display: flex;
        flex-direction: column;
        align-items: center;

        span:nth-of-type(1) {
          color: #f4cd73;
          font-size: 22px;
          font-weight: 800;
        }

        span:nth-of-type(2) {
          margin-top: 4px;
          color: #b1aa90;
          font-size: 13px;
        }
      }

      .left {
        span:nth-of-type(1) {
          color: #ef6258;
        }
      }

      .center {
        span:nth-of-type(1) {
          color: #f2ead4;
        }
      }
    }

  }

  .tab {
    margin-top: 20px;

    :deep(.el-tabs__item) {
      color: #816247;
    }

    :deep(.is-active) {
      color: #8f2d21;
      font-weight: 800;
    }

    :deep(.el-tabs__nav-wrap:after) {
      background-color: #e2cc97;
    }

    :deep(.el-tabs__active-bar) {
      background-color: #a6422d;
    }

    .list {
      .recordLoading {
        min-height: 58px;
      }

      .listText {
        padding: 14px 0;
        color: #816247;
        font-size: 13px;
        text-align: center;
      }

      .line:nth-of-type(1) {
        border-top: 3px solid #e3cc97;
      }

      max-height: 580px;
      overflow-y: scroll;

      .line {
        width: 100%;
        padding: 20px;
        background-color: #fbefc8;
        border: 3px solid #e3cc97;
        border-top: none;
        display: flex;
        align-items: center;
        justify-content: space-between;

        .info {
          display: flex;
          align-items: center;

          .result {
            width: 36px;
            height: 36px;
            margin-right: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-family: "ChessKaiti", "KaiTi", serif;
            font-size: 22px;
            // color: #b6584a;
            font-weight: 800;
            box-shadow:
              inset 0 2px 4px rgba(255, 255, 255, 0.35),
              inset 0 -4px 6px rgba(88, 45, 18, 0.22),
              0 3px 8px rgba(92, 55, 28, 0.22);

          }

          .win {
            color: #b6584a;
          }

          .lose {
            color: #303730;
          }

          .userInfo {
            .name {
              font-size: 20px;
              font-weight: 800;

              span {
                padding: 2px 8px;
                font-size: 12px;
                color: #87827a;
                background-color: #e4dfd4;
                border: 1px solid #87827a;
                border-radius: 5px;
                text-align: center;
                margin-left: 4px;
                display: inline-block;
                transform: translateY(-6.5px);
              }
            }

            .red {
              span {
                background-color: #fae3d4;
                border: 1px solid #c17762;
                color: #c17762;
              }
            }

            .time {
              font-size: 14px;
              color: #bcaa8f;
              font-weight: 600;
            }
          }
        }

        .review {
          padding: 0;
          border: 0;
          font-size: 20px;
          color: #a6624b;
          background: transparent;
          font-weight: 1000;
          display: flex;
          align-items: center;
          cursor: pointer;

          img {
            width: 18px;
            height: auto;
            margin-left: 4px;
          }
        }
      }
    }
  }

}

.recordLoading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #875635;

  .loadingPiece {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #e2be70;
    border-radius: 50%;
    color: #8f2d21;
    background: #fbefc8;
    font-family: "ChessKaiti", "KaiTi", serif;
    font-size: 20px;
    font-weight: 800;
    animation: record-piece-spin 900ms linear infinite;
  }

  .loadingText {
    color: #816247;
    font-size: 14px;
    font-weight: 700;
  }
}

.recordLoading--page {
  position: fixed;
  inset: 0;
  z-index: 30;
  flex-direction: column;
  background: rgba(255, 239, 180, 0.72);

  .loadingPiece {
    width: 52px;
    height: 52px;
    font-size: 28px;
  }
}

@keyframes record-piece-spin {
  to {
    transform: rotate(360deg);
  }
}

.myRecord::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 239, 180, 0.55);
  pointer-events: none;
}

.myRecord>* {
  position: relative;
  z-index: 1;
}
</style>
