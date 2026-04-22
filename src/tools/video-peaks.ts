import { spawn } from 'child_process'

/**
 * 生成视频的音频峰值数据 (用于渲染波形)
 * @param 视频路径 视频文件的绝对路径
 * @param 每秒采样数 每秒钟生成的点数，默认 100 (对于长视频，这个值可以根据时长动态调整)
 */
export async function 生成视频峰值(视频路径: string, 每秒采样数: number = 100): Promise<number[]> {
  return new Promise((resolve, reject) => {
    // 采样率设为 8000Hz 足够用于波形显示
    let 采样率 = 8000
    let 每个点的样本数 = Math.floor(采样率 / 每秒采样数)

    // -i: 输入
    // -f s16le: 16bit 小端序 PCM
    // -ac 1: 单声道
    // -ar: 采样率
    // -: 输出到 stdout
    let ff = spawn('ffmpeg', ['-i', 视频路径, '-f', 's16le', '-ac', '1', '-ar', 采样率.toString(), '-'])

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
