/**
 * 常见文本转义形式的编解码
 * 集中在 codec 工具使用，也供未来的独立小工具复用
 */

const UNICODE_ESCAPE_RE = /\\u([0-9a-fA-F]{4})/g
const UNICODE_SURROGATE_RE = /\\u\{([0-9a-fA-F]{1,6})\}/g

/* ══════════════ Unicode 转义 ══════════════ */

/**
 * 中文 → \uXXXX 转义
 *
 * 超过 BMP 的字符（emoji 等）必须用 \u{...} 形式：
 * JS 的 \u 转义只解析 4 位十六进制，码位 1F41B 若写成 \u1f41b
 * 会被解析成 \u1f41 + 字母 'b'，解码时静默错位。
 */
export function encodeUnicodeEscape(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp < 0x80) {
      out += ch
    } else if (cp <= 0xffff) {
      out += `\\u${cp.toString(16).padStart(4, '0')}`
    } else {
      out += `\\u{${cp.toString(16).toUpperCase()}}`
    }
  }
  return out
}

/**
 * \uXXXX → 中文
 * 同时支持 \u{1F600} 这种带花括号的代理对写法
 */
export function decodeUnicodeEscape(text: string): string {
  return text
    .replace(UNICODE_SURROGATE_RE, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(UNICODE_ESCAPE_RE, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
}

/* ══════════════ 字符码位 ══════════════ */

/** 文本 → 码位列表，如 中 → "4E2D 6587" */
export function textToCodePoints(text: string): string {
  return Array.from(text, (ch) => ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ')
}

/** 码位列表 → 文本（十进制或十六进制均支持） */
export function codePointsToText(input: string): string {
  return input
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => {
      const cp = token.toLowerCase().startsWith('0x') ? Number.parseInt(token.slice(2), 16) : Number.parseInt(token, 16)
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) throw new Error(`码位非法：${token}`)
      return String.fromCodePoint(cp)
    })
    .join('')
}

/* ══════════════ 判定 ══════════════ */

export function hasUnicodeEscape(s: string): boolean {
  UNICODE_ESCAPE_RE.lastIndex = 0
  return UNICODE_ESCAPE_RE.test(s) || /\\u\{[0-9a-fA-F]{1,6}\}/.test(s)
}
