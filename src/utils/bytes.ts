/**
 * 字节与各种文本表示之间的互转
 *
 * 这里的函数是 codec 工具的地基：
 * 所有编码/解密操作最终都落到「字节序列」上，先把这条转换链修好。
 *
 * 约定：入参出参一律用 Uint8Array，不用 ArrayBuffer —— 可直接传给 Web Crypto API
 */

const HEX_RE = /^[0-9a-fA-F]*$/
const BIN_RE = /^[01\s]*$/
const OCT_RE = /^[0-7\s]*$/

/* ══════════════ 文本 ↔ 字节 ══════════════ */

/** UTF-8 字符串 → 字节 */
export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/** 字节 → UTF-8 字符串。label 用于解码失败时给出更准的提示 */
export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

/** 字节 → UTF-8 字符串（严格模式：非法字节序列直接抛错，而不是塞进 U+FFFD） */
export function bytesToTextStrict(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/* ══════════════ 字节 ↔ 数值表示 ══════════════ */

/** 字节 → 十六进制字符串（可指定分隔符，默认无） */
export function bytesToHex(bytes: Uint8Array, separator = ''): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(separator)
}

/** 十六进制 → 字节。奇数长度或含非十六进制字符则抛错 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[\s:,-]/g, '')
  if (!HEX_RE.test(clean)) throw new Error('包含非十六进制字符')
  if (clean.length % 2 !== 0) throw new Error('十六进制长度必须为偶数')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/** 字节 → 二进制字符串（按字节分组，用空格隔开） */
export function bytesToBinary(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join(' ')
}

/** 二进制字符串 → 字节 */
export function binaryToBytes(bin: string): Uint8Array {
  const clean = bin.replace(/[\s,]/g, '')
  if (!BIN_RE.test(clean)) throw new Error('包含非二进制字符')
  if (clean.length % 8 !== 0) throw new Error('二进制长度必须为 8 的倍数')
  const out = new Uint8Array(clean.length / 8)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 8, i * 8 + 8), 2)
  }
  return out
}

/** 字节 → 八进制字符串 */
export function bytesToOctal(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(8).padStart(3, '0')).join(' ')
}

/** 八进制字符串 → 字节 */
export function octalToBytes(oct: string): Uint8Array {
  const clean = oct.replace(/[\s,]/g, '')
  if (!OCT_RE.test(clean)) throw new Error('包含非八进制字符')
  // 漏掉这行检查会导致末尾不足 3 位的片段被静默丢弃 —— 字节少了还不报错，是最坏的失败方式
  if (clean.length % 3 !== 0) throw new Error('八进制长度必须为 3 的倍数（每字节 3 位）')
  const out = new Uint8Array(clean.length / 3)
  for (let i = 0; i < out.length; i++) {
    const v = Number.parseInt(clean.slice(i * 3, i * 3 + 3), 8)
    if (v > 255) throw new Error(`八进制片段 ${clean.slice(i * 3, i * 3 + 3)} 超出单字节范围`)
    out[i] = v
  }
  return out
}

/* ══════════════ 判定 ══════════════ */

/** 是否是（可能带空格/分隔符的）合法十六进制 */
export function isHex(s: string): boolean {
  const clean = s.replace(/[\s:,-]/g, '')
  return clean.length > 0 && clean.length % 2 === 0 && HEX_RE.test(clean)
}

/** 是否是合法二进制 */
export function isBinary(s: string): boolean {
  const clean = s.replace(/[\s,]/g, '')
  return clean.length > 0 && clean.length % 8 === 0 && BIN_RE.test(clean)
}

/* ══════════════ 展示 ══════════════ */

/** 字节数 → 人类可读体积，如 1.5 KB */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
