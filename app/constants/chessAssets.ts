import type { Ref } from 'vue'

// 棋盘素材的原始尺寸：canvas 用这个尺寸绘制，页面 CSS 再等比缩放。
export const BOARD_WIDTH = 920
export const BOARD_HEIGHT = 1010

// 棋盘交叉点在素材里的像素位置。
const GRID_LEFT = 130
const GRID_TOP = 122
const CELL_SIZE = 82
const MAX_GRID_X = 8
const MAX_GRID_Y = 9

// 棋子和选中动画的基础参数。
export const PIECE_SIZE = 86
export const SELECTED_PIECE_SIZE = 89
export const SELECTED_LIFT = 8

interface BoardCoordinate {
  x: number
  y: number
  gridX: number
  gridY: number
}

interface CanvasInfo {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

const imageCache = new Map<string, HTMLImageElement>()
const imageLoadingCache = new Map<string, Promise<HTMLImageElement>>()

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

// 把页面点击坐标换算成 canvas 内像素，再吸附到最近的棋盘交叉点。
export const getCoordinates = (canvas: HTMLCanvasElement, event: MouseEvent | PointerEvent): BoardCoordinate => {
  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left) * (canvas.width / rect.width)
  const y = (event.clientY - rect.top) * (canvas.height / rect.height)

  return {
    x,
    y,
    gridX: clamp(Math.round((x - GRID_LEFT) / CELL_SIZE), 0, MAX_GRID_X),
    gridY: clamp(Math.round((y - GRID_TOP) / CELL_SIZE), 0, MAX_GRID_Y)
  }
}

// 图片只加载一次，后续绘制直接读缓存。
export const loadImage = (imgUrl: string): Promise<HTMLImageElement> => {
  const cachedImg = imageCache.get(imgUrl)

  if (cachedImg) {
    return Promise.resolve(cachedImg)
  }

  const loadingImg = imageLoadingCache.get(imgUrl)

  if (loadingImg) {
    return loadingImg
  }

  const imgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      imageCache.set(imgUrl, img)
      imageLoadingCache.delete(imgUrl)
      resolve(img)
    }

    img.onerror = () => {
      imageLoadingCache.delete(imgUrl)
      reject(new Error(`Failed to load image: ${imgUrl}`))
    }

    img.src = imgUrl
  })

  imageLoadingCache.set(imgUrl, imgPromise)

  return imgPromise
}

// 从 ref 里安全取得 canvas 和 2d 上下文。
export const useCanvasFn = (canvasRef: Ref<HTMLCanvasElement | null>): CanvasInfo | null => {
  const canvas = canvasRef.value
  if (!canvas) return null

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  return { canvas, ctx }
}

// 把棋盘格点坐标换算回 canvas 像素坐标。
export const getPixels = (gridX: number, gridY: number) => {
  return {
    x: GRID_LEFT + gridX * CELL_SIZE,
    y: GRID_TOP + gridY * CELL_SIZE
  }
}

// 绘制单个棋子；图片预加载在 useChessBoard 里统一完成。
export const drawPiece = (
  ctx: CanvasRenderingContext2D,
  imgUrl: string,
  gridX: number,
  gridY: number,
  size = PIECE_SIZE,
  offsetY = 0
) => {
  const { x, y } = getPixels(gridX, gridY)
  const cachedImg = imageCache.get(imgUrl)
  if (!cachedImg) return

  const drawY = y + offsetY
  ctx.drawImage(cachedImg, x - size / 2, drawY - size / 2, size, size)
}

// 绘制可移动点位提示。
export const drawMovePoint = (ctx: CanvasRenderingContext2D, gridX: number, gridY: number) => {
  const { x, y } = getPixels(gridX, gridY)

  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 11, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.shadowColor = 'rgba(58, 39, 20, 0.35)'
  ctx.shadowBlur = 8
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, 11, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(105, 81, 47, 0.28)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}
