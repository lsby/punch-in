# 补录录

> 说错的那几秒，录对就好。

补录录是一款本机优先的屏幕录制与补录工具。它把录屏放到一条可以继续编辑的时间轴上：停到需要修改的位置，重新录制这一小段，再用规则清理停顿或无效内容，最后导出原画 MP4。

在线体验：

- [阿里云 OSS](https://hbybyyang.cn/punch-in/)
- [GitHub Pages](https://lsby.github.io/punch-in/)

## 主要能力

- 原位补录：在时间轴的任意位置续录，并用新内容替换后续的旧片段。
- 屏幕与声音录制：支持屏幕、系统音频和麦克风输入，并提供独立混音控制。
- 波形时间轴：录制时实时生成音频波形，便于定位停顿和杂音。
- 规则化剪辑：按时间范围或声音条件排除片段，预览时即时应用。
- 原画导出：尽量直接封装已录制的音视频数据，导出 MP4 时避免不必要的二次编码。
- 本机优先：线上版本使用纯前端架构，接口和 SQLite 都在浏览器 Worker 中运行，素材不会上传到业务服务器。

## 使用要求

建议使用最新版桌面端 Chromium 浏览器，例如 Chrome 或 Edge。屏幕捕获和部分媒体能力要求页面运行在 HTTPS 或 `localhost` 安全上下文中。

线上版的数据保存在当前站点 Origin 对应的 IndexedDB 中。更换协议、域名、端口或清理浏览器站点数据后，会进入一份新的本地数据库。

## 本地开发

安装依赖：

```bash
pnpm install
```

运行与线上部署一致的“纯前端 + 本地免登录”模式：

```bash
pnpm run run:pure-frontend:dev
```

如需调试真实 Web 服务端与账号登录流程：

```bash
pnpm run db:push:dev:web
pnpm run run:service:dev
pnpm run run:web:dev
```

也可以在 VS Code 中通过“运行任务”启动对应的开发套件。

## 构建纯前端版本

```bash
pnpm run public:web:pure-frontend
```

产物会整理到 `release/pure-frontend`。部署时需要保留所有文件的相对路径，并使用 HTTPS 静态托管。

纯前端生产配置位于 `.env/.env.production.pure-frontend`，其中：

```dotenv
BUILD_TARGET = 'pure-frontend'
LOCAL_MODE = true
```

本地免登录仍通过 `/api/project/local-login` 接口完成用户初始化和令牌签发，没有在页面中跳过认证，也不依赖路由特判。

## 同步到阿里云 OSS

1. 复制 `scripts/public/release-oss-aliyun-config.example.json` 为 `scripts/public/release-oss-aliyun-config.json`。
2. 填写 OSS 的 `region`、AccessKey、Bucket 和非空的云端目标目录。
3. 执行同步：

```bash
pnpm run public:oss:aliyun
```

同步脚本会自动使用纯前端生产环境构建、按 MD5 比较本地和云端文件、并发上传变更，并在确认后删除目标目录中的多余文件。HTML 和 Service Worker 使用 `no-cache`，带内容哈希的静态资源使用长期缓存。

只验证指定 OSS 子目录的构建结果，不连接 OSS：

```bash
pnpm run public:oss:aliyun -- --build-only=punch-in/
```

发布流程会在代码和标签推送成功后自动执行：

```bash
pnpm run release
```

OSS 密钥配置已被 `.gitignore` 排除。建议使用只允许访问目标 Bucket 的 RAM 子账号，不要使用主账号 AccessKey。

## 项目结构

```text
src/web/components/project/video-editor/  录制、预览、时间轴、混音与导出
src/web/components/project/landing/       上线落地页与交互动画
src/web/pure-frontend-api-worker.ts        浏览器内接口 Worker
src/web/local-sqlite-worker.ts             浏览器内 SQLite Worker
scripts/public/release-oss-aliyun.ts       阿里云 OSS 增量同步
prisma/schema.prisma                       数据库结构
```

## 隐私说明

纯前端版本不会把录屏素材上传到补录录的业务服务器。浏览器扩展、操作系统、录制目标页面或用户主动配置的其他服务仍可能有各自的数据处理行为，请按实际使用环境评估。

## 开源协议

本项目采用 [MIT License](./LICENSE)。
