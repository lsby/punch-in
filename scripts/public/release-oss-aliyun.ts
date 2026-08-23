import OSS from 'ali-oss'
import { execFileSync } from 'child_process'
import crypto from 'crypto'
import { config as 加载环境文件 } from 'dotenv'
import fs from 'fs'
import path from 'path'
import readline from 'readline/promises'
import { z } from 'zod'

let 项目根目录 = path.resolve(import.meta.dirname, '../../')
let 本地同步目录 = path.join(项目根目录, 'dist/src/web')
let 配置文件路径 = path.join(import.meta.dirname, 'release-oss-aliyun-config.json')
let 目标目录校验器 = z
  .string()
  .min(1)
  .regex(/^\/?[\w/-]+\/?$/, '云端目标目录只能包含字母、数字、下划线、短横线和斜杠')
let 配置校验器 = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  accessKeySecret: z.string().min(1),
  bucket: z.string().min(1),
  云端目标目录: 目标目录校验器,
})
type 配置类型 = z.infer<typeof 配置校验器>
type 上传任务 = { 本地绝对路径: string; 云端键: string }

function 读取配置(): 配置类型 {
  if (fs.existsSync(配置文件路径) === false) {
    throw new Error(
      `缺少 OSS 配置文件。请复制 release-oss-aliyun-config.example.json 为 ${path.basename(配置文件路径)} 后填写。`,
    )
  }
  return 配置校验器.parse(JSON.parse(fs.readFileSync(配置文件路径, 'utf-8')))
}

function 标准化目标目录(目录: string): string {
  let 结果 = 目录.replace(/^\/+|\/+$/g, '')
  if (结果 === '') throw new Error('为避免误删整个 Bucket，云端目标目录不能是根目录')
  return `${结果}/`
}

function 执行pnpm(参数: string[]): void {
  let 是否Windows = process.platform === 'win32'
  let 命令 = 是否Windows === true ? 'cmd.exe' : 'pnpm'
  let 完整参数 = 是否Windows === true ? ['/d', '/s', '/c', 'pnpm', ...参数] : 参数
  execFileSync(命令, 完整参数, { cwd: 项目根目录, env: process.env, stdio: 'inherit' })
}

function 构建纯前端应用(云端目标目录: string): void {
  let 公共路径 = `/${云端目标目录}`
  let 环境文件路径 = path.join(项目根目录, '.env/.env.production.pure-frontend')
  let 加载结果 = 加载环境文件({ path: 环境文件路径, override: true })
  if (加载结果.error !== undefined) throw 加载结果.error
  console.log(`正在构建纯前端本地模式，公共路径为 ${公共路径}`)
  执行pnpm(['run', '_clean:web'])
  执行pnpm([
    'exec',
    'parcel',
    'build',
    '--no-autoinstall',
    '--no-cache',
    '--no-source-maps',
    '--no-scope-hoist',
    '--dist-dir',
    'dist/src/web',
    '--public-url',
    公共路径,
    'src/web/page/**/*.html',
  ])
  if (fs.existsSync(本地同步目录) === false) throw new Error(`构建产物不存在: ${本地同步目录}`)
}

function 获取MIME类型(文件路径: string): string {
  let 映射: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp4': 'video/mp4',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }
  return 映射[path.extname(文件路径).toLowerCase()] ?? 'application/octet-stream'
}

function 递归获取文件(目录: string): string[] {
  let 结果: string[] = []
  for (let 项 of fs.readdirSync(目录, { withFileTypes: true })) {
    let 绝对路径 = path.join(目录, 项.name)
    if (项.isDirectory() === true) 结果.push(...递归获取文件(绝对路径))
    else if (项.isFile() === true) 结果.push(绝对路径)
  }
  return 结果
}

function 计算MD5(文件路径: string): string {
  return crypto.createHash('md5').update(fs.readFileSync(文件路径)).digest('hex').toLowerCase()
}

async function 获取云端对象(客户端: OSS, 前缀: string): Promise<OSS.ObjectMeta[]> {
  let 对象列表: OSS.ObjectMeta[] = []
  let 下一页标记: string | undefined = undefined
  let 继续获取 = true
  while (继续获取 === true) {
    let 参数: OSS.ListV2ObjectsQuery = { prefix: 前缀, 'max-keys': 1000 }
    if (下一页标记 !== undefined) 参数['continuation-token'] = 下一页标记
    let 结果 = await 客户端.listV2(参数, {})
    对象列表.push(...结果.objects)
    继续获取 = 结果.isTruncated === true
    下一页标记 = 结果.nextContinuationToken
  }
  return 对象列表
}

function 计算变更(
  本地文件: string[],
  云端对象: OSS.ObjectMeta[],
  云端目标目录: string,
): { 上传: 上传任务[]; 删除: string[] } {
  let 云端映射 = new Map<string, OSS.ObjectMeta>()
  for (let 对象 of 云端对象) 云端映射.set(对象.name, 对象)
  let 本次文件键 = new Set<string>()
  let 上传: 上传任务[] = []
  for (let 本地绝对路径 of 本地文件) {
    let 相对路径 = path.relative(本地同步目录, 本地绝对路径).replace(/\\/g, '/')
    let 云端键 = `${云端目标目录}${相对路径}`
    本次文件键.add(云端键)
    let 已有对象 = 云端映射.get(云端键)
    if (已有对象 === undefined || 已有对象.etag.replaceAll('"', '').toLowerCase() !== 计算MD5(本地绝对路径)) {
      上传.push({ 本地绝对路径, 云端键 })
    }
  }
  let 删除 = 云端对象
    .filter((对象) => 对象.name.endsWith('/') === false && 本次文件键.has(对象.name) === false)
    .map((对象) => 对象.name)
  return { 上传, 删除 }
}

async function 请求确认(上传数量: number, 删除数量: number): Promise<boolean> {
  if (process.argv.includes('--yes') === true || process.argv.includes('-y') === true) return true
  let 终端 = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    let 回答 = await 终端.question(`将上传或更新 ${上传数量} 个文件，并删除 ${删除数量} 个云端文件。继续？(Y/n): `)
    let 标准回答 = 回答.trim().toLowerCase()
    return 标准回答 === '' || 标准回答 === 'y' || 标准回答 === 'yes'
  } finally {
    终端.close()
  }
}

async function 执行上传(客户端: OSS, 任务列表: 上传任务[]): Promise<void> {
  let 当前索引 = 0
  let 运行任务 = async (): Promise<void> => {
    while (当前索引 < 任务列表.length) {
      let 任务 = 任务列表[当前索引]
      当前索引 = 当前索引 + 1
      if (任务 === undefined) continue
      let 扩展名 = path.extname(任务.本地绝对路径).toLowerCase()
      let 是否需要每次验证 = 扩展名 === '.html' || path.basename(任务.本地绝对路径) === 'sw.js'
      console.log(`[上传] ${任务.云端键}`)
      await 客户端.put(任务.云端键, 任务.本地绝对路径, {
        headers: {
          'cache-control': 是否需要每次验证 === true ? 'no-cache' : 'public, max-age=31536000, immutable',
          'content-type': 获取MIME类型(任务.本地绝对路径),
        },
      })
    }
  }
  let 并发任务: Promise<void>[] = []
  for (let 索引 = 0; 索引 < Math.min(5, 任务列表.length); 索引 = 索引 + 1) 并发任务.push(运行任务())
  await Promise.all(并发任务)
}

async function 执行删除(客户端: OSS, 删除列表: string[]): Promise<void> {
  for (let 起点 = 0; 起点 < 删除列表.length; 起点 = 起点 + 1000) {
    let 当前批次 = 删除列表.slice(起点, 起点 + 1000)
    console.log(`[删除] ${当前批次.length} 个云端文件`)
    await 客户端.deleteMulti(当前批次, { quiet: true })
  }
}

async function 执行同步(): Promise<void> {
  let 仅构建参数 = process.argv.find((参数) => 参数.startsWith('--build-only='))
  if (仅构建参数 !== undefined) {
    let 云端目标目录 = 标准化目标目录(目标目录校验器.parse(仅构建参数.slice('--build-only='.length)))
    构建纯前端应用(云端目标目录)
    console.log('纯前端 OSS 子目录构建完成。')
    return
  }
  let 配置 = 读取配置()
  let 云端目标目录 = 标准化目标目录(配置.云端目标目录)
  构建纯前端应用(云端目标目录)
  let 客户端 = new OSS({
    region: 配置.region,
    accessKeyId: 配置.accessKeyId,
    accessKeySecret: 配置.accessKeySecret,
    bucket: 配置.bucket,
  })
  let 本地文件 = 递归获取文件(本地同步目录)
  let 云端对象 = await 获取云端对象(客户端, 云端目标目录)
  let 变更 = 计算变更(本地文件, 云端对象, 云端目标目录)
  console.log(`本地 ${本地文件.length} 个文件，待上传 ${变更.上传.length} 个，待删除 ${变更.删除.length} 个。`)
  if (变更.上传.length === 0 && 变更.删除.length === 0) {
    console.log('云端已经是最新状态。')
    return
  }
  for (let 云端键 of 变更.删除) console.log(`[待删除] ${云端键}`)
  if ((await 请求确认(变更.上传.length, 变更.删除.length)) === false) {
    console.log('已取消同步。')
    return
  }
  await 执行上传(客户端, 变更.上传)
  await 执行删除(客户端, 变更.删除)
  console.log('阿里云 OSS 同步完成。')
}

void 执行同步().catch((错误: unknown): void => {
  console.error('阿里云 OSS 同步失败:', 错误)
  process.exitCode = 1
})
