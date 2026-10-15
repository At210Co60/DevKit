/**
 * 文本 Diff 核心逻辑 —— 第 1 层：纯函数
 *
 * 约定：
 * 1. 零 Vue、零 DOM、零副作用
 * 2. 依赖只有 diff@5.2（行级 + 字符级）
 * 3. 不产出玩梗文案，对外只返回结构化数据
 *
 * 关键设计：左右两栏共用同一份行序列（DiffRow），
 * 这样「同一行」在任何视图下都占同一位置，同步滚动才不会串行。
 */

import * as Diff from 'diff'

import { countTextStats, type TextStats } from '@/utils/format'

/* ══════════════ 类型 ══════════════ */

export type DiffRowType = 'context' | 'added' | 'removed' | 'modified'
export type DiffSegmentType = 'same' | 'added' | 'removed'

export interface DiffSegment {
  readonly type: DiffSegmentType
  readonly text: string
}

export interface DiffCell {
  readonly text: string
  /** 字符级切片，渲染时逐段上色；关闭字符级则只有一段 */
  readonly segments: readonly DiffSegment[]
}

export interface DiffRow {
  readonly type: DiffRowType
  readonly oldNumber: number | null
  readonly newNumber: number | null
  /** 左侧单元格，纯新增行为 null */
  readonly left: DiffCell | null
  /** 右侧单元格，纯删除行为 null */
  readonly right: DiffCell | null
}

export interface DiffUnifiedLine {
  readonly type: 'context' | 'added' | 'removed'
  readonly prefix: ' ' | '+' | '-'
  readonly oldNumber: number | null
  readonly newNumber: number | null
  readonly text: string
}

export interface DiffStats {
  readonly added: number
  readonly removed: number
  readonly modified: number
  readonly context: number
  readonly total: number
  readonly identical: boolean
}

export type DiffWarningCode = 'too-large'

export interface DiffWarning {
  readonly code: DiffWarningCode
  /** 两侧合计字节数 */
  readonly bytes: number
}

export interface DiffOptions {
  /** 忽略每行首尾空白 */
  readonly ignoreWhitespace?: boolean
  /** 忽略大小写 */
  readonly ignoreCase?: boolean
  /** 修改行内是否再做字符级对比 */
  readonly inlineChars?: boolean
}

export interface DiffResult {
  readonly rows: readonly DiffRow[]
  readonly unified: readonly DiffUnifiedLine[]
  readonly stats: DiffStats
  readonly warnings: readonly DiffWarning[]
  readonly leftStats: TextStats
  readonly rightStats: TextStats
}

/* ══════════════ 常量 ══════════════ */

/** 超过这个体量就提醒用户：再大浏览器会卡 */
export const LARGE_TEXT_LIMIT = 200 * 1024

export const DIFF_SAMPLE_LEFT = `# 发布流程
version: 2
stages:
  - build
  - test

timeout: 30s
retry: 3
`

export const DIFF_SAMPLE_RIGHT = `# 发布流程
version: 3
stages:
  - build
  - test
  - deploy

timeout: 90s
retry: 3
rollback: 蓝绿切换
`

/* ══════════════ 基础工具 ══════════════ */

/** 按行切分，末尾换行不产生多余空行 */
export function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** 归一化后再比较，保证「比的是什么」和「显示的是什么」永远是同一份 */
function normalizeSide(text: string, options: DiffOptions): string {
  let result = text
  if (options.ignoreWhitespace) {
    result = result
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
  }
  if (options.ignoreCase) result = result.toLowerCase()
  return result
}

function cell(text: string, type: DiffSegmentType): DiffCell {
  return { text, segments: [{ type, text }] }
}

/** 修改行：行内再做一次字符级对比，左右各自保留属于自己的片段 */
function mergeCells(oldLine: string, newLine: string, inlineChars: boolean): { left: DiffCell; right: DiffCell } {
  if (!inlineChars) return { left: cell(oldLine, 'removed'), right: cell(newLine, 'added') }

  const parts = Diff.diffChars(oldLine, newLine)
  const leftSegments: DiffSegment[] = []
  const rightSegments: DiffSegment[] = []
  for (const part of parts) {
    if (!part.added) leftSegments.push({ type: part.removed ? 'removed' : 'same', text: part.value })
    if (!part.removed) rightSegments.push({ type: part.added ? 'added' : 'same', text: part.value })
  }
  return {
    left: { text: oldLine, segments: leftSegments.length > 0 ? leftSegments : [{ type: 'same', text: '' }] },
    right: { text: newLine, segments: rightSegments.length > 0 ? rightSegments : [{ type: 'same', text: '' }] },
  }
}

/* ══════════════ 主入口 ══════════════ */

export function buildDiff(left: string, right: string, options: DiffOptions = {}): DiffResult {
  const inlineChars = options.inlineChars ?? true
  const source = normalizeSide(left, options)
  const target = normalizeSide(right, options)
  const changes = Diff.diffLines(source, target, {
    ignoreWhitespace: options.ignoreWhitespace ?? false,
    ignoreCase: options.ignoreCase ?? false,
  })

  const rows: DiffRow[] = []
  let oldNumber = 0
  let newNumber = 0
  let removedLines: string[] = []
  let addedLines: string[] = []

  /** 连续的删除块 + 新增块：能配对的就是「修改」，配不上的各自独立成行 */
  const flush = (): void => {
    if (removedLines.length === 0 && addedLines.length === 0) return
    const pairs = Math.min(removedLines.length, addedLines.length)

    for (let i = 0; i < removedLines.length; i += 1) {
      const oldText = removedLines[i] as string
      if (i < pairs) {
        const { left: leftCell, right: rightCell } = mergeCells(oldText, addedLines[i] as string, inlineChars)
        rows.push({
          type: 'modified',
          oldNumber: ++oldNumber,
          newNumber: ++newNumber,
          left: leftCell,
          right: rightCell,
        })
      } else {
        rows.push({
          type: 'removed',
          oldNumber: ++oldNumber,
          newNumber: null,
          left: cell(oldText, 'removed'),
          right: null,
        })
      }
    }

    for (let i = pairs; i < addedLines.length; i += 1) {
      const newText = addedLines[i] as string
      rows.push({ type: 'added', oldNumber: null, newNumber: ++newNumber, left: null, right: cell(newText, 'added') })
    }

    removedLines = []
    addedLines = []
  }

  for (const change of changes) {
    const lines = splitLines(change.value)
    if (change.added) {
      addedLines.push(...lines)
    } else if (change.removed) {
      removedLines.push(...lines)
    } else {
      flush()
      for (const line of lines) {
        rows.push({
          type: 'context',
          oldNumber: ++oldNumber,
          newNumber: ++newNumber,
          left: cell(line, 'same'),
          right: cell(line, 'same'),
        })
      }
    }
  }
  flush()

  const leftStats = countTextStats(left)
  const rightStats = countTextStats(right)
  const bytes = leftStats.bytes + rightStats.bytes

  return {
    rows,
    unified: toUnifiedLines(rows),
    stats: statsOf(rows),
    warnings: bytes > LARGE_TEXT_LIMIT ? [{ code: 'too-large' as const, bytes }] : [],
    leftStats,
    rightStats,
  }
}

/* ══════════════ 派生视图 ══════════════ */

export function statsOf(rows: readonly DiffRow[]): DiffStats {
  let added = 0
  let removed = 0
  let modified = 0
  let context = 0
  for (const row of rows) {
    if (row.type === 'added') added += 1
    else if (row.type === 'removed') removed += 1
    else if (row.type === 'modified') modified += 1
    else context += 1
  }
  return {
    added,
    removed,
    modified,
    context,
    total: rows.length,
    identical: added === 0 && removed === 0 && modified === 0,
  }
}

/** 统一视图：修改行拆成「先 - 后 +」两行，和 git 的输出习惯一致 */
export function toUnifiedLines(rows: readonly DiffRow[]): DiffUnifiedLine[] {
  const lines: DiffUnifiedLine[] = []
  for (const row of rows) {
    if (row.type === 'modified') {
      lines.push({
        type: 'removed',
        prefix: '-',
        oldNumber: row.oldNumber,
        newNumber: null,
        text: row.left?.text ?? '',
      })
      lines.push({ type: 'added', prefix: '+', oldNumber: null, newNumber: row.newNumber, text: row.right?.text ?? '' })
      continue
    }
    if (row.type === 'removed') {
      lines.push({
        type: 'removed',
        prefix: '-',
        oldNumber: row.oldNumber,
        newNumber: null,
        text: row.left?.text ?? '',
      })
      continue
    }
    if (row.type === 'added') {
      lines.push({ type: 'added', prefix: '+', oldNumber: null, newNumber: row.newNumber, text: row.right?.text ?? '' })
      continue
    }
    lines.push({
      type: 'context',
      prefix: ' ',
      oldNumber: row.oldNumber,
      newNumber: row.newNumber,
      text: row.left?.text ?? '',
    })
  }
  return lines
}

const NUMBER_WIDTH = 4

/** 统一视图的可复制文本，行号定宽对齐 */
export function formatUnifiedText(rows: readonly DiffRow[]): string {
  return toUnifiedLines(rows)
    .map((line) => {
      const no = String(line.type === 'added' ? line.newNumber : (line.oldNumber ?? '')).padStart(NUMBER_WIDTH, ' ')
      return `${line.prefix} ${no} | ${line.text}`
    })
    .join('\n')
}
