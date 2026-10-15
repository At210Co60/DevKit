import { base64ToBytes, isBase64, isBase64Url, normalizePadding } from '@/utils/base64'
import { bytesToHex } from '@/utils/bytes'
import { hasUnicodeEscape } from '@/utils/encoding'
import { hasHtmlEntity } from '@/utils/format'

/**
 * 类型自动嗅探 —— 同步纯函数，零 Vue 零 DOM 零副作用
 *
 * 设计原则：
 * 1. **每条判定都必须给出理由**，不搞黑箱。用户要知道「凭什么你说这是 Base64」。
 * 2. **不假装能解**。哈希类命中时必须标 irreversible，UI 负责把解码按钮置灰。
 * 3. **不猜**。识别不了就返回 null，让用户自己选，而不是硬凑一个最像的类型。
 */

export type HashKind = 'md5' | 'sha1' | 'sha256' | 'sha512'

export type SniffedKind =
  | 'jwt'
  | 'openssl'
  | 'rsa'
  | 'base64'
  | 'base64url'
  | HashKind
  | 'hex'
  | 'binary'
  | 'url-encoded'
  | 'unicode-escape'
  | 'html-entity'
  | 'morse'

export interface SniffMatch {
  kind: SniffedKind
  /** 展示名，如 'Base64' */
  label: string
  /** 为什么这么判断 —— 必须是人能读懂的判据 */
  reason: string
  /** 0~1，仅用于排序参考，不代表「一定对」 */
  confidence: number
  /** 单向函数，不可逆：UI 必须置灰解码入口 */
  irreversible: boolean
  /** 真加密，需要密钥 */
  requiresKey: boolean
}

/** 命中哈希的种类（哈希的具体算法），非哈希返回 null */
export type HashLabel = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512'

export const HASH_LENGTHS: readonly { kind: HashKind; label: HashLabel }[] = [
  { kind: 'md5', label: 'MD5' },
  { kind: 'sha1', label: 'SHA-1' },
  { kind: 'sha256', label: 'SHA-256' },
  { kind: 'sha512', label: 'SHA-512' },
]

/* ───────────────────────── 局部判定工具 ───────────────────────── */

const HEX_ONLY_RE = /^[0-9a-fA-F]+$/
const BASE64_SHAPE_RE = /^[A-Za-z0-9+/]+={0,2}$/
const PERCENT_RE = /%[0-9a-fA-F]{2}/
const OPENSSL_MAGIC_HEX = '53616c7465645f5f' // "Salted__"
const MORSE_SHAPE_RE = /^[.\-/ \t]+$/

function compact(input: string): string {
  return input.replace(/\s/g, '')
}

function isPrintableText(text: string): boolean {
  let bad = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    const ok = cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp !== 0x7f)
    if (!ok) bad += 1
  }
  return text.length > 0 && bad / text.length < 0.05
}

/** 解一段 Base64/Base64URL 片段为对象；解不出对象返回 null */
function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const normalized = normalizePadding(segment.replace(/-/g, '+').replace(/_/g, '/'))
    const text = new TextDecoder('utf-8').decode(base64ToBytes(normalized))
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Base64 的「软」判定
 *
 * utils/base64.ts 的 isBase64 为了压制误判，要求含大写或数字或长度 ≥ 24，
 * 会漏掉 `aW5kZXguY29t` 这类纯小写短串。所以这里补一条：能解出可读文本就算。
 */
function looksLikeReadableBase64(input: string): boolean {
  const body = compact(input)
  if (body.length < 4 || body.length % 4 !== 0) return false
  if (!BASE64_SHAPE_RE.test(body)) return false
  try {
    const text = new TextDecoder('utf-8').decode(base64ToBytes(normalizePadding(body)))
    return isPrintableText(text)
  } catch {
    return false
  }
}

/* ───────────────────────── JWT ───────────────────────── */

export interface JwtParts {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
}

/**
 * JWT 判定：三段 Base64URL 用 '.' 分隔，且第一段能解出含 `alg` 的 JSON
 *
 * `alg` 是 JOSE 头的必备字段，加上它可以排除掉「三段随机 base64」这种常见误判。
 * 注意：签名不做校验 —— 那需要公钥，这里只负责「认出它是个 JWT」。
 */
export function detectJwt(input: string): JwtParts | null {
  const parts = input.trim().split('.')
  if (parts.length !== 3) return null
  if (parts.some((p) => p.length === 0)) return null
  const header = decodeJsonSegment(parts[0])
  if (!header || !('alg' in header)) return null
  return { header, payload: decodeJsonSegment(parts[1]) ?? {}, signature: parts[2] }
}

/* ───────────────────────── 哈希 ───────────────────────── */

/** 固定长度十六进制 → 哈希种类；不是哈希返回 null */
export function detectHash(input: string): HashKind | null {
  const body = compact(input)
  if (body.length === 0 || body.length % 2 !== 0) return null
  if (!HEX_ONLY_RE.test(body)) return null
  const hit = HASH_LENGTHS.find((h) => HASH_BITS[h.kind] / 4 === body.length)
  return hit ? hit.kind : null
}

const HASH_BITS: Readonly<Record<HashKind, number>> = {
  md5: 128,
  sha1: 160,
  sha256: 256,
  sha512: 512,
}

export function hashLabelOf(kind: HashKind): HashLabel {
  return HASH_LENGTHS.find((h) => h.kind === kind)!.label
}

/* ───────────────────────── 其他单点判定 ───────────────────────── */

/** Base64 解出来以 `Salted__` 开头 —— OpenSSL 的加密信封 */
export function isOpenSslPayload(input: string): boolean {
  try {
    const bytes = base64ToBytes(normalizePadding(compact(input)))
    if (bytes.length < 8) return false
    return bytesToHex(bytes.subarray(0, 8)) === OPENSSL_MAGIC_HEX
  } catch {
    return false
  }
}

/**
 * Morse 码判定：只由 `.` `-` `/` 和空白组成，且点、划都出现
 *
 * 要求「点和划都出现」是为了排除 `--- ---`（分隔线）、
 * `----`（YAML 文档分隔）这类假阳性。
 */
export function looksLikeMorse(input: string): boolean {
  const body = input.trim()
  if (body.length < 4 || body.length > 2048) return false
  if (!MORSE_SHAPE_RE.test(body)) return false
  if (!body.includes('.') || !body.includes('-')) return false
  const tokens = body.split(/[ \t/]+/).filter(Boolean)
  return tokens.length >= 2 && tokens.every((t) => t.length >= 1 && t.length <= 8)
}

/* ───────────────────────── 主判定 ───────────────────────── */

/**
 * 列出所有候选类型，按优先级排序
 *
 * ⚠️ 优先级说明（与需求清单的细微差异，故意为之）：
 * 十六进制的字符集是 Base64 字符集的**子集**，也就是说「任何十六进制串都是合法的 Base64」。
 * 如果严格按 Base64 优先的顺序走，哈希分支永远走不到。
 * 因此 Hex 家族排在 Base64 家族之前；Base64 家族内部再按 OpenSSL → RSA → 普通 Base64 细化。
 * 带 `=` / `+` / `/` 的串不是十六进制，会自然落到 Base64 分支，不受影响。
 */
export function sniffAll(input: string): SniffMatch[] {
  const raw = input.trim()
  if (!raw) return []

  const body = compact(raw)
  const matches: SniffMatch[] = []

  // ① JWT —— 三段 Base64URL + header 含 alg
  const jwt = detectJwt(raw)
  if (jwt) {
    const alg = typeof jwt.header.alg === 'string' ? jwt.header.alg : String(jwt.header.alg)
    matches.push({
      kind: 'jwt',
      label: 'JWT',
      reason: `三段 Base64URL 以 "." 分隔，header 解出 JSON 且含 alg=${alg}`,
      confidence: 0.98,
      irreversible: false,
      requiresKey: false,
    })
  }

  // ② 纯 0/1 且 8 的倍数 —— 是二进制，不是十六进制
  //    「只由 0 和 1 组成」比「偶数长度的十六进制」更像二进制的证据强得多
  const looksBinary = body.length > 0 && body.length % 8 === 0 && /^[01]+$/.test(body)

  // ③ Hex 家族（含哈希细化）
  const hexMatched = !looksBinary && body.length % 2 === 0 && HEX_ONLY_RE.test(body)
  if (hexMatched) {
    const hash = detectHash(body)
    if (hash) {
      const label = hashLabelOf(hash)
      matches.push({
        kind: hash,
        label,
        reason: `${body.length} 个十六进制字符，等于 ${label} 摘要的固定长度`,
        confidence: 0.9,
        irreversible: true,
        requiresKey: false,
      })
    } else {
      matches.push({
        kind: 'hex',
        label: 'Hex',
        reason: '只含十六进制字符，且长度为偶数',
        confidence: 0.8,
        irreversible: false,
        requiresKey: false,
      })
    }
  }

  // ④ Base64 家族（含 OpenSSL / RSA 细化）
  //    已经被 Hex / Binary 认领的串不再重复报一次 Base64：任何十六进制串语法上都是合法 Base64，
  //    纯 0/1 的串同理。两个都列出来只会让用户以为「这串东西有歧义」，
  //    其实只是同一串字母表的两种写法。
  if (hexMatched || looksBinary) {
    // 已由更具体的类型认领
  } else if (isBase64Url(raw)) {
    matches.push({
      kind: 'base64url',
      label: 'Base64URL',
      reason: '含 Base64URL 专属字符 "-" 或 "_"',
      confidence: 0.9,
      irreversible: false,
      requiresKey: false,
    })
  } else if (isBase64(raw) || looksLikeReadableBase64(raw)) {
    if (isOpenSslPayload(body)) {
      matches.push({
        kind: 'openssl',
        label: 'OpenSSL 加密',
        reason: 'Base64 解出的字节以 "Salted__" 开头，这是 OpenSSL 的加密信封',
        confidence: 0.97,
        irreversible: false,
        requiresKey: true,
      })
    } else if (body.length >= 256) {
      matches.push({
        kind: 'rsa',
        label: 'RSA 密文',
        reason: 'Base64 且长度 ≥ 256 字符，与 RSA 密文尺寸相符（仅是线索，需密钥确认）',
        confidence: 0.55,
        irreversible: false,
        requiresKey: true,
      })
    } else {
      matches.push({
        kind: 'base64',
        label: 'Base64',
        reason: '含 "=" 填充或长度为 4 的倍数，且字符集符合 Base64',
        confidence: 0.85,
        irreversible: false,
        requiresKey: false,
      })
    }
  }

  // ⑤ Binary
  if (looksBinary) {
    matches.push({
      kind: 'binary',
      label: 'Binary',
      reason: '只含 0/1，且长度是 8 的倍数',
      confidence: 0.9,
      irreversible: false,
      requiresKey: false,
    })
  }

  // ⑤ URL 编码
  if (PERCENT_RE.test(raw)) {
    matches.push({
      kind: 'url-encoded',
      label: 'URL 编码',
      reason: '含 %XX 形式的百分号转义',
      confidence: 0.9,
      irreversible: false,
      requiresKey: false,
    })
  }

  // ⑥ Unicode 转义
  if (hasUnicodeEscape(raw)) {
    matches.push({
      kind: 'unicode-escape',
      label: 'Unicode 转义',
      reason: '含 \\uXXXX 或 \\u{...} 形式的转义序列',
      confidence: 0.92,
      irreversible: false,
      requiresKey: false,
    })
  }

  // ⑦ HTML 实体
  if (hasHtmlEntity(raw)) {
    matches.push({
      kind: 'html-entity',
      label: 'HTML 实体',
      reason: '含 &name; 或 &#123; 形式的实体',
      confidence: 0.85,
      irreversible: false,
      requiresKey: false,
    })
  }

  // ⑧ Morse
  if (looksLikeMorse(raw)) {
    matches.push({
      kind: 'morse',
      label: 'Morse 码',
      reason: '只由 . - / 与空白组成，且点、划同时出现',
      confidence: 0.8,
      irreversible: false,
      requiresKey: false,
    })
  }

  return matches
}

/** 只取优先级最高的那个判定结果；一个都不匹配时返回 null */
export function sniff(input: string): SniffMatch | null {
  return sniffAll(input)[0] ?? null
}
