# Underworld

Underworld 是一个中文卡牌对战平台，包含组卡、卡牌池、八套 Bot 卡组、标准和困难难度、对局回放及卡牌修订。

本仓库固定使用标准卡池，共 738 条卡牌记录。页面与 API 不提供切换其他卡池的选项。

## 本地启动

需要 Node.js 22.13 或更新的 22.x 版本，以及 npm。

```sh
npm ci
npm run db:local
npm run dev
```

打开终端显示的本地地址。开发环境提供模拟账号，可用于本机验证组卡及多人房间；模拟账号不适合公开部署。

## 本机 Bot 对战

```sh
npm run dev:offline
```

这个入口在浏览器内运行同一套引擎，支持组卡、挑战 Bot、存档和回放，不要求 ChatGPT 登录。数据保存在当前浏览器的 IndexedDB 中。默认端口为 5174；端口占用时可加 `-- --port 5184`。

## 验证与构建

```sh
npm test
npm run build
npm run build:offline
```

在线入口构建结果位于 `dist/`，本机 Bot 入口位于 `offline/dist/`。本机入口应通过 HTTP 静态服务器访问，以便前端路由及资源路径正常工作。

## 在线部署

在线入口基于 Vinext、React、Cloudflare Workers 和 D1。数据库结构位于 `drizzle/`，卡牌与规则定义位于 `data/`，对局引擎位于 `engine/`。

本仓库不含已部署站点的配置或账户数据。上线前需要自行建立 D1 数据库、执行迁移、配置 Workers 绑定，并接入可信的用户认证。当前认证适配器位于 `app/chatgpt-auth.ts`，使用原托管环境提供的请求头。独立服务器需要更换这个适配器，并在服务器端验证身份；不能直接信任公网客户端提交的身份请求头。

`npm run start` 用于在本机运行构建后的 Worker。原站点的域名、数据库、登录配置和对局记录不随本仓库提供。

## 内容与目录

- `app/`：大厅、组卡、对局、回放、修订页及 API。
- `engine/`：规则结算、堆叠、触发轮、Bot 决策和模拟。
- `data/Card.xml`：标准卡池资料。
- `data/public-revisions.json`：公开卡牌修订。
- `offline/`：浏览器内 Bot 对战服务与存档。
- `public/`：背景及静态资源。
- `tests/`：卡池与对局服务回归检查。

HWD1 卡组代码及 Underworld 对局 JSON 可在相应页面导入。旧版 Hidden World 前缀属于兼容性格式，导出的新对局文件使用 under-world 前缀。

## 授权

本仓库暂未附带项目整体的开源许可证。公开可见不等于授予重新分发或商业使用权；游戏卡牌、背景及其他素材的权利归各自权利人。第三方组件遵循其原有许可证，随附许可证保留在对应目录。
