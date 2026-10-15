import type { ToolDefinition, ToolDefinitionInput } from './shared'

/**
 * 工具定义工厂 —— 补齐可选字段的默认值
 *
 * 只做「填默认值」这一件事，不做校验、不做注册。
 * 保持工具文件夹自包含：每个工具在自己的 index.ts 里调用它，
 * registry.ts 只负责汇总，不需要认识任何具体工具的字段。
 *
 * 参数类型必须是 ToolDefinitionInput 而不是 ToolDefinition ——
 * 否则 TS 会把三个可选字段重新变成必填，这里的默认值就成了死代码。
 */
export function defineTool(definition: ToolDefinitionInput): ToolDefinition {
  return {
    status: 'stable',
    order: 100,
    keywords: [],
    ...definition,
  }
}
