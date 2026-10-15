import { defineTool } from '../define'

/**
 * Base64 编解码 —— 工具定义（全站唯一出口，registry.ts 只认这一个）
 */
export const base64Tool = defineTool({
  id: 'base64',
  name: 'Base64',
  tagline: 'UTF-8 中文友好的 Base64 双向转换，支持 URL-safe 与文件 DataURL',
  icon: '🔐',
  category: 'encode',
  keywords: ['base64', 'b64', '编码', '解码', 'encode', 'decode', 'base64url', 'url-safe', 'dataurl', 'data-url'],
  status: 'wip',
  order: 20,
  component: () => import('./Base64Tool.vue'),
})
