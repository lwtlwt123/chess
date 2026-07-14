export const assetPaths = {
  login: {
    background: '/login-bg.png'
  },
  lobby: {
    background: '/chessPrice/backgrounds/tropical-beach-game-bg.svg',
    fallbackAvatar: '/chessPrice/lobby-ui/empty_head_img.svg',
    edit: '/chessPrice/lobby-ui/edit.svg',
    title: '/chessPrice/lobby-ui/title-chuhe-hanjie.svg?v=shadow-light',
    pieceRed: '/chessPrice/lobby-ui/piece-red.svg',
    pieceBlack: '/chessPrice/lobby-ui/piece-black.svg',
    voice: '/chessPrice/lobby-ui/voice.svg',
    noVoice: '/chessPrice/lobby-ui/noVoice.svg',
    quit: '/chessPrice/lobby-ui/quit.svg',
    logoutButton: '/chessPrice/lobby-ui/logout-button.svg',
    userBanner: '/chessPrice/lobby-ui/user-banner.svg',
    panel: '/chessPrice/lobby-ui/lobby-panel.svg',
    startButton: '/chessPrice/lobby-ui/start-button.svg',
    menuButton: '/chessPrice/lobby-ui/menu-button.svg'
  },
  record: {
    background: '/chessPrice/backgrounds/tropical-beach-game-bg.svg'
  },
  game: {
    background: '/chessPrice/backgrounds/tropical-beach-game-bg.svg',
    boardWood: '/chessPrice/xiangqi-board-wood.svg',
    board: '/chessPrice/xiangqi-board.svg',
    piecesWood: '/chessPrice/pieces-wood/',
    victory: '/chessPrice/victory.svg',
    defeat: '/chessPrice/defeat.svg'
  },
  sounds: {
    drop: '/chessPrice/sounds/pick_piece_fast.wav',
    eat: '/chessPrice/sounds/eat_piece_fast.wav',
    check: '/chessPrice/sounds/check_general.wav',
    victory: '/chessPrice/sounds/victory_piece.mp3',
    bgm: '/chessPrice/sounds/chess_bgm.mp3',
    click: '/chessPrice/sounds/click.mp3',
    chessBgm: '/chessPrice/sounds/chessBgm.mp3'
  },
  controls:{
    left:'/chessPrice/bg-left.svg',
    right:'/chessPrice/bg-right.svg',
    play:'/chessPrice/pause.svg',
    pause:'/chessPrice/play.svg',
  },
  right:'/right.svg'
} as const
