import { defineTool } from '../define'

/**
 * 时间戳转换
 *
 * 成熟度维持 wip：时区反解在夏令时边界上还需要更多真实样本验证。
 */
export const timestampTool = defineTool({
  id: 'timestamp',
  name: '时间戳转换',
  tagline: 'Unix 秒 / 毫秒 ↔ 可读日期，自动识别位数与时区',
  icon: '⏱',
  category: 'devops',
  keywords: ['时间戳', '日期', 'unix', 'timestamp', '时间', '时区', 'utc', 'iso', 'date', '毫秒', '秒'],
  status: 'wip',
  order: 20,
  component: () => import('./TimestampTool.vue'),
})
