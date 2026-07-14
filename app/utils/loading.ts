import { ElLoading } from 'element-plus'
import type { LoadingInstance } from 'element-plus/es/components/loading/src/loading'

let loadingInstance: LoadingInstance | null = null

const chessLoadingSvg = `
  <circle class="chess-loading-ring" cx="25" cy="25" r="18" />
  <path class="chess-loading-arc" d="M25 7a18 18 0 0 1 18 18" />
  <text class="chess-loading-piece" x="25" y="32" text-anchor="middle">将</text>
`

export const showLoading = (text = '加载中...') => {
  if (!import.meta.client) return

  loadingInstance = ElLoading.service({
    lock: true,
    text,
    svg: chessLoadingSvg,
    svgViewBox: '0 0 50 50',
    background: 'rgba(31, 17, 8, 0.52)',
    customClass: 'chess-loading'
  })
}

export const closeLoading = () => {
  loadingInstance?.close()
  loadingInstance = null
}
