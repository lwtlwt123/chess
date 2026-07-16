# 棋局接口文档

## 通用说明

接口地址均以当前站点为基础地址，例如：

```text
http://127.0.0.1:3000/api/chess/history
```

所有接口都需要登录令牌：

```http
Authorization: Bearer <token>
```

业务结果通过响应体中的 `code` 表示：

```json
{
  "code": 200,
  "message": "查询成功",
  "data": {}
}
```

常见错误码：

| code | 含义 |
| --- | --- |
| 400 | 请求参数不正确 |
| 401 | 登录失效或未携带令牌 |
| 403 | 无权操作或查看该对局 |
| 404 | 对局不存在 |
| 409 | 当前状态不允许操作或记录重复 |
| 500 | 服务器或数据库异常 |

## 1. 获取个人战绩

```http
GET /api/chess/history?page=1&pageSize=20
```

查询参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `page` | number | 否 | `1` | 页码，从 1 开始 |
| `pageSize` | number | 否 | `20` | 每页数量，最大 50 |

用户 ID 从登录令牌中获取，前端不需要传 `userId`。

成功响应：

```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "page": 1,
    "pageSize": 20,
    "games": [
      {
        "gameId": 101,
        "roomId": "658983",
        "roundNo": 1,
        "redUserId": 3,
        "blackUserId": 8,
        "winnerUserId": 3,
        "winnerCamp": "red",
        "finishReason": "normal",
        "startedAt": "2026-07-13T08:20:00.000Z",
        "finishedAt": "2026-07-13T08:35:00.000Z",
        "createdAt": "2026-07-13T08:19:30.000Z"
      }
    ]
  }
}
```

`finishReason` 可取：

| 值 | 含义 |
| --- | --- |
| `normal` | 正常结束 |
| `resign` | 玩家认输或主动退出 |
| `disconnect` | 掉线超时判负 |

前端调用示例：

```ts
const token = getAuthToken()

const result = await $fetch('/api/chess/history', {
  query: { page: 1, pageSize: 20 },
  headers: {
    Authorization: `Bearer ${token}`
  }
})
```

## 2. 获取单局复盘

```http
GET /api/chess/review?gameId=101
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `gameId` | number | 是 | `chess_game.id`，不是房间号 |

只有该局红方或黑方可以查看。

成功响应：

```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "game": {
      "gameId": 101,
      "roomId": "658983",
      "roundNo": 1,
      "status": "finished",
      "winnerUserId": 3,
      "winnerCamp": "red",
      "finishReason": "normal",
      "startedAt": "2026-07-13T08:20:00.000Z",
      "finishedAt": "2026-07-13T08:35:00.000Z",
      "redPlayer": {
        "userId": 3,
        "username": "player_a",
        "nickname": "红方昵称",
        "headImg": "/uploads/avatar-a.png"
      },
      "blackPlayer": {
        "userId": 8,
        "username": "player_b",
        "nickname": "黑方昵称",
        "headImg": "/uploads/avatar-b.png"
      }
    },
    "moves": [
      {
        "stepNo": 1,
        "camp": "red",
        "pieceId": "red-pao-1",
        "fromGridX": 1,
        "fromGridY": 7,
        "toGridX": 4,
        "toGridY": 7,
        "capturedPieceId": null,
        "createdAt": "2026-07-13T08:20:08.000Z"
      }
    ]
  }
}
```

复盘页调用示例：

```ts
const route = useRoute()
const token = getAuthToken()

const result = await $fetch('/api/chess/review', {
  query: { gameId: route.query.gameId },
  headers: {
    Authorization: `Bearer ${token}`
  }
})
```

返回的 `moves` 字段已经与 `ChessMovePayload` 使用相同的坐标命名，可以交给棋盘的 `applyMoveHistory()`。

## WebSocket 自动持久化

页面不需要额外调用接口保存正常对局。服务端自动处理：

| WebSocket 事件 | 数据库操作 |
| --- | --- |
| 双方进入房间 | 创建 `chess_game`，产生 `gameId` |
| 双方确认开局 | 更新状态为 `playing`，记录 `started_at` |
| `movePiece` | 插入 `chess_move`，更新 `current_camp` |
| `finishRoom` | 保存正常胜负与 `finished_at` |
| `resignRoom` | 保存认输结果 |
| 掉线超时 | 保存掉线判负结果 |
| 双方同意重赛 | `round_no + 1`，创建新的 `gameId` |

房间相关消息的 `data` 中包含：

```json
{
  "gameId": 101,
  "roundNo": 1
}
```

胜利或失败页面点击“查看复盘”时，父页面会跳转到：

```text
/gameReview?gameId=101
```

复盘页面读取这个 `gameId` 后调用 `/api/chess/review` 即可。
