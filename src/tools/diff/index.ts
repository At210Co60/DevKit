import { defineTool } from '../define'

export const diffTool = defineTool({
  id: 'diff',
  name: '文本 Diff',
  tagline: '左右两栏逐行对比 + 字符级标红标绿',
  icon: '⇄',
  category: 'text',
  keywords: ['diff', '对比', '比较', '逐行', 'text compare', '差异'],
  status: 'wip',
  order: 50,
  component: () => import('./DiffTool.vue'),
})
