/**
 * JSON 安全解析与错误定位
 *
 * JSON.parse 的原生报错在不同引擎下格式不一：
 *   V8 旧版:  "Unexpected token } in JSON at position 42"
 *   V8 新版:  "... at position 42 (line 3 column 5)"
 *   Firefox:  "JSON.parse: expected ',' or '}' after property value at line 3 column 5"
 *   Safari:    "JSON Parse error: Expected '}'"
 *
 * 更麻烦的是新版 V8 有第二种形态：
 *   "Unexpected token '}', ..."{"a":}" is not valid JSON"   ← 没有 position
 * 输入短到能整段回显时，V8 就改用这种文案，于是位置信息整个消失。
 * 而短 JSON 恰恰是工具里最常见的输入 —— 所以必须自己兜底。
 *
 * 这里先从各种格式里捞位置，捞不到就用下方扫描器；
 * 两边都拿不到时返回 null，宁可少说也不给编造的行列。
 */

export interface JsonErrorInfo {
  /** 面向用户的错误描述（已剥离堆栈与引擎前缀） */
  message: string
  /** 字符偏移量，未知时为 null */
  position: number | null
  /** 行号，从 1 开始；未知时为 null */
  line: number | null
  /** 列号，从 1 开始；未知时为 null */
  column: number | null
}

export type JsonResult<T = unknown> = { ok: true; value: T } | { ok: false; error: JsonErrorInfo }

/** 从 position 偏移量算出行列（均为 1-based） */
export function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const safe = Math.max(0, Math.min(offset, source.length))
  let line = 1
  let lastBreak = -1
  for (let i = 0; i < safe; i++) {
    if (source[i] === '\n') {
      line++
      lastBreak = i
    }
  }
  return { line, column: safe - lastBreak }
}

/** 剥掉引擎自带的前缀噪音，留下人能看懂的部分 */
function cleanMessage(raw: string): string {
  return raw
    .replace(/^JSON\.parse:\s*/i, '')
    .replace(/^JSON Parse error:\s*/i, '')
    .replace(/\s*in JSON at position\s*\d+\s*(\(.*\))?$/i, '')
    .replace(/\s*at line \d+ column \d+\s*$/i, '')
    .replace(/\s*,?\s*"[\s\S]*"\s*is not valid JSON\s*$/i, '')
    .trim()
}

function extractPosition(raw: string): number | null {
  const m = raw.match(/at position (\d+)/i)
  return m ? Number.parseInt(m[1], 10) : null
}

/* ══════════════ 错误位置扫描器 ══════════════ */

type FrameKind = 'object' | 'array'
type FrameExpect = 'keyOrEnd' | 'colon' | 'value' | 'commaOrEnd' | 'valueOrEnd'

interface Frame {
  kind: FrameKind
  expect: FrameExpect
  /** 容器起始位置，用于「少了一个右括号」时回指 */
  start: number
  /** 刚吃过逗号，用来识别尾逗号 */
  afterComma: boolean
  /** 最近一个逗号的位置 */
  commaAt: number
}

const WHITESPACE = new Set([' ', '\t', '\n', '\r'])

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9'
}

/** 返回闭合引号之后的下标；未闭合返回 -1 */
function readStringEnd(source: string, start: number): number {
  let i = start + 1
  while (i < source.length) {
    const ch = source[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '"') return i + 1
    i++
  }
  return -1
}

/** 严格按 JSON 数字文法扫描，失败返回 -1 且不移动游标 */
function readNumberEnd(source: string, start: number): number {
  const n = source.length
  let i = start
  if (source[i] === '-') i++
  if (source[i] === '0') i++
  else if (isDigit(source[i])) while (i < n && isDigit(source[i])) i++
  else return -1

  if (source[i] === '.') {
    i++
    if (!isDigit(source[i])) return -1
    while (i < n && isDigit(source[i])) i++
  }
  if (source[i] === 'e' || source[i] === 'E') {
    i++
    if (source[i] === '+' || source[i] === '-') i++
    if (!isDigit(source[i])) return -1
    while (i < n && isDigit(source[i])) i++
  }
  return i
}

/**
 * 扫出第一个让文档无法继续的位置（0-based 偏移量）
 *
 * 用显式栈而非递归：深层嵌套的坏 JSON 不能把调用栈打爆。
 * 合法 JSON 返回 null；识别不了的极端情况也返回 null，交由上层降级展示。
 */
export function findJsonSyntaxError(source: string): number | null {
  const n = source.length
  let i = 0
  let rootDone = false
  const stack: Frame[] = []

  const skipWs = (): void => {
    while (i < n && WHITESPACE.has(source[i])) i++
  }

  const readValue = (): boolean => {
    skipWs()
    if (i >= n) return false
    const start = i
    const ch = source[i]

    if (ch === '{') {
      stack.push({ kind: 'object', expect: 'keyOrEnd', start, afterComma: false, commaAt: -1 })
      i++
      return true
    }
    if (ch === '[') {
      stack.push({ kind: 'array', expect: 'valueOrEnd', start, afterComma: false, commaAt: -1 })
      i++
      return true
    }
    if (ch === '"') {
      const end = readStringEnd(source, i)
      if (end < 0) return false
      i = end
      return true
    }
    if (ch === '-' || isDigit(ch)) {
      const end = readNumberEnd(source, i)
      if (end < 0) return false
      i = end
      return true
    }
    for (const literal of ['true', 'false', 'null']) {
      if (source.startsWith(literal, i)) {
        i += literal.length
        return true
      }
    }
    return false
  }

  const readKey = (): boolean => {
    skipWs()
    if (source[i] !== '"') return false
    const end = readStringEnd(source, i)
    if (end < 0) return false
    i = end
    return true
  }

  for (;;) {
    skipWs()
    if (i >= n) break
    const top = stack[stack.length - 1]

    if (!top) {
      if (rootDone) return i
      if (!readValue()) return i
      rootDone = true
      continue
    }

    if (top.kind === 'object') {
      switch (top.expect) {
        case 'keyOrEnd':
          // 尾逗号：`{"a":1,}`
          if (top.afterComma && (source[i] === '}' || source[i] === ']')) return top.commaAt
          if (source[i] === '}') {
            stack.pop()
            i++
            continue
          }
          if (!readKey()) return i
          top.afterComma = false
          top.expect = 'colon'
          continue
        case 'colon':
          if (source[i] !== ':') return i
          i++
          top.expect = 'value'
          continue
        case 'value':
          if (!readValue()) return i
          top.afterComma = false
          top.expect = 'commaOrEnd'
          continue
        case 'commaOrEnd':
          if (source[i] === ',') {
            top.afterComma = true
            top.commaAt = i
            top.expect = 'keyOrEnd'
            i++
            continue
          }
          if (source[i] === '}') {
            stack.pop()
            i++
            continue
          }
          return i
      }
      continue
    }

    switch (top.expect) {
      case 'valueOrEnd':
        // 尾逗号：`[1,]`
        if (top.afterComma && (source[i] === '}' || source[i] === ']')) return top.commaAt
        if (source[i] === ']') {
          stack.pop()
          i++
          continue
        }
        if (!readValue()) return i
        top.afterComma = false
        top.expect = 'commaOrEnd'
        continue
      case 'commaOrEnd':
        if (source[i] === ',') {
          top.afterComma = true
          top.commaAt = i
          top.expect = 'valueOrEnd'
          i++
          continue
        }
        if (source[i] === ']') {
          stack.pop()
          i++
          continue
        }
        return i
    }
  }

  // 输入用尽但还有容器没闭合 → 回指最外层那个左括号
  if (stack.length > 0) return rootDone ? stack[0].start : n
  return null
}

/** 带行列信息的解析。成功返回 value，失败返回结构化错误 */
export function parseJson<T = unknown>(source: string): JsonResult<T> {
  try {
    return { ok: true, value: JSON.parse(source) as T }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)

    // V8 对短输入不给 position，用自研扫描器兜底
    let position = extractPosition(raw)
    if (position === null) position = findJsonSyntaxError(source)

    const { line, column } = position !== null ? offsetToLineCol(source, position) : { line: null, column: null }

    return {
      ok: false,
      error: {
        message: cleanMessage(raw) || 'JSON 解析失败',
        position,
        line,
        column,
      },
    }
  }
}

/* ══════════════ 美化 / 压缩 ══════════════ */

export type IndentStyle = '2' | '4' | 'tab'

function indentChar(style: IndentStyle): string | number {
  return style === 'tab' ? '\t' : Number(style)
}

/** 美化。保持 key 顺序（JSON.parse 保序） */
export function formatJson(source: string, style: IndentStyle = '4'): JsonResult<string> {
  const parsed = parseJson(source)
  if (!parsed.ok) return parsed
  return { ok: true, value: JSON.stringify(parsed.value, null, indentChar(style)) }
}

/** 压缩 */
export function minifyJson(source: string): JsonResult<string> {
  const parsed = parseJson(source)
  if (!parsed.ok) return parsed
  return { ok: true, value: JSON.stringify(parsed.value) }
}

/** 按 key 排序后输出（递归）。数组保持原顺序 */
export function sortJsonKeys(source: string, style: IndentStyle = '4'): JsonResult<string> {
  const parsed = parseJson(source)
  if (!parsed.ok) return parsed

  const sortDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortDeep)
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]))
    }
    return value
  }

  return { ok: true, value: JSON.stringify(sortDeep(parsed.value), null, indentChar(style)) }
}
