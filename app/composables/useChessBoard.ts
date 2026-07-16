import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { initialPieces, type Camp, type ChessPiece } from '~/data/chessPieceData'
import { assetPaths } from '~/constants/assetPaths'
import { useAssetUrl } from '~/composables/useAssetUrl'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_SIZE,
  SELECTED_LIFT,
  SELECTED_PIECE_SIZE,
  drawMovePoint,
  drawPiece,
  getCoordinates,
  getPixels,
  loadImage,
  useCanvasFn
} from '~/utils/chessCanvas'
import { closeLoading, showLoading } from '~/utils/loading'
import { showChessWarning } from '~/utils/message'

const SELECT_ANIMATION_DURATION = 260
const TURN_HIGHLIGHT_DURATION = 3200
const easeOutSine = (value: number) => Math.sin((value * Math.PI) / 2)

interface BoardPoint {
  gridX: number
  gridY: number
}

interface BlockedMove extends BoardPoint {
  blockX: number
  blockY: number
}

interface SelectPieceOptions {
  playDrop?: boolean
}

export interface ChessMovePayload {
  pieceId: string
  camp: Camp
  fromGridX: number
  fromGridY: number
  toGridX: number
  toGridY: number
  capturedPieceId: string | null
}

interface UseChessBoardOptions {
  playerCamp?: Ref<Camp | null>
  isActive?: Ref<boolean>
  onMove?: (move: ChessMovePayload) => void
  onFinish?: (winner: Camp) => void
}

interface ApplyPieceMoveOptions {
  emit?: boolean
  playSound?: boolean
  showResult?: boolean
}

interface ApplyRemoteMoveOptions {
  force?: boolean
  playSound?: boolean
}

interface ApplyMoveHistoryOptions {
  playLastMoveSound?: boolean
}

type ChessPieces = ChessPiece[]

const LINE_DIRECTIONS: BoardPoint[] = [
  { gridX: 1, gridY: 0 },
  { gridX: -1, gridY: 0 },
  { gridX: 0, gridY: 1 },
  { gridX: 0, gridY: -1 }
]

const DIAGONAL_DIRECTIONS: BoardPoint[] = [
  { gridX: 1, gridY: 1 },
  { gridX: 1, gridY: -1 },
  { gridX: -1, gridY: 1 },
  { gridX: -1, gridY: -1 }
]

const HORSE_MOVES: BlockedMove[] = [
  { gridX: 2, gridY: 1, blockX: 1, blockY: 0 },
  { gridX: 2, gridY: -1, blockX: 1, blockY: 0 },
  { gridX: -2, gridY: 1, blockX: -1, blockY: 0 },
  { gridX: -2, gridY: -1, blockX: -1, blockY: 0 },
  { gridX: 1, gridY: 2, blockX: 0, blockY: 1 },
  { gridX: -1, gridY: 2, blockX: 0, blockY: 1 },
  { gridX: 1, gridY: -2, blockX: 0, blockY: -1 },
  { gridX: -1, gridY: -2, blockX: 0, blockY: -1 }
]

const ELEPHANT_MOVES: BlockedMove[] = [
  { gridX: 2, gridY: 2, blockX: 1, blockY: 1 },
  { gridX: 2, gridY: -2, blockX: 1, blockY: -1 },
  { gridX: -2, gridY: 2, blockX: -1, blockY: 1 },
  { gridX: -2, gridY: -2, blockX: -1, blockY: -1 }
]

const isInsideBoard = (gridX: number, gridY: number) => {
  return gridX >= 0 && gridX <= 8 && gridY >= 0 && gridY <= 9
}

const isInsidePalace = (piece: ChessPiece, gridX: number, gridY: number) => {
  const isInsidePalaceX = gridX >= 3 && gridX <= 5
  const isInsidePalaceY = piece.camp === 'red'
    ? gridY >= 7 && gridY <= 9
    : gridY >= 0 && gridY <= 2

  return isInsidePalaceX && isInsidePalaceY
}

const isInsideElephantSide = (piece: ChessPiece, gridY: number) => {
  return piece.camp === 'red' ? gridY >= 5 : gridY <= 4
}

const hasCrossedRiver = (piece: ChessPiece) => {
  return piece.camp === 'red' ? piece.gridY <= 4 : piece.gridY >= 5
}

const hasPoint = (points: BoardPoint[], gridX: number, gridY: number) => {
  return points.some((point) => point.gridX === gridX && point.gridY === gridY)
}

export const useChessBoard = (
  canvasRef: Ref<HTMLCanvasElement | null>,
  options: UseChessBoardOptions = {}
) => {
  const assetUrl = useAssetUrl()
  // 棋盘状态：当前选中的棋子，以及当前还在棋盘上的棋子列表。
  const selectedPieceId = ref<string | null>(null)
  const createPiecesState = () => initialPieces.map((piece) => ({
    ...piece,
    imgUrl: assetUrl(piece.imgUrl)
  }))

  const pieces = ref(createPiecesState())
  const movablePoints = ref<BoardPoint[]>([])
  const currentCamp = ref<Camp>('red')
  const checkedCamp = ref<Camp | null>(null)
  const winnerCamp = ref<Camp | null>(null)
  const isBoardReady = ref(false)
  const lastMoveFrom = ref<BoardPoint | null>(null)
  const { $audio } = useNuxtApp()

  // canvas 不会自动响应数据变化，所以状态变化后都要主动 render。
  let boardImg: HTMLImageElement | null = null
  let selectedProgress = 0
  let animationFrame = 0
  let turnHighlightFrame = 0
  let turnHighlightStartedAt = 0

  const isBoardActive = () => {
    return options.isActive?.value ?? true
  }

  const isControlledByPlayer = (camp: Camp) => {
    return options.playerCamp?.value ? options.playerCamp.value === camp : true
  }

  const findSelectedPiece = () => {
    return pieces.value.find((piece) => piece.id === selectedPieceId.value)
  }

  const findPieceAt = (gridX: number, gridY: number) => {
    return pieces.value.find((piece) => piece.gridX === gridX && piece.gridY === gridY)
  }

  const findPieceAtIn = (boardPieces: ChessPieces, gridX: number, gridY: number) => {
    return boardPieces.find((piece) => piece.gridX === gridX && piece.gridY === gridY)
  }

  const getOpponentCamp = (camp: Camp) => {
    return camp === 'red' ? 'black' : 'red'
  }

  const shouldShowTurnHighlight = (piece: ChessPiece) => {
    const playerCamp = options.playerCamp?.value

    return playerCamp ? piece.camp === playerCamp : piece.camp === currentCamp.value
  }

  const drawTurnHighlight = (ctx: CanvasRenderingContext2D, piece: ChessPiece) => {
    if (piece.id === selectedPieceId.value) return
    if (winnerCamp.value || !isBoardActive()) return

    const now = performance.now()

    if (!turnHighlightStartedAt) {
      turnHighlightStartedAt = now
    }

    const progress = ((now - turnHighlightStartedAt) % TURN_HIGHLIGHT_DURATION) / TURN_HIGHLIGHT_DURATION
    const pulse = Math.sin(progress * Math.PI)
    const { x, y } = getPixels(piece.gridX, piece.gridY)
    const radius = PIECE_SIZE * (0.48 + pulse * 0.04)

    ctx.save()
    ctx.globalAlpha = pulse * 0.72
    ctx.lineWidth = 2 + pulse * 2.4
    ctx.strokeStyle = '#35ff8d'
    ctx.shadowColor = 'rgba(53, 255, 141, 0.82)'
    ctx.shadowBlur = pulse * 14
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const canMoveTo = (
    piece: ChessPiece,
    gridX: number,
    gridY: number,
    boardPieces: ChessPieces = pieces.value
  ) => {
    if (!isInsideBoard(gridX, gridY)) return false

    const targetPiece = findPieceAtIn(boardPieces, gridX, gridY)
    return !targetPiece || targetPiece.camp !== piece.camp
  }

  const pushMove = (
    moves: BoardPoint[],
    piece: ChessPiece,
    gridX: number,
    gridY: number,
    boardPieces: ChessPieces = pieces.value
  ) => {
    if (canMoveTo(piece, gridX, gridY, boardPieces)) {
      moves.push({ gridX, gridY })
    }
  }

  const hasLineBlocker = (
    boardPieces: ChessPieces,
    fromGridX: number,
    fromGridY: number,
    toGridX: number,
    toGridY: number
  ) => {
    if (fromGridX !== toGridX && fromGridY !== toGridY) return true

    const stepGridX = Math.sign(toGridX - fromGridX)
    const stepGridY = Math.sign(toGridY - fromGridY)
    let nextGridX = fromGridX + stepGridX
    let nextGridY = fromGridY + stepGridY

    while (nextGridX !== toGridX || nextGridY !== toGridY) {
      if (findPieceAtIn(boardPieces, nextGridX, nextGridY)) {
        return true
      }

      nextGridX += stepGridX
      nextGridY += stepGridY
    }

    return false
  }

  const countLineBlockers = (
    boardPieces: ChessPieces,
    fromGridX: number,
    fromGridY: number,
    toGridX: number,
    toGridY: number
  ) => {
    if (fromGridX !== toGridX && fromGridY !== toGridY) return Infinity

    const stepGridX = Math.sign(toGridX - fromGridX)
    const stepGridY = Math.sign(toGridY - fromGridY)
    let count = 0
    let nextGridX = fromGridX + stepGridX
    let nextGridY = fromGridY + stepGridY

    while (nextGridX !== toGridX || nextGridY !== toGridY) {
      if (findPieceAtIn(boardPieces, nextGridX, nextGridY)) {
        count += 1
      }

      nextGridX += stepGridX
      nextGridY += stepGridY
    }

    return count
  }

  const isPieceAttackingPoint = (
    piece: ChessPiece,
    targetGridX: number,
    targetGridY: number,
    boardPieces: ChessPieces
  ) => {
    const diffGridX = targetGridX - piece.gridX
    const diffGridY = targetGridY - piece.gridY
    const absGridX = Math.abs(diffGridX)
    const absGridY = Math.abs(diffGridY)

    switch (piece.name) {
      case 'ju':
        return (piece.gridX === targetGridX || piece.gridY === targetGridY)
          && !hasLineBlocker(boardPieces, piece.gridX, piece.gridY, targetGridX, targetGridY)

      case 'pao':
        return (piece.gridX === targetGridX || piece.gridY === targetGridY)
          && countLineBlockers(boardPieces, piece.gridX, piece.gridY, targetGridX, targetGridY) === 1

      case 'ma': {
        const horseMove = HORSE_MOVES.find((move) => move.gridX === diffGridX && move.gridY === diffGridY)
        if (!horseMove) return false

        return !findPieceAtIn(boardPieces, piece.gridX + horseMove.blockX, piece.gridY + horseMove.blockY)
      }

      case 'xiang': {
        if (absGridX !== 2 || absGridY !== 2) return false
        if (!isInsideElephantSide(piece, targetGridY)) return false

        return !findPieceAtIn(boardPieces, piece.gridX + diffGridX / 2, piece.gridY + diffGridY / 2)
      }

      case 'shi':
        return absGridX === 1 && absGridY === 1 && isInsidePalace(piece, targetGridX, targetGridY)

      case 'shuai':
      case 'jiang':
        if (piece.gridX === targetGridX && !hasLineBlocker(boardPieces, piece.gridX, piece.gridY, targetGridX, targetGridY)) {
          return true
        }

        return absGridX + absGridY === 1 && isInsidePalace(piece, targetGridX, targetGridY)

      case 'bing':
      case 'zu': {
        const forwardGridY = piece.camp === 'red' ? -1 : 1
        if (diffGridX === 0 && diffGridY === forwardGridY) return true

        return hasCrossedRiver(piece) && absGridX === 1 && diffGridY === 0
      }
    }
  }

  const isCampInCheck = (camp: ChessPiece['camp'], boardPieces: ChessPieces = pieces.value) => {
    const generalName = camp === 'red' ? 'shuai' : 'jiang'
    const general = boardPieces.find((piece) => piece.name === generalName)
    if (!general) return false

    return boardPieces.some((piece) => {
      if (piece.camp === camp) return false

      return isPieceAttackingPoint(piece, general.gridX, general.gridY, boardPieces)
    })
  }

  const getBoardAfterMove = (
    boardPieces: ChessPieces,
    piece: ChessPiece,
    targetGridX: number,
    targetGridY: number
  ) => {
    return boardPieces
      .filter((item) => {
        if (item.id === piece.id) return true
        return !(item.gridX === targetGridX && item.gridY === targetGridY && item.camp !== piece.camp)
      })
      .map((item) => {
        if (item.id !== piece.id) return { ...item }

        return {
          ...item,
          gridX: targetGridX,
          gridY: targetGridY
        }
      })
  }

  // 车：横竖直线走，遇到第一个棋子就停；敌方可吃，己方不可走。
  const getRookMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    const moves: BoardPoint[] = []

    LINE_DIRECTIONS.forEach((direction) => {
      let nextGridX = piece.gridX + direction.gridX
      let nextGridY = piece.gridY + direction.gridY

      while (isInsideBoard(nextGridX, nextGridY)) {
        const blockingPiece = findPieceAtIn(boardPieces, nextGridX, nextGridY)

        if (!blockingPiece) {
          moves.push({ gridX: nextGridX, gridY: nextGridY })
        } else {
          if (blockingPiece.camp !== piece.camp) {
            moves.push({ gridX: nextGridX, gridY: nextGridY })
          }
          break
        }

        nextGridX += direction.gridX
        nextGridY += direction.gridY
      }
    })

    return moves
  }

  // 炮：平走时和车一样；吃子时中间必须隔一个炮架。
  const getCannonMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    const moves: BoardPoint[] = []

    LINE_DIRECTIONS.forEach((direction) => {
      let hasScreen = false
      let nextGridX = piece.gridX + direction.gridX
      let nextGridY = piece.gridY + direction.gridY

      while (isInsideBoard(nextGridX, nextGridY)) {
        const blockingPiece = findPieceAtIn(boardPieces, nextGridX, nextGridY)

        if (!hasScreen) {
          if (!blockingPiece) {
            moves.push({ gridX: nextGridX, gridY: nextGridY })
          } else {
            hasScreen = true
          }
        } else if (blockingPiece) {
          if (blockingPiece.camp !== piece.camp) {
            moves.push({ gridX: nextGridX, gridY: nextGridY })
          }
          break
        }

        nextGridX += direction.gridX
        nextGridY += direction.gridY
      }
    })

    return moves
  }

  // 马：走日字，马腿位置有棋子时不能走。
  const getHorseMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    const moves: BoardPoint[] = []

    HORSE_MOVES.forEach((move) => {
      const legPiece = findPieceAtIn(boardPieces, piece.gridX + move.blockX, piece.gridY + move.blockY)
      if (legPiece) return

      pushMove(moves, piece, piece.gridX + move.gridX, piece.gridY + move.gridY, boardPieces)
    })

    return moves
  }

  // 相/象：走田字，象眼位置有棋子时不能走，且不能过河。
  const getElephantMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    const moves: BoardPoint[] = []

    ELEPHANT_MOVES.forEach((move) => {
      const targetGridX = piece.gridX + move.gridX
      const targetGridY = piece.gridY + move.gridY

      if (!isInsideBoard(targetGridX, targetGridY)) return
      if (!isInsideElephantSide(piece, targetGridY)) return

      const eyePiece = findPieceAtIn(boardPieces, piece.gridX + move.blockX, piece.gridY + move.blockY)
      if (eyePiece) return

      pushMove(moves, piece, targetGridX, targetGridY, boardPieces)
    })

    return moves
  }

  // 士/仕：只在九宫里斜走一格。
  const getAdvisorMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    const moves: BoardPoint[] = []

    DIAGONAL_DIRECTIONS.forEach((direction) => {
      const targetGridX = piece.gridX + direction.gridX
      const targetGridY = piece.gridY + direction.gridY

      if (!isInsidePalace(piece, targetGridX, targetGridY)) return

      pushMove(moves, piece, targetGridX, targetGridY, boardPieces)
    })

    return moves
  }

  // 帅/将：只在九宫里横竖走一格；同一路无遮挡时也可以直接吃对方将帅。
  const getGeneralMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    const moves: BoardPoint[] = []

    LINE_DIRECTIONS.forEach((direction) => {
      const targetGridX = piece.gridX + direction.gridX
      const targetGridY = piece.gridY + direction.gridY

      if (!isInsidePalace(piece, targetGridX, targetGridY)) return

      pushMove(moves, piece, targetGridX, targetGridY, boardPieces)
    })

    const enemyGeneral = boardPieces.find((item) => {
      return item.camp !== piece.camp && (item.name === 'shuai' || item.name === 'jiang')
    })

    if (!enemyGeneral || enemyGeneral.gridX !== piece.gridX) {
      return moves
    }

    const minGridY = Math.min(piece.gridY, enemyGeneral.gridY)
    const maxGridY = Math.max(piece.gridY, enemyGeneral.gridY)
    const hasBlockingPiece = boardPieces.some((item) => {
      return item.gridX === piece.gridX && item.gridY > minGridY && item.gridY < maxGridY
    })

    if (!hasBlockingPiece) {
      moves.push({ gridX: enemyGeneral.gridX, gridY: enemyGeneral.gridY })
    }

    return moves
  }

  // 兵/卒：只前进；过河后可以左右走，不能后退。
  const getSoldierMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    const moves: BoardPoint[] = []
    const forwardGridY = piece.camp === 'red' ? piece.gridY - 1 : piece.gridY + 1

    pushMove(moves, piece, piece.gridX, forwardGridY, boardPieces)

    if (hasCrossedRiver(piece)) {
      pushMove(moves, piece, piece.gridX - 1, piece.gridY, boardPieces)
      pushMove(moves, piece, piece.gridX + 1, piece.gridY, boardPieces)
    }

    return moves
  }

  // 只计算这个棋子按自身规则能走到哪里，用来画白点提示。
  const getBasicMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    switch (piece.name) {
      case 'ju':
        return getRookMoves(piece, boardPieces)
      case 'pao':
        return getCannonMoves(piece, boardPieces)
      case 'ma':
        return getHorseMoves(piece, boardPieces)
      case 'xiang':
        return getElephantMoves(piece, boardPieces)
      case 'shi':
        return getAdvisorMoves(piece, boardPieces)
      case 'shuai':
      case 'jiang':
        return getGeneralMoves(piece, boardPieces)
      case 'bing':
      case 'zu':
        return getSoldierMoves(piece, boardPieces)
    }
  }

  const getLegalMoves = (piece: ChessPiece) => {
    return getBasicMoves(piece)
  }

  const getCheckResponseMoves = (piece: ChessPiece, boardPieces: ChessPieces = pieces.value) => {
    return getBasicMoves(piece, boardPieces).filter((point) => {
      const nextPieces = getBoardAfterMove(boardPieces, piece, point.gridX, point.gridY)
      return !isCampInCheck(piece.camp, nextPieces)
    })
  }

  const hasAnyCheckResponse = (camp: Camp, boardPieces: ChessPieces = pieces.value) => {
    return boardPieces.some((piece) => {
      return piece.camp === camp && getCheckResponseMoves(piece, boardPieces).length > 0
    })
  }

  const isCampCheckmated = (camp: Camp, boardPieces: ChessPieces = pieces.value) => {
    return isCampInCheck(camp, boardPieces) && !hasAnyCheckResponse(camp, boardPieces)
  }

  // 重新绘制整张棋盘：背景、全部棋子、可走白点都在这里画。
  const renderBoard = () => {
    const canvasInfo = useCanvasFn(canvasRef)
    if (!canvasInfo || !boardImg) return

    const { canvas, ctx } = canvasInfo
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(boardImg, 0, 0, canvas.width, canvas.height)

    pieces.value.forEach((piece) => {
      if (shouldShowTurnHighlight(piece)) {
        drawTurnHighlight(ctx, piece)
      }
    })

    pieces.value.forEach((piece) => {
      const isSelected = piece.id === selectedPieceId.value

      drawPiece(
        ctx,
        piece.imgUrl,
        piece.gridX,
        piece.gridY,
        isSelected ? PIECE_SIZE + (SELECTED_PIECE_SIZE - PIECE_SIZE) * selectedProgress : undefined,
        isSelected ? -SELECTED_LIFT * selectedProgress : 0
      )
    })

    if (lastMoveFrom.value) {
      drawMovePoint(ctx, lastMoveFrom.value.gridX, lastMoveFrom.value.gridY)
    }

    movablePoints.value.forEach((point) => {
      drawMovePoint(ctx, point.gridX, point.gridY)
    })
  }

  // 选中棋子时的上浮动画，progress 从 0 走到 1。
  const animateSelected = () => {
    cancelAnimationFrame(animationFrame)

    selectedProgress = 0
    renderBoard()

    const startTime = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / SELECT_ANIMATION_DURATION, 1)
      selectedProgress = easeOutSine(progress)
      renderBoard()

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick)
      }
    }

    animationFrame = requestAnimationFrame(tick)
  }

  const animateTurnHighlight = () => {
    cancelAnimationFrame(turnHighlightFrame)
    turnHighlightStartedAt = 0

    const tick = () => {
      renderBoard()
      turnHighlightFrame = requestAnimationFrame(tick)
    }

    turnHighlightFrame = requestAnimationFrame(tick)
  }

  const resetBoard = () => {
    cancelAnimationFrame(animationFrame)

    pieces.value = createPiecesState()
    selectedPieceId.value = null
    movablePoints.value = []
    currentCamp.value = 'red'
    turnHighlightStartedAt = 0
    checkedCamp.value = null
    winnerCamp.value = null
    lastMoveFrom.value = null
    selectedProgress = 0
    renderBoard()
  }

  const finishGame = (winner: Camp, options: { playSound?: boolean } = {}) => {
    const { playSound = true } = options

    cancelAnimationFrame(animationFrame)

    showLoading()

    window.setTimeout(() => {
      closeLoading()
      winnerCamp.value = winner
    }, 3000);

    checkedCamp.value = null
    selectedPieceId.value = null
    movablePoints.value = []
    selectedProgress = 0

    if (playSound) {
      $audio.play('victory')
    }

    renderBoard()
  }

  // 切换选中状态：传入棋子 id 表示选中，传入 null 表示放下。
  const selectPiece = (pieceId: string | null, options: SelectPieceOptions = {}) => {
    const { playDrop = true } = options
    const previousPieceId = selectedPieceId.value

    if (winnerCamp.value || !isBoardActive()) return

    cancelAnimationFrame(animationFrame)
    selectedPieceId.value = pieceId

    const selectedPiece = findSelectedPiece()

    if (selectedPiece && (!isControlledByPlayer(selectedPiece.camp) || selectedPiece.camp !== currentCamp.value)) {
      selectedPieceId.value = previousPieceId
      renderBoard()
      return
    }

    if (!selectedPiece) {
      movablePoints.value = []

      if (previousPieceId && playDrop) {
        $audio.play('drop')
      }

      selectedProgress = 0
      renderBoard()
      return
    }

    movablePoints.value = getBasicMoves(selectedPiece)
    animateSelected()
  }

  const applyPieceMove = (
    piece: ChessPiece,
    gridX: number,
    gridY: number,
    moveOptions: ApplyPieceMoveOptions = {}
  ) => {
    const { emit = false, playSound = true, showResult = true } = moveOptions
    const fromGridX = piece.gridX
    const fromGridY = piece.gridY
    const targetPiece = findPieceAt(gridX, gridY)
    const capturedPiece = targetPiece && targetPiece.id !== piece.id ? targetPiece : null

    lastMoveFrom.value = { gridX: fromGridX, gridY: fromGridY }

    if (capturedPiece) {
      pieces.value = pieces.value.filter((item) => item.id !== capturedPiece.id)
    }

    piece.gridX = gridX
    piece.gridY = gridY

    const movePayload: ChessMovePayload = {
      pieceId: piece.id,
      camp: piece.camp,
      fromGridX,
      fromGridY,
      toGridX: gridX,
      toGridY: gridY,
      capturedPieceId: capturedPiece?.id ?? null
    }

    if (emit) {
      options.onMove?.(movePayload)
    }

    const opponentCamp = getOpponentCamp(piece.camp)
    const capturedGeneral = capturedPiece?.name === 'shuai' || capturedPiece?.name === 'jiang'
    const isCheckingOpponent = isCampInCheck(opponentCamp)
    const isCheckmate = isCampCheckmated(opponentCamp)

    if (playSound) {
      $audio.play('drop')
    }

    if (capturedGeneral || isCheckmate) {
      if (emit) {
        options.onFinish?.(piece.camp)
      }

      if (showResult) {
        finishGame(piece.camp, { playSound })
      }
      return true
    }

    currentCamp.value = opponentCamp
    turnHighlightStartedAt = 0
    checkedCamp.value = isCheckingOpponent ? opponentCamp : null

    if (playSound) {
      if (isCheckingOpponent) {
        $audio.play('check')
      } else if (capturedPiece) {
        $audio.play('eat')
      }
    }

    selectPiece(null, { playDrop: false })
    return true
  }

  // 移动当前选中棋子。移动前先判断目标点是不是合法走法。
  const moveSelectedPiece = (gridX: number, gridY: number) => {
    const selectedPiece = findSelectedPiece()

    if (!selectedPiece) return
    if (winnerCamp.value || !isBoardActive()) return
    if (!isControlledByPlayer(selectedPiece.camp) || selectedPiece.camp !== currentCamp.value) return

    const nextMovablePoints = getLegalMoves(selectedPiece)

    if (!hasPoint(nextMovablePoints, gridX, gridY)) {
      return
    }

    applyPieceMove(selectedPiece, gridX, gridY, { emit: true })
  }

  const applyRemoteMove = (move: ChessMovePayload, moveOptions: ApplyRemoteMoveOptions = {}) => {
    const { force = false, playSound = true } = moveOptions
    const movingPiece = pieces.value.find((piece) => piece.id === move.pieceId)

    if (!movingPiece) return false
    if (!force) {
      if (winnerCamp.value || !isBoardActive()) return false
      if (movingPiece.camp !== move.camp || movingPiece.camp !== currentCamp.value) return false
      if (movingPiece.gridX !== move.fromGridX || movingPiece.gridY !== move.fromGridY) return false

      const nextMovablePoints = getLegalMoves(movingPiece)

      if (!hasPoint(nextMovablePoints, move.toGridX, move.toGridY)) return false
    }

    cancelAnimationFrame(animationFrame)
    selectedPieceId.value = null
    movablePoints.value = []
    selectedProgress = 0

    const applied = applyPieceMove(movingPiece, move.toGridX, move.toGridY, {
      emit: false,
      playSound,
      showResult: !force
    })

    if (force) {
      renderBoard()
    }

    return applied
  }

  const applyMoveHistory = (moves: ChessMovePayload[], historyOptions: ApplyMoveHistoryOptions = {}) => {
    const { playLastMoveSound = false } = historyOptions
    resetBoard()

    moves.forEach((move, index) => {
      applyRemoteMove(move, {
        force: true,
        playSound: playLastMoveSound && index === moves.length - 1
      })
    })

    renderBoard()
  }

  // 点击棋盘：有选中棋子时移动；没有选中棋子时尝试选中当前格子的棋子。
  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (winnerCamp.value || !isBoardActive()) return

    $audio.unlock()
    event.preventDefault()

    const canvasInfo = useCanvasFn(canvasRef)
    if (!canvasInfo) return

    const { canvas } = canvasInfo
    const position = getCoordinates(canvas, event)
    const clickedPiece = findPieceAt(position.gridX, position.gridY)

    if (selectedPieceId.value) {
      const selectedPiece = findSelectedPiece()

      if (!selectedPiece) return

      if (selectedPiece.gridX === position.gridX && selectedPiece.gridY === position.gridY) {
        selectPiece(null)
        return
      }

      if (clickedPiece && clickedPiece.camp === selectedPiece.camp) {
        selectPiece(clickedPiece.id)
        return
      }

      moveSelectedPiece(position.gridX, position.gridY)
      return
    }

    if (!clickedPiece) {
      selectPiece(null)
      return
    }

    if (!isControlledByPlayer(clickedPiece.camp)) {
      showChessWarning('不能操作对方棋子')
      selectPiece(null)
      return
    }

    if (clickedPiece.camp !== currentCamp.value) {
      showChessWarning('还没轮到你走棋')
      selectPiece(null)
      return
    }

    selectPiece(clickedPiece.id)
  }

  // 初始化 canvas 尺寸并预加载图片，图片都可用后再绘制第一帧。
  const initBoard = async () => {
    const canvasInfo = useCanvasFn(canvasRef)
    if (!canvasInfo) return

    const { canvas } = canvasInfo
    const pieceImages = [...new Set(pieces.value.map((piece) => piece.imgUrl))]

    canvas.width = BOARD_WIDTH
    canvas.height = BOARD_HEIGHT

    try {
      const [img] = await Promise.all([
        loadImage(assetUrl(assetPaths.game.board)),
        ...pieceImages.map((imgUrl) => loadImage(imgUrl))
      ])

      boardImg = img
      renderBoard()
      animateTurnHighlight()
      isBoardReady.value = true
    } catch (error) {
      console.error('棋盘资源加载失败', error)
    }
  }

  onMounted(initBoard)

  onBeforeUnmount(() => {
    cancelAnimationFrame(animationFrame)
    cancelAnimationFrame(turnHighlightFrame)
  })

  return {
    handlePointerDown,
    movablePoints,
    currentCamp,
    checkedCamp,
    winnerCamp,
    isBoardReady,
    applyRemoteMove,
    applyMoveHistory,
    finishGame,
    resetBoard
  }
}
