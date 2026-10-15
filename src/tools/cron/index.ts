import { defineTool } from '../define'

export const cronTool = defineTool({
  id: 'cron',
  name: 'Cron 表达式',
  tagline: '五段式解析 + 接下来 5 次运行时间',
  icon: '⏰',
  category: 'devops',
  keywords: ['cron', 'crontab', '定时', '调度', 'schedule', '定时任务'],
  status: 'wip',
  order: 40,
  component: () => import('./CronTool.vue'),
})
