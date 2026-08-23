# 补录录

> 说错的那几秒，补录就好。

录教程、产品演示或课程，总得一边操作一边讲。讲错了、点错了都很正常，但普通录屏只能硬着头皮继续或者从头再来；录完再用专业软件剪，明明只是改一句口误，却变成了一次完整的视频后期。

补录录是一款本机优先的屏幕录制与回退续录工具。出错后停下来，把播放头退回出错的位置，前面录好的内容原封不动，从这里接着重新录就行。

回退续录会保留播放头之前的内容，丢掉播放头之后的旧内容，由新的录制接上时间轴。它不做“只替换中间几秒、再接回原来后半段”的局部拼接——因为前后画面、操作状态和语句通常很难自然衔接；从出错处重新录下去，操作更直接，结果也更连贯。

在线体验：

- [阿里云 OSS](https://hbybyyang.cn/punch-in/)
- [GitHub Pages](https://lsby.github.io/punch-in/)

## 为什么需要它

屏幕录制是线性的，但人的讲解和操作很难一次完全正确。录到中途出了错，常见的处理办法有这几种，但都不太理想：

- **从头重录**：最简单粗暴的办法，但前面十几分钟录好的内容全部作废。
- **录完再剪**：先把整段录完，之后用剪辑软件找切点、调衔接、再导出——一次口误变成一次完整后期。
- **带着错误继续**：当时省事不停下来，但错误一直留在成片里，迟早还是得返工处理。
- **上传到线上服务**：要等大文件传完不说，录的要是内部系统或未发布的产品，素材离开本机也不放心。

补录录把修正这件事留在录制过程里：前面正确的部分原封不动，从出错的地方接着重新录。

## 从录制到交付

1. 选择要录制的屏幕或窗口，并按需要采集系统音频和麦克风。
2. 正常录制；时间轴同步显示音频波形，帮助定位讲解中的停顿和声音变化。
3. 发现口误或操作失误后停止录制，把播放头移回出错开始的位置。
4. 再次开始录制。播放头之前的内容保留，之后的旧内容删除，新内容从这里继续写入时间轴。
5. 添加剪辑规则，根据音量和持续时间匹配静音、长停顿或其他无效区间，并在预览中即时查看结果。
6. 确认后导出 MP4；剪辑规则会在导出时应用，无需先生成中间文件。

## 推荐的录制方式

回退续录解决"说错了"的问题，自动剪辑解决"说慢了"的问题。两者配合，可以形成一种很轻松的录制节奏：

- **不用一口气说完**——想好一句再说，中间想多久都没关系。
- **停顿自动消失**——沉默和长停顿会被剪辑规则识别并去掉，成片听起来依然流畅连贯。
- **说错了就退回去**——不需要从头重来，退回出错的位置接着录就行。

录制时可以放慢节奏、降低心理压力，不用追求一遍过。最终得到的视频，既没有多余的停顿，也没有口误。

## 主要能力

- 回退续录：把播放头拖回出错的位置，前面的录制原样保留，后面的错误丢掉，从这里重新录。
- 屏幕与声音一起录：支持屏幕、系统音频和麦克风，分开控制、实时混音。
- 波形时间轴：录制时实时生成音频波形，一眼就能看到停顿和杂音在哪。
- 规则化剪辑：设定音量和时长条件自动匹配无效片段，预览即时生效，一套规则反复用。
- 原画导出：尽量直接封装已录好的音视频数据，跳过不必要的重新编码，又快画质又好。
- 本机优先：线上版本采用纯前端架构，接口和 SQLite 都在浏览器 Worker 中运行，素材不会离开本机。

## 适合哪些内容

- 软件操作教程和功能讲解
- 产品演示、方案演示和内部汇报
- 在线课程、培训材料和知识分享
- 需要同步录制系统声音与讲解声音的工作流程

补录录只做录制过程中的快速返工，不搞复杂特效、多轨合成或局部拼接。

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

## GitHub Pages

构建完成后使用 `JamesIves/github-pages-deploy-action` 将纯前端产物同步到 `gh-pages` 分支。首次部署成功后，在 GitHub 仓库的 `Settings → Pages → Build and deployment` 中选择 `Deploy from a branch`，分支选择 `gh-pages`、目录选择 `/ (root)`。之后推送到 `master`、推送 `v*` 标签或手动运行工作流，都会更新该分支。

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
