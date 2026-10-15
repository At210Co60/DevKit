/**
 * Base64 编解码的纯逻辑层
 *
 * 三条硬约定：
 * 1. 零 Vue、零 DOM、零副作用 —— FileReader / Blob / <a download> 全部留给 use 层
 * 2. 中文按 UTF-8 处理，不碰 btoa 的 Latin-1 坑（底层封装在 @/utils/base64）
 * 3. 出错返回结构化结果，不抛未捕获异常 —— 工具页必须把错误讲清楚，而不是白屏
 *
 * 文案不在这一层：错误只给机器可读 code 与技术性 detail，
 * 中文提示由 use 层映射到 @/content 的 quips。
 */

import { base64ToBytes, bytesToBase64, encodeBase64, encodeBase64Url, normalizePadding } from '@/utils/base64'
import { bytesToTextStrict, formatBytes, textToBytes } from '@/utils/bytes'

/* ══════════════ 类型 ══════════════ */

export type Base64Mode = 'encode' | 'decode' | 'encodeUrl' | 'decodeUrl'

export type Base64ErrorCode =
  'empty' | 'invalidChar' | 'badLength' | 'notUtf8' | 'tooLarge' | 'readFailed' | 'invalidDataUrl'

export interface Base64Success {
  ok: true
  value: string
  /** 结果占多少字节。注意：中文 1 个字符 = 3 字节，所以这个数通常比「字符数」大 */
  byteLength: number
}

export interface Base64Failure {
  ok: false
  code: Base64ErrorCode
  /** 技术性说明，给 ResultBox 的等宽错误详情用 */
  detail: string
}

export type Base64Result = Base64Success | Base64Failure

export interface BytesSuccess {
  ok: true
  value: Uint8Array
}

export type BytesResult = BytesSuccess | Base64Failure

export interface DataUrlParts {
  mime: string
  bytes: Uint8Array
}

export interface DataUrlSuccess {
  ok: true
  value: DataUrlParts
}

export type DataUrlResult = DataUrlSuccess | Base64Failure

export interface DownloadPlan {
  filename: string
  mime: string
  bytes: Uint8Array
  byteLength: number
}

export interface DownloadSuccess {
  ok: true
  value: DownloadPlan
}

export type DownloadResult = DownloadSuccess | Base64Failure

/* ══════════════ 常量 ══════════════ */

/** 四个模式的固定顺序，UI 切换器直接渲染 */
export const BASE64_MODES: readonly Base64Mode[] = ['encode', 'decode', 'encodeUrl', 'decodeUrl'] as const

/** 本地处理上限。超过就别转了，浏览器会卡，用户也不想等 */
export const MAX_FILE_BYTES = 8 * 1024 * 1024

const DATA_URL_RE = /^data:[^,]*;base64,/i

/** MIME → 扩展名。只收常见的，猜不到就 .bin */
const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
  'application/json': '.json',
  'application/xml': '.xml',
  'application/zip': '.zip',
  'application/gzip': '.gz',
  'application/javascript': '.js',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'video/mp4': '.mp4',
  'font/woff2': '.woff2',
  'text/plain': '.txt',
  'text/html': '.html',
  'text/css': '.css',
  'text/csv': '.csv',
}

/* ══════════════ 模式 ══════════════ */

const INVERTED: Record<Base64Mode, Base64Mode> = {
  encode: 'decode',
  decode: 'encode',
  encodeUrl: 'decodeUrl',
  decodeUrl: 'encodeUrl',
}

export function isEncodeMode(mode: Base64Mode): boolean {
  return mode === 'encode' || mode === 'encodeUrl'
}

/** 互逆模式，给「交换左右」用 */
export function invertMode(mode: Base64Mode): Base64Mode {
  return INVERTED[mode]
}

/* ══════════════ 文本 ↔ Base64 ══════════════ */

/**
 * 按模式转换。编码模式原样保留空白，解码模式才清洗输入
 * —— 否则「输入一段带换行的文本」会被无声地吃掉换行符。
 *
 * 解码不分 URL-safe 与标准：URL-safe 只是把 + / 换成 - _，解的时候两张字母表等价，
 * 统一在 decodeToBytes 里归一化，少一个能写错的开关。
 */
export function convert(input: string, mode: Base64Mode): Base64Result {
  if (isEncodeMode(mode)) return encodeText(input, mode === 'encodeUrl')

  const clean = normalizeBase64(input)
  if (!clean) return fail('empty', 'input is empty')
  return decodeText(clean)
}

/** UTF-8 文本 → Base64。URL-safe 时 + / 换成 - _ */
export function encodeText(text: string, urlSafe = false): Base64Result {
  const bytes = textToBytes(text)
  return done(urlSafe ? encodeBase64Url(text) : encodeBase64(text), bytes.length)
}

/** Base64 → UTF-8 文本。二进制载荷返回 notUtf8，而不是给用户一屏 U+FFFD */
export function decodeText(b64: string): Base64Result {
  const decoded = decodeToBytes(b64)
  if (!decoded.ok) return decoded

  const bytes = decoded.value
  try {
    return done(bytesToTextStrict(bytes), bytes.length)
  } catch {
    return fail('notUtf8', `${bytes.length} bytes are not valid UTF-8 text — looks like a binary payload`)
  }
}

/**
 * Base64 → 字节。不做 UTF-8 校验，给「下载原始文件」用
 *
 * 长度按 %4 补齐，所以省略末尾 = 的输入（很多地方都这么干）也能吃下。
 */
export function decodeToBytes(b64: string): BytesResult {
  const clean = b64.replace(/\s/g, '')
  if (!clean) return fail('empty', 'input is empty')

  const bad = invalidCharDetail(clean)
  if (bad) return fail('invalidChar', bad)

  let padded: string
  try {
    padded = normalizePadding(clean)
  } catch (error) {
    return fail('badLength', messageOf(error))
  }

  try {
    return { ok: true, value: base64ToBytes(toStandardAlphabet(padded)) }
  } catch (error) {
    return fail('invalidChar', messageOf(error))
  }
}

/* ══════════════ DataURL ══════════════ */

export function isDataUrl(s: string): boolean {
  return DATA_URL_RE.test(s.trim())
}

/** 去掉 data:...;base64, 前缀，兼容用户直接粘一整条 DataURL 进来 */
export function stripDataUrlPrefix(s: string): string {
  const trimmed = s.trim()
  if (!isDataUrl(trimmed)) return trimmed
  const comma = trimmed.indexOf(',')
  return comma === -1 ? '' : trimmed.slice(comma + 1)
}

/** 清洗解码输入：去空白 + 去 DataURL 前缀 */
export function normalizeBase64(input: string): string {
  return stripDataUrlPrefix(input).replace(/\s/g, '')
}

export function buildDataUrl(bytes: Uint8Array, mime = 'application/octet-stream'): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}

/** 拆 DataURL：拿 MIME + 原始字节（下载回文件时用） */
export function parseDataUrl(dataUrl: string): DataUrlResult {
  const trimmed = dataUrl.trim()
  if (!isDataUrl(trimmed)) return fail('invalidDataUrl', 'not a base64 data: URL')

  const comma = trimmed.indexOf(',')
  const meta = trimmed.slice('data:'.length, comma)
  const mime = meta.split(';')[0].trim() || 'application/octet-stream'
  const decoded = decodeToBytes(trimmed.slice(comma + 1))
  if (!decoded.ok) return decoded

  return { ok: true, value: { mime, bytes: decoded.value } }
}

/* ══════════════ 下载方案（只算不做，真正的 Blob 与 <a download> 在 use 层） ══════════════ */

/**
 * 把当前输出换算成「可下载文件」。
 *
 * DataURL 走原 MIME 还原成原文件；裸 Base64 先试 UTF-8 文本，
 * 成就是 .txt，不成就是 .bin —— 猜不出类型时宁可给二进制，也不给错扩展名。
 */
export function planDownload(input: string): DownloadResult {
  const trimmed = input.trim()
  if (!trimmed) return fail('empty', 'nothing to download')

  if (isDataUrl(trimmed)) {
    const parsed = parseDataUrl(trimmed)
    if (!parsed.ok) return parsed
    const { mime, bytes } = parsed.value
    return plan({ filename: `base64-decoded${guessExtension(mime)}`, mime, bytes })
  }

  const decoded = decodeToBytes(trimmed)
  if (!decoded.ok) return decoded

  const bytes = decoded.value
  if (looksLikeText(bytes) !== null)
    return plan({ filename: 'base64-decoded.txt', mime: 'text/plain;charset=utf-8', bytes })
  return plan({ filename: 'base64-decoded.bin', mime: 'application/octet-stream', bytes })
}

/** MIME → 扩展名，未知一律 .bin */
export function guessExtension(mime: string): string {
  return MIME_EXT[mime.split(';')[0].trim().toLowerCase()] ?? '.bin'
}

/* ══════════════ 展示 ══════════════ */

/** 字节数 → 「精确值 + 可读体积」。小于 1KB 时不重复啰嗦 */
export function describeSize(byteLength: number): string {
  if (byteLength < 1024) return `${byteLength} B`
  return `${byteLength} B · ${formatBytes(byteLength)}`
}

/* ══════════════ 内部工具 ══════════════ */

function done(value: string, byteLength: number): Base64Success {
  return { ok: true, value, byteLength }
}

/** DownloadPlan 的 byteLength 一律由 bytes.length 推导，不给调用方传错的机会 */
function plan(input: Omit<DownloadPlan, 'byteLength'>): DownloadSuccess {
  return { ok: true, value: { ...input, byteLength: input.bytes.length } }
}

function fail(code: Base64ErrorCode, detail: string): Base64Failure {
  return { ok: false, code, detail }
}

function toStandardAlphabet(b64: string): string {
  return b64.replace(/-/g, '+').replace(/_/g, '/')
}

/**
 * 判断这堆字节「像不像文本」：既要能按 UTF-8 解开，也不能夹带控制字符。
 * 只判 UTF-8 是不够的 —— 合法编码的二进制（如 0x89 开头）会被误判成文本，
 * 然后给用户存出一个后缀名为 .txt 的二进制文件。
 */
function looksLikeText(bytes: Uint8Array): string | null {
  let text: string
  try {
    text = bytesToTextStrict(bytes)
  } catch {
    return null
  }

  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d
    if ((code < 0x20 && !isAllowedWhitespace) || code === 0x7f || code === 0xfffd) return null
  }
  return text
}

/**
 * 找出第一个非法字符的位置 —— 错误信息要能定位到具体下标，
 * 否则用户面对一屏百分号只能干瞪眼
 */
function invalidCharDetail(clean: string): string | null {
  const eq = clean.indexOf('=')
  const head = eq === -1 ? clean : clean.slice(0, eq)
  const tail = eq === -1 ? '' : clean.slice(eq)

  if (!/^[A-Za-z0-9+/_-]*$/.test(head)) {
    const bad = Array.from(head).find((ch) => !/[A-Za-z0-9+/_-]/.test(ch)) ?? '?'
    return `unexpected character ${JSON.stringify(bad)} — not a Base64 character`
  }
  if (!/^={0,2}$/.test(tail)) return 'padding "=" may only appear at the end, at most twice'
  return null
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
