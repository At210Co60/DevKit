import { bytesToText, textToBytes } from './bytes'

/**
 * UTF-8 安全的 Base64 编解码
 *
 * 为什么不用 btoa/atob 直接转字符串：
 * btoa 只接受 Latin-1，遇到中文会直接抛 InvalidCharacterError；
 * 且 String.fromCharCode(...bytes) 在大文本上会栈溢出，必须分块。
 */

const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/
const B64URL_RE = /^[A-Za-z0-9_-]*={0,2}$/
const CHUNK = 0x8000

/* ══════════════ 字节 ↔ Base64 ══════════════ */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/* ══════════════ 文本 ↔ Base64 ══════════════ */

/** UTF-8 文本 → 标准 Base64（含 + / = 填充） */
export function encodeBase64(text: string): string {
  return bytesToBase64(textToBytes(text))
}

/** Base64 → UTF-8 文本 */
export function decodeBase64(b64: string): string {
  return bytesToText(base64ToBytes(normalizePadding(b64)))
}

/** UTF-8 文本 → URL-safe Base64（- _ 替代 + /，可保留 = 填充） */
export function encodeBase64Url(text: string): string {
  return bytesToBase64(textToBytes(text)).replace(/\+/g, '-').replace(/\//g, '_')
}

/** URL-safe Base64 → UTF-8 文本 */
export function decodeBase64Url(b64: string): string {
  return bytesToText(base64ToBytes(normalizePadding(b64.replace(/-/g, '+').replace(/_/g, '/'))))
}

/** 补齐 = 填充。很多来源的 Base64 会省略末尾的 = */
export function normalizePadding(b64: string): string {
  const clean = b64.replace(/\s/g, '')
  const remainder = clean.length % 4
  if (remainder === 1) throw new Error('长度非法：去掉填充后余数为 1，不是合法的 Base64')
  if (remainder === 0) return clean
  return clean + '='.repeat(4 - remainder)
}

/* ══════════════ 判定 ══════════════ */

export function isBase64(s: string): boolean {
  const clean = s.replace(/\s/g, '')
  if (clean.length < 4 || clean.length % 4 !== 0) return false
  if (!B64_RE.test(clean)) return false
  // 纯数字或纯字母的短串很容易误判，要求至少混用大小写或数字，或长度够长
  return /[A-Z]/.test(clean) || /\d/.test(clean) || clean.length >= 24
}

export function isBase64Url(s: string): boolean {
  const clean = s.replace(/\s/g, '')
  return clean.length >= 8 && B64URL_RE.test(clean) && /[-_]/.test(clean)
}
