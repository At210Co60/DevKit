import { defineTool } from '../define'

/**
 * JSON 格式化
 *
 * 成熟度维持 wip：解析层已经很稳，但大文件保护与错误定位的边界还在调。
 */
export const jsonTool = defineTool({
  id: 'json',
  name: 'JSON 格式化',
  tagline: '美化 / 压缩 / 按 key 排序，语法错误精确到行列',
  icon: '{ }',
  category: 'text',
  keywords: ['json', '格式化', '美化', '压缩', '排序', 'format', 'beautify', 'minify', 'pretty'],
  status: 'wip',
  order: 10,
  component: () => import('./JsonTool.vue'),
})
