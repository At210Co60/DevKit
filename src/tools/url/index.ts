import { defineTool } from '../define'

/**
 * URL 编解码 —— 工具定义（全站唯一出口，registry.ts 只认这一个）
 */
export const urlTool = defineTool({
  id: 'url',
  name: 'URL 编解码',
  tagline: '百分号编解码 · 结构拆解 · Query 参数可视化编辑',
  icon: '🔗',
  category: 'encode',
  keywords: [
    'url',
    'uri',
    'encodeuricomponent',
    'decodeuricomponent',
    '百分号',
    '编码',
    '解码',
    'query',
    '参数',
    '链接',
  ],
  status: 'wip',
  order: 30,
  component: () => import('./UrlTool.vue'),
})
