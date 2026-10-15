import { defineTool } from '../define'

/**
 * 解码 / 解密工作台 —— 全站最重的工具
 *
 * 懒加载成独立 chunk：这个页面要带 Morse 表、字符编码探测和整套 Web Crypto 逻辑，
 * 绝不能混进公共 chunk 拖慢其余工具的首屏。
 */
export const codecTool = defineTool({
  id: 'codec',
  name: '解码 / 解密',
  tagline: '自动认出数据类型，能解的解清楚，解不开的说清楚为什么',
  icon: '🔓',
  category: 'security',
  keywords: [
    'decode',
    'decrypt',
    'encode',
    'base64',
    'jwt',
    'hex',
    'url encode',
    'morse',
    'unicode',
    'aes',
    'rsa',
    'hash',
    'md5',
    'sha256',
    '识别',
    '解密',
    '编码',
    '密文',
    '令牌',
  ],
  status: 'beta',
  order: 60,
  component: () => import('./CodecTool.vue'),
})

export default codecTool
