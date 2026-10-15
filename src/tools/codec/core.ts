import { base64ToBytes, bytesToBase64, normalizePadding } from '@/utils/base64'
import {
  binaryToBytes,
  bytesToBinary,
  bytesToHex,
  bytesToOctal,
  bytesToTextStrict,
  hexToBytes,
  octalToBytes,
  textToBytes,
} from '@/utils/bytes'
import { detectEncoding, decodeBytes, isSupportedEncoding, type SupportedEncoding } from '@/utils/charset'
import { codePointsToText, decodeUnicodeEscape, encodeUnicodeEscape, textToCodePoints } from '@/utils/encoding'
import { decodeHtmlEntities, encodeHtmlEntities } from '@/utils/format'

/**
 * 无需密钥的编解码 —— 同步纯函数，零 Vue 零 DOM 零副作用
 *
 * 这一层里没有任何「破解」，只有「还原」：
 * Base64 / Hex / URL / Morse / Unicode / HTML 实体都是可逆的编码，不是加密。
 * 真正的加密在 crypto.ts，且必须由用户提供密钥。
 */

export type DecodeKind =
  'base64' | 'base64url' | 'hex' | 'binary' | 'octal' | 'url' | 'unicode-escape' | 'codepoint' | 'html-entity' | 'morse'

export type EncodeKind = DecodeKind

export const DECODE_KINDS: readonly DecodeKind[] = [
  'base64',
  'base64url',
  'hex',
  'binary',
  'octal',
  'url',
  'unicode-escape',
  'codepoint',
  'html-entity',
  'morse',
]

export const DECODE_KIND_LABELS: Readonly<Record<DecodeKind, string>> = {
  base64: 'Base64',
  base64url: 'Base64URL',
  hex: 'Hex',
  binary: 'Binary',
  octal: 'Octal',
  url: 'URL 编码',
  'unicode-escape': 'Unicode 转义',
  codepoint: '码位',
  'html-entity': 'HTML 实体',
  morse: 'Morse 码',
}

/** 多层解码的层数上限 —— 再往下解就成天书与噪声了 */
export const MAX_DECODE_DEPTH = 5

/** 自动递归时尝试的顺序。刻意不含 octal / codepoint：这两种几乎处处误判，只能手动点名 */
export const AUTO_CHAIN: readonly DecodeKind[] = [
  'base64',
  'base64url',
  'hex',
  'binary',
  'url',
  'unicode-escape',
  'html-entity',
  'morse',
]

export type DecodeResult = { ok: true; value: string; note?: string } | { ok: false; error: string }

/* ══════════════════ 通用辅助 ══════════════════ */

/** 解出来的字节是否是「像样的文本」——自动递归的防垃圾闸门 */
export function isPlausibleText(text: string): boolean {
  if (!text) return false
  let bad = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    const ok = cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp !== 0x7f)
    if (!ok) bad += 1
  }
  return bad / text.length < 0.05
}

function hasNonAscii(text: string): boolean {
  for (const ch of text) {
    if (ch.codePointAt(0)! > 0x7f) return true
  }
  return false
}

function hasCjk(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if ((cp >= 0x3000 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xffef)) return true
  }
  return false
}

/**
 * 传统单字节/双字节编码解出来的结果，够不够格当「结果」给人看
 *
 * 单字节编码（windows-1252、latin1）几乎能吃下任意字节，
 * 不加这道闸门，`6869` 会被 Base64 解成 `ëÎ½` 并被当成正确答案递出去 ——
 * 而正确答案其实是再解一层 Hex 得来的 `hi`。
 *
 * 判据：要么全是 ASCII，要么含中日韩字符
 * （后者正是 charset 层存在的意义：修中文乱码）。
 */
function isMeaningfulLegacyText(text: string): boolean {
  if (!text || text.includes('\uFFFD')) return false
  if (hasCjk(text)) return true
  return !hasNonAscii(text)
}

/**
 * 字节 → 文本
 *
 * 优先严格 UTF-8；不合法就退到 charset 探测；连可读文本都算不上，就**老实给十六进制**。
 * 最后这一条很关键：宁可给你一串 hex，也不把乱码当结果递过去。
 */
function bytesToDisplay(bytes: Uint8Array): { text: string; note?: string } {
  try {
    return { text: bytesToTextStrict(bytes) }
  } catch {
    const encoding = detectEncoding(bytes)
    if (isSupportedEncoding(encoding)) {
      const text = decodeBytes(bytes, encoding)
      if (isMeaningfulLegacyText(text)) {
        return { text, note: `字节不是合法 UTF-8，按 ${encoding} 解读` }
      }
    }
    return {
      text: bytesToHex(bytes, ' '),
      note: '字节不是合法 UTF-8，也读不出可读文本，下面按十六进制展示',
    }
  }
}

function ok(value: string, note?: string): DecodeResult {
  return note ? { ok: true, value, note } : { ok: true, value }
}

function fail(error: string): DecodeResult {
  return { ok: false, error }
}

function bytesToResult(bytes: Uint8Array): DecodeResult {
  const display = bytesToDisplay(bytes)
  return ok(display.text, display.note)
}

/* ══════════════════ Morse ══════════════════ */

/** ITU 摩尔斯电码表（含常用标点） */
export const MORSE_TABLE: Readonly<Record<string, string>> = {
  '.-': 'A',
  '-...': 'B',
  '-.-.': 'C',
  '-..': 'D',
  '.': 'E',
  '..-.': 'F',
  '--.': 'G',
  '....': 'H',
  '..': 'I',
  '.---': 'J',
  '-.-': 'K',
  '.-..': 'L',
  '--': 'M',
  '-.': 'N',
  '---': 'O',
  '.--.': 'P',
  '--.-': 'Q',
  '.-.': 'R',
  '...': 'S',
  '-': 'T',
  '..-': 'U',
  '...-': 'V',
  '.--': 'W',
  '-..-': 'X',
  '-.--': 'Y',
  '--..': 'Z',
  '-----': '0',
  '.----': '1',
  '..---': '2',
  '...--': '3',
  '....-': '4',
  '.....': '5',
  '-....': '6',
  '--...': '7',
  '---..': '8',
  '----.': '9',
  '.-.-.-': '.',
  '--..--': ',',
  '..--..': '?',
  '.----.': "'",
  '-.-.--': '!',
  '-..-.': '/',
  '-.--.': '(',
  '-.--.-': ')',
  '.-...': '&',
  '---...': ':',
  '-.-.-.': ';',
  '-...-': '=',
  '.-.-.': '+',
  '-....-': '-',
  '..--.-': '_',
  '.-..-.': '"',
  '...-..-': '$',
  '.--.-.': '@',
}

/**
 * 词分隔符是**两侧带空格的** `/`（如 `.... . / .-.. .-..`），
 * 而 `.-.-.-` 这种字母内部的 `/` 不带空格，不能被误切。
 */
const MORSE_WORD_SEP_RE = /(?:\s+\/\s*|\s*\/\s+)/

function morseWords(input: string): string[][] {
  return input
    .trim()
    .split(MORSE_WORD_SEP_RE)
    .map((segment) => segment.split(/\s+/).filter(Boolean))
    .filter((tokens) => tokens.length > 0)
}

/**
 * Morse → 文本，无法识别的符号落成 `?`，不静默丢弃
 *
 * 宽松版，给「我确定这就是 Morse」的场景用（decodeAs 走的是严格版，见下）。
 */
export function decodeMorse(input: string): string {
  return morseWords(input)
    .map((tokens) => tokens.map((token) => MORSE_TABLE[token] ?? '?').join(''))
    .join(' ')
}

/** 文本 → Morse，无法编码的字符跳过 */
export function encodeMorse(text: string): string {
  const reverse = new Map<string, string>()
  for (const [code, letter] of Object.entries(MORSE_TABLE)) reverse.set(letter, code)
  return Array.from(text.toUpperCase())
    .map((ch) => reverse.get(ch) ?? '')
    .filter(Boolean)
    .join(' ')
}

/**
 * 严格版：只要有一个符号不认识就整体失败
 *
 * 为什么必须严格：`decodeAs` 会被自动递归拿去做每一层的候选，
 * 而任何一段文本按空白切出来都是「合法 token」—— 不校验的话，
 * 一句普通中文会被 Morse 解码器吃掉，输出一串 `?`。
 * 宁可判定「这不是 Morse」，也不要把噪声当结果。
 */
function decodeMorseStrict(input: string): DecodeResult {
  const tokens = morseWords(input).flat()
  if (tokens.length === 0) return fail('没有可识别的 Morse 符号')
  const unknown = tokens.filter((token) => !(token in MORSE_TABLE))
  if (unknown.length > 0) {
    const shown = unknown
      .slice(0, 3)
      .map((token) => `"${token}"`)
      .join(' ')
    return fail(`不是 Morse 码：不认识的符号 ${shown}`)
  }
  return ok(decodeMorse(input))
}

/* ══════════════════ 解码 ══════════════════ */

/** 按指定方式解码一步。charset 路径请用 `reDecodeAsCharset`（它需要知道字节从哪来） */
export function decodeAs(kind: DecodeKind, input: string): DecodeResult {
  const source = input.trim()
  if (!source) return fail('输入为空')

  try {
    switch (kind) {
      case 'base64':
        return bytesToResult(base64ToBytes(normalizePadding(source)))
      case 'base64url':
        return bytesToResult(base64ToBytes(normalizePadding(source.replace(/-/g, '+').replace(/_/g, '/'))))
      case 'hex':
        return bytesToResult(hexToBytes(source))
      case 'binary':
        return bytesToResult(binaryToBytes(source))
      case 'octal':
        return bytesToResult(octalToBytes(source))
      case 'url':
        return ok(decodeURIComponent(source.replace(/\+/g, ' ')))
      case 'unicode-escape':
        return ok(decodeUnicodeEscape(source))
      case 'codepoint':
        return ok(codePointsToText(source))
      case 'html-entity':
        return ok(decodeHtmlEntities(source))
      case 'morse':
        return decodeMorseStrict(source)
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : '解码失败')
  }
}

/** 按指定方式编码一步 */
export function encodeAs(kind: EncodeKind, input: string): DecodeResult {
  if (!input) return fail('输入为空')
  try {
    switch (kind) {
      case 'base64':
        return ok(bytesToBase64(textToBytes(input)))
      case 'base64url':
        return ok(bytesToBase64(textToBytes(input)).replace(/\+/g, '-').replace(/\//g, '_'))
      case 'hex':
        return ok(bytesToHex(textToBytes(input)))
      case 'binary':
        return ok(bytesToBinary(textToBytes(input)))
      case 'octal':
        return ok(bytesToOctal(textToBytes(input)))
      case 'url':
        return ok(encodeURIComponent(input))
      case 'unicode-escape':
        return ok(encodeUnicodeEscape(input))
      case 'codepoint':
        return ok(textToCodePoints(input))
      case 'html-entity':
        return ok(encodeHtmlEntities(input))
      case 'morse':
        return ok(encodeMorse(input))
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : '编码失败')
  }
}

/**
 * 字符编码重解读：中文乱码的正解
 *
 * 浏览器只有 decoder 没有 encoder（UTF-8 除外），所以「用 GBK 编码一段中文」做不到。
 * 能做的是：拿到原始字节后，换个编码重新读一遍 —— 这正是这个函数干的事。
 *
 * @param source 字节的来源形式，先按它还原出字节
 */
export function reDecodeAsCharset(
  input: string,
  source: 'base64' | 'base64url' | 'hex' | 'binary',
  encoding: SupportedEncoding,
): DecodeResult {
  const body = input.trim()
  if (!body) return fail('输入为空')
  try {
    let bytes: Uint8Array
    switch (source) {
      case 'base64':
        bytes = base64ToBytes(normalizePadding(body))
        break
      case 'base64url':
        bytes = base64ToBytes(normalizePadding(body.replace(/-/g, '+').replace(/_/g, '/')))
        break
      case 'hex':
        bytes = hexToBytes(body)
        break
      case 'binary':
        bytes = binaryToBytes(body)
        break
    }
    if (!isSupportedEncoding(encoding)) return fail(`当前浏览器不支持编码 ${encoding}`)
    const text = decodeBytes(bytes, encoding)
    if (text.includes('\uFFFD')) return ok(text, `按 ${encoding} 解码，仍有字节无法对应到字符`)
    return ok(text, `按 ${encoding} 解读原始字节`)
  } catch (err) {
    return fail(err instanceof Error ? err.message : '解码失败')
  }
}

/* ══════════════════ 多层递归解码 ══════════════════ */

export type StopReason = 'none' | 'depth' | 'cycle' | 'stuck' | 'unknown'

export interface DecodeStep {
  depth: number
  kind: DecodeKind
  value: string
  note?: string
}

export interface AutoDecodeResult {
  steps: DecodeStep[]
  final: string
  /** depth = 撞上层数上限；cycle = 出现重复值；stuck = 解不动了；unknown = 一开始就不认识 */
  stoppedBy: StopReason
}

/**
 * 循环保护
 *
 * 自动递归解码最怕的是「解着解着绕回原点」或者「无限套娃」。
 * 这里把两件事合成一个可测的闸门：
 * 1. 层数上限 —— 超过就停
 * 2. 重复检测 —— 同一个值出现过就不再往下走
 *
 * 单独抽成类是为了能直接测它，而不是只能靠构造极端输入去间接验证。
 */
export class DecodeLoopGuard {
  private readonly seen = new Set<string>()
  readonly maxDepth: number

  constructor(maxDepth: number = MAX_DECODE_DEPTH) {
    this.maxDepth = maxDepth
  }

  /** @returns true = 允许继续；false = 超层数或撞上重复值 */
  admit(value: string, depth: number): boolean {
    if (depth > this.maxDepth) return false
    if (this.seen.has(value)) return false
    this.seen.add(value)
    return true
  }

  get visited(): string[] {
    return [...this.seen]
  }
}

/**
 * 自动多层解码
 *
 * 每一层都必须满足三个条件才被采纳：
 * 1. 解码器认可（不抛错）
 * 2. 结果确实是「像样的文本」（`isPlausibleText`）—— 挡住 hex 解出来的天书
 * 3. 结果严格变短 —— 编码只会增加体积，不变短的一律不信
 *
 * 外加 `DecodeLoopGuard` 兜住层数与重复。
 */
export function autoDecode(
  input: string,
  options: { maxDepth?: number; chain?: readonly DecodeKind[] } = {},
): AutoDecodeResult {
  const maxDepth = options.maxDepth ?? MAX_DECODE_DEPTH
  const chain = options.chain ?? AUTO_CHAIN
  const guard = new DecodeLoopGuard(maxDepth)

  let current = input.trim()
  const steps: DecodeStep[] = []
  if (!current) return { steps, final: current, stoppedBy: 'unknown' }

  guard.admit(current, 0)

  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = pickNextDecode(current, chain)
    if (!next) return { steps, final: current, stoppedBy: steps.length > 0 ? 'stuck' : 'unknown' }
    if (!guard.admit(next.value, depth)) return { steps, final: current, stoppedBy: 'cycle' }

    steps.push({ depth, kind: next.kind, value: next.value, note: next.note })
    current = next.value
    if (depth === maxDepth) return { steps, final: current, stoppedBy: 'depth' }
  }

  return { steps, final: current, stoppedBy: 'none' }
}

function pickNextDecode(input: string, chain: readonly DecodeKind[]): DecodeStep | null {
  for (const kind of chain) {
    const result = decodeAs(kind, input)
    if (!result.ok) continue
    const value = result.value
    if (!value || value === input) continue
    if (value.length >= input.length) continue
    if (!isPlausibleText(value)) continue
    return { depth: 0, kind, value, note: result.note }
  }
  return null
}

/** 供 UI 做「这一串到底能不能按这种方式解」的前置校验 */
export function canDecodeAs(kind: DecodeKind, input: string): boolean {
  return decodeAs(kind, input).ok
}
