/**
 * JSON 工具的纯逻辑层
 *
 * 约束：
 * 1. 零 Vue、零 DOM、零副作用，全部同步 —— Vitest 直接可测
 * 2. 解析/格式化/错误扫描全部复用 @/utils/json-error，这里只负责工具级策略
 * 3. 不产出中文文案，文案一律由 @/content 决定
 *
 * 之所以不直接返回 JsonResult：空输入与超大输入不是「解析错误」，
 * 它们是两种不同的界面状态，用判别联合表达更利于 use 层编排。
 */
import type { IndentStyle, JsonErrorInfo } from '@/utils/json-error'
import { findJsonSyntaxError, formatJson, minifyJson, offsetToLineCol, sortJsonKeys } from '@/utils/json-error'
import { countTextStats } from '@/utils/format'

export type JsonMode = 'format' | 'minify' | 'sort'

export const JSON_MODES: readonly JsonMode[] = ['format', 'minify', 'sort']

export const JSON_INDENT_STYLES: readonly IndentStyle[] = ['2', '4', 'tab']

/** 超过这个体积就不再解析与渲染，避免主线程长时间阻塞 */
export const JSON_LARGE_INPUT_BYTES = 500 * 1024

/** 加载示例时填入的典型 JSON 对象 */
export const JSON_SAMPLE = `{
  "id": 1024,
  "name": "码匠 / DevKit",
  "active": true,
  "score": 99.5,
  "tags": ["encode", "text", "devops"],
  "owner": {
    "nickname": "码匠",
    "email": "devkit@example.com",
    "roles": ["frontend", "tooling"]
  },
  "meta": {
    "createdAt": "2024-05-20T13:45:30+08:00",
    "version": 2,
    "note": "所有计算都在浏览器内完成，不发送任何数据"
  },
  "members": null
}`

export type JsonRunOutcome =
  | { kind: 'ok'; text: string }
  /** 空白输入：不报错，只是没有可展示的东西 */
  | { kind: 'blank' }
  /** 体积超限：直接短路，不进 JSON.parse */
  | { kind: 'oversized'; bytes: number }
  | { kind: 'error'; info: JsonErrorInfo }

export interface JsonInputSize {
  chars: number
  bytes: number
  tooLarge: boolean
}

/** 只含空白字符 */
export function isBlankInput(source: string): boolean {
  return source.trim().length === 0
}

/** 输入体积统计（UTF-8 字节），顺带给出是否该走保护分支 */
export function measureInput(source: string): JsonInputSize {
  const stats = countTextStats(source)
  return { chars: stats.chars, bytes: stats.bytes, tooLarge: stats.bytes > JSON_LARGE_INPUT_BYTES }
}

/**
 * 按模式转换 JSON
 *
 * 先判空、再判体积，最后才解析 —— 顺序不能反，
 * 否则一份 10MB 的坏 JSON 会先把页面卡死，再谈报错。
 */
export function runJson(source: string, mode: JsonMode, indent: IndentStyle = '4'): JsonRunOutcome {
  if (isBlankInput(source)) return { kind: 'blank' }

  const size = measureInput(source)
  if (size.tooLarge) return { kind: 'oversized', bytes: size.bytes }

  const result =
    mode === 'minify' ? minifyJson(source) : mode === 'sort' ? sortJsonKeys(source, indent) : formatJson(source, indent)

  return result.ok ? { kind: 'ok', text: result.value } : { kind: 'error', info: result.error }
}

/** 取第 line 行（1-based）原文，用于错误上下文预览 */
export function extractLineText(source: string, line: number): string {
  if (line < 1) return ''
  const target = source.split('\n')[line - 1]
  if (target === undefined) return ''
  return target.length > 120 ? `${target.slice(0, 120)}…` : target
}

/* ══════════════ 错误定位兜底 ══════════════
 *
 * 扫描器实现已提升到 @/utils/json-error —— 那里是全站唯一的事实来源。
 * 之所以需要它：新版 V8 在输入较短时只回显片段、不给 `at position N`，
 * 而短 JSON 恰恰是本工具最常见的输入。少这一层，招牌功能直接失效。
 * 这里只做工具级包装，不重复实现。
 */
export const locateJsonErrorOffset = findJsonSyntaxError

export interface ErrorLocation {
  position: number
  line: number
  column: number
}

/**
 * 给出错误位置：引擎报了偏移量就用引擎的，没报就用本地扫描器兜底
 * 两边都没有时返回 null，界面只展示引擎文案，不硬编一个假位置。
 */
export function locateJsonError(source: string, info: JsonErrorInfo): ErrorLocation | null {
  const position = info.position ?? locateJsonErrorOffset(source)
  if (position === null || position < 0) return null
  const { line, column } = offsetToLineCol(source, position)
  return { position, line, column }
}

/** 统计顶层键数量，给出「这段 JSON 大概有多大」的感觉 */
export function countTopLevelKeys(source: string): number | null {
  const trimmed = source.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return Object.keys(parsed as Record<string, unknown>).length
  } catch {
    return null
  }
}
