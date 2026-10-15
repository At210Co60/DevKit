import type { Component } from 'vue'

/**
 * 工具成熟度 —— 决定卡片/侧栏的角标展示
 */
export type ToolStatus = 'wip' | 'beta' | 'stable'

/**
 * 工具分组 —— 侧栏折叠与首页分区依据
 * 新增分组只需在这里加一个成员，其余代码无需改动
 */
export type ToolCategory = 'encode' | 'text' | 'devops' | 'security'

export const TOOL_CATEGORIES: readonly ToolCategory[] = ['encode', 'text', 'devops', 'security'] as const

/**
 * 工具契约 —— 全站唯一清单的数据形状
 *
 * 任何新增字段都必须是可选的，且必须给出默认值，
 * 否则会逼迫所有历史工具同步修改，破坏 §3.1 的工具自包含原则。
 */
export interface ToolDefinition {
  /** 唯一 id，同时是 URL 片段：/tools/json */
  id: string
  /** 侧栏与卡片显示名 */
  name: string
  /** 一句话说明，卡片副标题 */
  tagline: string
  /** 图标（emoji 或单字符） */
  icon: string
  /** 所属分组 */
  category: ToolCategory
  /** 搜索关键词，支持中英文与别名 */
  keywords: readonly string[]
  /** 成熟度，默认 'stable' */
  status: ToolStatus
  /** 侧栏与卡片排序权重，越小越靠前 */
  order: number
  /** 工具页组件，必须懒加载，保证每个工具独立 chunk */
  component: () => Promise<{ default: Component }>
}

/**
 * 传给 defineTool 的形状 —— 与 ToolDefinition 的区别是三个字段可选。
 * 少了这个类型，defineTool 里的默认值就永远用不上（TS 会要求每个工具显式传全）。
 */
export type ToolDefinitionInput = Omit<ToolDefinition, 'status' | 'order' | 'keywords'> &
  Partial<Pick<ToolDefinition, 'status' | 'order' | 'keywords'>>

/** 工具 id 的类型约束，避免拼写错误进入 URL */
export type ToolId = string
