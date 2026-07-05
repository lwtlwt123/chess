export const baseUrl = '/chessPrice/'

export const chessAssets = {
  boardWood: `${baseUrl}xiangqi-board-wood.svg`,
  board: `${baseUrl}xiangqi-board.svg`,
  piecesWood: `${baseUrl}pieces-wood/`,
  gameBackground: `${baseUrl}backgrounds/tropical-beach-game-bg.svg`
} as const

export type Camp = 'red' | 'black'

export type PieceName =
  | 'shuai'
  | 'jiang'
  | 'shi'
  | 'xiang'
  | 'ma'
  | 'ju'
  | 'pao'
  | 'bing'
  | 'zu'

export interface ChessPiece {
  id: string
  camp: Camp
  name: PieceName
  gridX: number
  gridY: number
  imgUrl: string
}

const getPieceImgUrl = (camp: Camp, name: PieceName) => {
  return `${chessAssets.piecesWood}${camp}-${name}.svg`
}

const initialPiecePositions: Omit<ChessPiece, 'imgUrl'>[] = [
  // 黑方
  { id: 'black-ju-1', camp: 'black', name: 'ju', gridX: 0, gridY: 0 },
  { id: 'black-ma-1', camp: 'black', name: 'ma', gridX: 1, gridY: 0 },
  { id: 'black-xiang-1', camp: 'black', name: 'xiang', gridX: 2, gridY: 0 },
  { id: 'black-shi-1', camp: 'black', name: 'shi', gridX: 3, gridY: 0 },
  { id: 'black-jiang', camp: 'black', name: 'jiang', gridX: 4, gridY: 0 },
  { id: 'black-shi-2', camp: 'black', name: 'shi', gridX: 5, gridY: 0 },
  { id: 'black-xiang-2', camp: 'black', name: 'xiang', gridX: 6, gridY: 0 },
  { id: 'black-ma-2', camp: 'black', name: 'ma', gridX: 7, gridY: 0 },
  { id: 'black-ju-2', camp: 'black', name: 'ju', gridX: 8, gridY: 0 },

  { id: 'black-pao-1', camp: 'black', name: 'pao', gridX: 1, gridY: 2 },
  { id: 'black-pao-2', camp: 'black', name: 'pao', gridX: 7, gridY: 2 },

  { id: 'black-zu-1', camp: 'black', name: 'zu', gridX: 0, gridY: 3 },
  { id: 'black-zu-2', camp: 'black', name: 'zu', gridX: 2, gridY: 3 },
  { id: 'black-zu-3', camp: 'black', name: 'zu', gridX: 4, gridY: 3 },
  { id: 'black-zu-4', camp: 'black', name: 'zu', gridX: 6, gridY: 3 },
  { id: 'black-zu-5', camp: 'black', name: 'zu', gridX: 8, gridY: 3 },

  // 红方
  { id: 'red-ju-1', camp: 'red', name: 'ju', gridX: 0, gridY: 9 },
  { id: 'red-ma-1', camp: 'red', name: 'ma', gridX: 1, gridY: 9 },
  { id: 'red-xiang-1', camp: 'red', name: 'xiang', gridX: 2, gridY: 9 },
  { id: 'red-shi-1', camp: 'red', name: 'shi', gridX: 3, gridY: 9 },
  { id: 'red-shuai', camp: 'red', name: 'shuai', gridX: 4, gridY: 9 },
  { id: 'red-shi-2', camp: 'red', name: 'shi', gridX: 5, gridY: 9 },
  { id: 'red-xiang-2', camp: 'red', name: 'xiang', gridX: 6, gridY: 9 },
  { id: 'red-ma-2', camp: 'red', name: 'ma', gridX: 7, gridY: 9 },
  { id: 'red-ju-2', camp: 'red', name: 'ju', gridX: 8, gridY: 9 },

  { id: 'red-pao-1', camp: 'red', name: 'pao', gridX: 1, gridY: 7 },
  { id: 'red-pao-2', camp: 'red', name: 'pao', gridX: 7, gridY: 7 },

  { id: 'red-bing-1', camp: 'red', name: 'bing', gridX: 0, gridY: 6 },
  { id: 'red-bing-2', camp: 'red', name: 'bing', gridX: 2, gridY: 6 },
  { id: 'red-bing-3', camp: 'red', name: 'bing', gridX: 4, gridY: 6 },
  { id: 'red-bing-4', camp: 'red', name: 'bing', gridX: 6, gridY: 6 },
  { id: 'red-bing-5', camp: 'red', name: 'bing', gridX: 8, gridY: 6 }
]

export const initialPieces: ChessPiece[] = initialPiecePositions.map((piece) => ({
  ...piece,
  imgUrl: getPieceImgUrl(piece.camp, piece.name)
}))
