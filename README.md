# 中国象棋

基于 Nuxt 4、Vue 3、MySQL 和 WebSocket 的在线中国象棋项目。

## 本地运行

要求 Node.js 20+ 和 MySQL 8+。

```bash
npm ci
npm run dev
```

`npm run dev` 固定读取 `.env.local`，监听 `127.0.0.1:3000`，使用本地 MySQL。HTTP API 使用相对路径，WebSocket 默认跟随浏览器当前地址，因此本地访问会自动连接本地服务。

## 检查与构建

```bash
npm run typecheck
npm run build
```

`npm run build` 固定读取 `.env.production`。需要使用本地环境构建时运行 `npm run build:local`。

## 服务器部署

服务器地址：`192.140.181.6`。

```bash
npm ci
npm run build
npm run start
```

`npm run start` 固定读取 `.env.production`，监听 `0.0.0.0:3001`。服务器原有项目继续使用 `3000`，两者互不影响。生产环境当前配置为：

```dotenv
NODE_ENV=production
NITRO_HOST=0.0.0.0
NITRO_PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_NAME=chess_game
NUXT_PUBLIC_APP_ORIGIN=http://192.140.181.6:3001
```

`.env.local` 和 `.env.production` 都不会进入 Git。当前可直接通过 `http://192.140.181.6:3001` 访问。以后使用 Nginx 和独立域名时，可将域名反向代理到 `127.0.0.1:3001`，并同时转发 WebSocket 升级请求。

头像上传文件保存在 `.data/avatars`。部署时将该目录挂载到持久化磁盘并纳入备份，否则重新发布后用户头像会丢失。

正式接口说明见 [docs/chess-api.md](docs/chess-api.md)。
