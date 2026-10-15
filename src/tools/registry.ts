import { defineTool } from './define'
import type { ToolCategory, ToolDefinition } from './shared'

import { base64Tool } from './base64'
import { codecTool } from './codec'
import { cronTool } from './cron'
import { diffTool } from './diff'
import { jsonTool } from './json'
import { timestampTool } from './timestamp'
import { urlTool } from './url'

/**
 * ═══ 全站唯一的工具清单 ═══
 *
 * 路由、侧栏菜单、首页卡片、搜索、命令面板全部从这里派生。
 * 加一个工具只需要：新建 `src/tools/<id>/` + 在下面数组里加一行。
 *
 * 如果你发现「加一个工具需要改本文件以外的地方」，说明抽象漏了需求，
 * 应该修抽象，而不是在各个地方加特例。
 */
export const TOOLS: readonly ToolDefinition[] = [
  jsonTool,
  base64Tool,
  urlTool,
  timestampTool,
  cronTool,
  diffTool,
  codecTool,
].sort((a, b) => a.order - b.order)

/** 按 id 精确查找 */
export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id)
}

/** 按分组聚合，保持 TOOLS 的排序 */
export function toolsByCategory(): Map<ToolCategory, ToolDefinition[]> {
  const map = new Map<ToolCategory, ToolDefinition[]>()
  for (const tool of TOOLS) {
    const bucket = map.get(tool.category)
    if (bucket) bucket.push(tool)
    else map.set(tool.category, [tool])
  }
  return map
}

/** 模糊搜索：匹配 id / 名称 / 关键词（大小写与空格不敏感） */
export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...TOOLS]

  return TOOLS.filter((tool) => {
    const haystack = [tool.id, tool.name, tool.tagline, ...tool.keywords].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

export { defineTool }
export { TOOL_CATEGORIES } from './shared'
export type { ToolCategory, ToolDefinition, ToolDefinitionInput, ToolStatus } from './shared'
