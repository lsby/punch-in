import { execFile, spawn } from 'child_process'
import { promisify } from 'util'

let 执行文件异步 = promisify(execFile)

/**
 * 获取视频的真实容器时长（秒）
 */
async function 获取视频真实时长(视频路径: string): Promise<number> {
  try {
    let { stdout } = await 执行文件异步('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      视频路径,
    ])
    let 时长 = parseFloat(stdout.trim())
    return isNaN(时长) ? 0 : 时长
  } catch (e) {
    console.error('ffprobe 获取时长失败:', e)
    return 0
  }
}

/**
 * 生成视频的音频峰值数据 (用于渲染波形)
 * @param 视频路径 视频文件的绝对路径
 * @param 每秒采样数 每秒钟生成的点数，默认 100 (对于长视频，这个值可以根据时长动态调整)
 */
export async function 生成视频峰值(视频路径: string, 每秒采样数: number = 100): Promise<number[]> {
  // 先获取真实时长
  let 真实时长 = await 获取视频真实时长(视频路径)
  let 目标点数 = 真实时长 > 0 ? Math.round(真实时长 * 每秒采样数) : 0

  return new Promise((resolve, reject) => {
    // 采样率设为 8000Hz 足够用于波形显示
    let 采样率 = 8000
    let 每个点的样本数 = Math.floor(采样率 / 每秒采样数)

    // -i: 输入
    // -f s16le: 16bit 小端序 PCM
    // -ac 1: 单声道
    // -ar: 采样率
    // -af aresample=async=1:first_pts=0 确保音画同步并给开头可能存在的延迟补静音
    // apad 给末尾补静音以对齐视频总长度
    // -t 限制输出长度为视频真实时长
    let ffmpeg参数 = ['-i', 视频路径, '-f', 's16le', '-ac', '1', '-ar', 采样率.toString()]
    if (真实时长 > 0) {
      ffmpeg参数.push('-af', 'aresample=async=1:first_pts=0,apad')
      ffmpeg参数.push('-t', 真实时长.toString())
    } else {
      ffmpeg参数.push('-af', 'aresample=async=1:first_pts=0')
    }
    ffmpeg参数.push('-')

    let ff = spawn('ffmpeg', ffmpeg参数)

    let 峰值: number[] = []
    let 剩余数据 = Buffer.alloc(0)

    ff.stdout.on('data', (chunk: Buffer) => {
      let 合并数据 = Buffer.concat([剩余数据, chunk])
      let 偏移 = 0

      // 每个样本 2 字节 (s16le)
      while (偏移 + 每个点的样本数 * 2 <= 合并数据.length) {
        let 最大值 = 0
        for (let i = 0; i < 每个点的样本数; i++) {
          let 样本 = 合并数据.readInt16LE(偏移 + i * 2)
          let 绝对值 = Math.abs(样本)
          if (绝对值 > 最大值) 最大值 = 绝对值
        }

        // 归一化到 0-1 之间
        峰值.push(最大值 / 32768)
        偏移 += 每个点的样本数 * 2

        // 如果已经达到了目标点数，我们可以提前停止
        if (目标点数 > 0 && 峰值.length >= 目标点数) {
          break
        }
      }

      剩余数据 = 合并数据.subarray(偏移)
    })

    // 错误处理
    let 错误信息 = ''
    ff.stderr.on('data', (data) => {
      错误信息 += data.toString()
    })

    ff.on('close', (code) => {
      if (code === 0) {
        // 如果我们没拿到真实时长，或者拿到了但峰值依然不够，后端可以直接补齐 0
        if (目标点数 > 0 && 峰值.length < 目标点数) {
          let 补齐 = new Array(目标点数 - 峰值.length).fill(0)
          峰值 = 峰值.concat(补齐)
        } else if (目标点数 > 0 && 峰值.length > 目标点数) {
          峰值 = 峰值.slice(0, 目标点数)
        }
        resolve(峰值)
      } else {
        reject(new Error(`ffmpeg 进程退出，代码 ${code}: ${错误信息}`))
      }
    })

    ff.on('error', (err) => {
      reject(err)
    })
  })
}
