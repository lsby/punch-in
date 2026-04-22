import {
  JSON参数解析插件,
  常用接口返回器,
  接口,
  接口逻辑,
  计算接口逻辑JSON参数,
  计算接口逻辑正确结果,
  计算接口逻辑错误结果,
} from '@lsby/net-core'
import { Right } from '@lsby/ts-fp-data'
import { z } from 'zod'
import { 生成视频峰值 } from '../../../tools/video-peaks'

let 接口路径 = '/api/project/get-video-peaks' as const
let 接口方法 = 'post' as const

let 接口逻辑实现 = 接口逻辑.空逻辑().绑定(
  接口逻辑.构造(
    [new JSON参数解析插件(z.object({ videoPath: z.string(), samplesPerSecond: z.number().optional() }), {})],
    async (参数) => {
      let 峰值 = await 生成视频峰值(参数.json.videoPath, 参数.json.samplesPerSecond ?? 100)
      return new Right({ peaks: 峰值 })
    },
  ),
)

type _接口逻辑JSON参数 = 计算接口逻辑JSON参数<typeof 接口逻辑实现>
type _接口逻辑错误返回 = 计算接口逻辑错误结果<typeof 接口逻辑实现>
type _接口逻辑正确返回 = 计算接口逻辑正确结果<typeof 接口逻辑实现>

let 接口错误类型描述 = z.never()
let 接口正确类型描述 = z.object({ peaks: z.array(z.number()) })

export default new 接口(接口路径, 接口方法, 接口逻辑实现, new 常用接口返回器(接口错误类型描述, 接口正确类型描述))

export let 获取视频峰值接口 = 接口逻辑实现.获得最后接口()
