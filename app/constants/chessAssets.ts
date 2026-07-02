const GRID_LEFT = 130
const GRID_TOP = 122
const CELL_SIZE = 82


// 获取对应坐标
export const getCoordinates = (canvas: HTMLCanvasElement, event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (canvas.width / rect.width)
    const y = (event.clientY - rect.top) * (canvas.height / rect.height)

    const gridX = Math.min(8, Math.max(0, Math.round((x - GRID_LEFT) / CELL_SIZE)))
    const gridY = Math.min(9, Math.max(0, Math.round((y - GRID_TOP) / CELL_SIZE)))

    return {
        x,
        y,
        gridX,
        gridY
    }
}

// 获取对应像素
export const getPixels = (gridX: number, gridY: number) => {
    // console.log(GRID_LEFT + gridX * CELL_SIZE,GRID_TOP + gridY * CELL_SIZE);

    return {
        x: GRID_LEFT + gridX * CELL_SIZE,
        y: GRID_TOP + gridY * CELL_SIZE
    }

}

// 绘制棋子方法

export const drawPiece = (
    ctx: CanvasRenderingContext2D,
    imgUrl: string,
    gridX: number,
    gridY: number) => {
    const img = new Image()
    img.src = imgUrl

    img.onload = () => {
        const { x, y } = getPixels(gridX, gridY)
        const size = 78

        ctx.drawImage(img, x - size / 2, y - size / 2, size, size)

    }
}
