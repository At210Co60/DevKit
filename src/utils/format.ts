/**
 * 通用文本格式化工具（无业务语义）
 */

export interface TextStats {
  /** 字符总数（含空白） */
  chars: number
  /** 字符数（不含空白） */
  charsNoSpace: number
  /** 中文字符数（CJK 统一表意文字区） */
  cjk: number
  /** 行数（空字符串算 0 行） */
  lines: number
  /** 按空白切分的词数 */
  words: number
  /** UTF-8 字节数 */
  bytes: number
  /** 行最长长度 */
  maxLineLength: number
}

/** 统计一段文本的规模指标 */
export function countTextStats(text: string): TextStats {
  const lines = text.length === 0 ? [] : text.split('\n')
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return {
    chars: text.length,
    charsNoSpace: text.replace(/\s/g, '').length,
    cjk: (text.match(/[\u4e00-\u9fff]/g) ?? []).length,
    lines: lines.length,
    words,
    bytes: new TextEncoder().encode(text).length,
    maxLineLength: lines.reduce((max, l) => Math.max(max, l.length), 0),
  }
}

/** 千分位分隔 */
export function toFixedNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/** 超长文本截断（用于预览展示） */
export function truncate(text: string, max: number, suffix = '…'): string {
  return text.length <= max ? text : text.slice(0, max) + suffix
}

/* ══════════════ HTML 实体 ══════════════ */

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** HTML 实体 → 字符 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const cp = Number.parseInt(body.slice(2), 16)
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : match
    }
    if (body.startsWith('#')) {
      const cp = Number.parseInt(body.slice(1), 10)
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : match
    }
    return HTML_ENTITIES[body.toLowerCase()] ?? match
  })
}

/** 字符 → HTML 实体（只转义有意义的符号） */
export function encodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function hasHtmlEntity(s: string): boolean {
  return /&(#x?[0-9a-fA-F]+|[a-zA-Z]{2,6});/.test(s)
}
