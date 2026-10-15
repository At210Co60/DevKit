/**
 * URL 编解码的纯逻辑层
 *
 * 三条硬约定：
 * 1. 零 Vue、零 DOM、零副作用
 * 2. 浏览器原生 URL / URLSearchParams 直接用，不引第三方
 * 3. 出错返回结构化结果，不抛未捕获异常
 *
 * 一个关键取舍：**分层编解码不能走 new URL()**。
 * URL 构造函数会自动把空格、中文都规范化成 %XX，用户想看「只编码查询串」的效果时，
 * 原始输入早就被改掉了。所以分层处理走自己 splitLayers 的原始切分，
 * 而「结构拆解面板」才用 URL 构造函数（它需要的是规范化后的 punycode / 端口这些信息）。
 *
 * 文案不在这一层：错误只给 code 与技术性 detail，中文提示由 use 层映射到 @/content 的 quips。
 */

/* ══════════════ 类型 ══════════════ */

export type UrlMode = 'encode' | 'decode'

export type UrlErrorCode = 'empty' | 'invalidPercent' | 'invalidUrl'

export interface UrlSuccess<T> {
  ok: true
  value: T
}

export interface UrlFailure {
  ok: false
  code: UrlErrorCode
  detail: string
}

export type UrlResult<T> = UrlSuccess<T> | UrlFailure

/** 三个层级开关：只对勾选的层做百分号转义。全不勾 = 整串当纯文本处理 */
export interface EncodeTargets {
  pathname: boolean
  search: boolean
  hash: boolean
}

/** 原始切分结果，各层保持用户输入的样子（未经 URL 规范化） */
export interface UrlLayers {
  authority: string
  pathname: string
  search: string
  hash: string
}

/** 结构拆解结果，来自 URL 构造函数（已规范化：IDN 转 punycode、空格转 %20） */
export interface UrlParts {
  protocol: string
  host: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
  origin: string
  href: string
  /** 输入没带协议、是我们补了 https:// 才解析成功的 */
  inferredProtocol: boolean
}

export interface QueryRow {
  key: string
  value: string
}

/** Query 编辑器往回拼 URL 用的草稿 */
export interface UrlDraft {
  protocol: string
  host: string
  pathname: string
  rows: QueryRow[]
  hash: string
}

export interface EncodingDetection {
  /** 解码后是否明显更像原文 */
  encoded: boolean
  /** 0~1，越大越可信 */
  confidence: number
  decoded: string
  /** 含有非法百分号转义，解不动 */
  failed: boolean
}

/* ══════════════ 分层切分 ══════════════ */

const LAYER_RE = /^([a-zA-Z][\w+.-]*:\/\/[^/?#]*)?([^?#]*)(\?[^#]*)?(#[\s\S]*)?$/

/** 允许补协议的前提：首段不含空格与 '='，看着像个主机名 */
const HOSTLIKE_RE = /^[^\s=/?#]+(?:[/?#][\s\S]*)?$/

/** 把 URL 切成 协议+主机 / 路径 / 查询串 / 片段，不做任何规范化 */
export function splitLayers(input: string): UrlResult<UrlLayers> {
  const trimmed = input.trim()
  if (!trimmed) return fail('empty', 'input is empty')

  const matched = LAYER_RE.exec(trimmed)
  if (!matched) return fail('invalidUrl', 'cannot be split into authority / path / query / hash')

  return ok({
    authority: matched[1] ?? '',
    pathname: matched[2] ?? '',
    search: matched[3] ?? '',
    hash: matched[4] ?? '',
  })
}

export function joinLayers(layers: UrlLayers): string {
  return `${layers.authority}${layers.pathname}${layers.search}${layers.hash}`
}

export function hasTargets(targets: EncodeTargets): boolean {
  return targets.pathname || targets.search || targets.hash
}

/* ══════════════ 转义原语 ══════════════ */

/**
 * 转义但不做双重编码：已经是合法 %XX 的保持原样。
 * 用户把一段「一半编码」的 URL 贴进来时，这是最不意外的行为。
 */
export function encodeOnce(text: string): string {
  return encodeURIComponent(text).replace(/%25([0-9A-Fa-f]{2})/g, '%$1')
}

/** 路径：转义，但 / 是分隔符，必须留着 */
export function escapePath(pathname: string): string {
  return encodeOnce(pathname).replace(/%2F/gi, '/')
}

/** 查询串（含前导 ?）：转义键值，但保留 ? & = 的结构含义 */
export function escapeSearch(search: string): string {
  if (!search) return ''
  const lead = search.startsWith('?') ? '?' : ''
  const body = lead ? search.slice(1) : search
  return lead + body.split('&').map(escapePair).join('&')
}

/** 片段（含前导 #）：转义，但 = 要留 —— 锚点里经常是键值对 */
export function escapeHash(hash: string): string {
  if (!hash) return ''
  const lead = hash.startsWith('#') ? '#' : ''
  const body = lead ? hash.slice(1) : hash
  return lead + encodeOnce(body).replace(/%3D/gi, '=')
}

/** 只在第一个 = 处切分：值里带 = 时不能被拆开 */
function escapePair(pair: string): string {
  const eq = pair.indexOf('=')
  if (eq === -1) return encodeOnce(pair)
  return `${encodeOnce(pair.slice(0, eq))}=${encodeOnce(pair.slice(eq + 1))}`
}

/* ══════════════ 编解码入口 ══════════════ */

/**
 * 编码。
 * 一个层级开关都没勾 → 整串按纯文本做 encodeURIComponent（用户明确要的「文本转义」）；
 * 勾了 → 只转义勾中的层，其余原样保留。
 */
export function encodeInput(input: string, targets: EncodeTargets): UrlResult<string> {
  if (!input.trim()) return fail('empty', 'input is empty')
  if (!hasTargets(targets)) return ok(encodeURIComponent(input))

  const layers = splitLayers(input)
  if (!layers.ok) return layers

  return ok(
    joinLayers({
      authority: layers.value.authority,
      pathname: targets.pathname ? escapePath(layers.value.pathname) : layers.value.pathname,
      search: targets.search ? escapeSearch(layers.value.search) : layers.value.search,
      hash: targets.hash ? escapeHash(layers.value.hash) : layers.value.hash,
    }),
  )
}

/** 解码，规则与 encodeInput 对称 */
export function decodeInput(input: string, targets: EncodeTargets): UrlResult<string> {
  if (!input.trim()) return fail('empty', 'input is empty')
  if (!hasTargets(targets)) return decodeOnce(input)

  const layers = splitLayers(input)
  if (!layers.ok) return layers

  const pathname = targets.pathname ? decodeOnce(layers.value.pathname) : ok(layers.value.pathname)
  if (!pathname.ok) return pathname

  const search = targets.search ? unescapeSearch(layers.value.search) : ok(layers.value.search)
  if (!search.ok) return search

  const hash = targets.hash ? decodeOnce(layers.value.hash) : ok(layers.value.hash)
  if (!hash.ok) return hash

  return ok(
    joinLayers({
      authority: layers.value.authority,
      pathname: pathname.value,
      search: search.value,
      hash: hash.value,
    }),
  )
}

/** 百分号解码，失败时指出坏在哪 */
function decodeOnce(text: string): UrlResult<string> {
  try {
    return ok(decodeURIComponent(text))
  } catch (error) {
    return fail('invalidPercent', describeEscapeError(error, text))
  }
}

/**
 * 逐键值解码查询串。
 * 刻意不用 URLSearchParams：它把 + 当空格，那是表单编码的规则，不是百分号解码的规则。
 * 也要逐对解码：整串解一次的话，值里的 %26 会变成真的 &，把一对键值劈成两对。
 */
function unescapeSearch(search: string): UrlResult<string> {
  if (!search) return ok('')
  const lead = search.startsWith('?') ? '?' : ''
  const body = lead ? search.slice(1) : search

  const decoded: string[] = []
  for (const pair of body.split('&')) {
    const eq = pair.indexOf('=')
    if (eq === -1) {
      const key = decodeOnce(pair)
      if (!key.ok) return key
      decoded.push(key.value)
      continue
    }
    const key = decodeOnce(pair.slice(0, eq))
    if (!key.ok) return key
    const value = decodeOnce(pair.slice(eq + 1))
    if (!value.ok) return value
    decoded.push(`${key.value}=${value.value}`)
  }
  return ok(lead + decoded.join('&'))
}

function describeEscapeError(error: unknown, text: string): string {
  const bad = text.search(/%(?![0-9A-Fa-f]{2})/)
  if (bad >= 0) return `invalid percent escape at index ${bad}: ${JSON.stringify(text.slice(bad, bad + 3))}`
  return error instanceof Error ? error.message : String(error)
}

/* ══════════════ 结构拆解 ══════════════ */

/**
 * 用原生 URL 解析出各层。
 *
 * 用户十有八九只粘 `example.com/a?b=1`，所以缺协议时补一个 https:// 再试。
 * 但补协议只在「真的只是漏写了协议」时才做：输入里已经有 '://' 说明协议本身写坏了，
 * 而裸的 'a=1&b=2' 是查询串不是主机，硬补只会得到一个离谱的 host。
 */
export function parseUrl(input: string): UrlResult<UrlParts> {
  const trimmed = input.trim()
  if (!trimmed) return fail('empty', 'input is empty')

  let inferred = false
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    if (trimmed.includes('://') || !HOSTLIKE_RE.test(trimmed)) {
      return fail('invalidUrl', 'not a valid absolute URL')
    }
    try {
      parsed = new URL(`https://${trimmed}`)
      inferred = true
    } catch {
      return fail('invalidUrl', 'not a valid URL, even after prepending https://')
    }
  }

  return ok({
    protocol: parsed.protocol,
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    origin: parsed.origin,
    href: parsed.href,
    inferredProtocol: inferred,
  })
}

/* ══════════════ Query 参数 ══════════════ */

/** 查询串 → 可编辑的行。重复 key 保留成多行，不做去重 */
export function parseQuery(query: string): QueryRow[] {
  const raw = query.replace(/^[?#]/, '')
  if (!raw) return []

  const rows: QueryRow[] = []
  new URLSearchParams(raw).forEach((value, key) => rows.push({ key, value }))
  return rows
}

/**
 * 行 → 查询串。key 为空的行直接丢掉（用户点了「+」还没填就生成 URL 的话会留下一截 ?&）
 * escape = false 时原样输出，用于「这层我不转义」的开关。
 */
export function buildQuery(rows: readonly QueryRow[], escape = true): string {
  return rows
    .filter((row) => row.key !== '')
    .map((row) => (escape ? `${encodeOnce(row.key)}=${encodeOnce(row.value)}` : `${row.key}=${row.value}`))
    .join('&')
}

/** 草稿 → 完整 URL。生成完必须能被 URL 解析，否则说明草稿里有非法字符 */
export function buildUrl(draft: UrlDraft, targets: EncodeTargets): UrlResult<string> {
  const protocol = draft.protocol || 'https:'
  const host = draft.host.trim()
  const path = targets.pathname ? escapePath(draft.pathname) : draft.pathname
  const query = buildQuery(draft.rows, targets.search)
  const rawHash = draft.hash.replace(/^#/, '')
  // 注意 escapeHash 要连 '#' 一起给，否则拼出来的 URL 会把片段接在查询串后面
  const hash = rawHash ? (targets.hash ? escapeHash(`#${rawHash}`) : `#${rawHash}`) : ''

  const authority = host ? `${protocol.replace(/:?$/, ':')}//${host}` : protocol.replace(/:$/, '')
  const url = `${authority}${path}${query ? `?${query}` : ''}${hash}`

  try {
    new URL(url)
  } catch (error) {
    return fail('invalidUrl', error instanceof Error ? error.message : String(error))
  }
  return ok(url)
}

/* ══════════════ 已编码自动识别 ══════════════ */

/**
 * 判断输入是不是已经编码过的。
 * 判据不是「能不能 decode」（那必然能，只要转义合法），
 * 而是「decode 之后是否明显更像人话」—— 中文与空格回来了才算数。
 */
export function detectEncoding(input: string): EncodingDetection {
  const text = input.trim()
  if (!/%[0-9A-Fa-f]{2}/.test(text)) return { encoded: false, confidence: 0, decoded: text, failed: false }

  let decoded: string
  try {
    decoded = decodeURIComponent(text)
  } catch {
    return { encoded: false, confidence: 0, decoded: text, failed: true }
  }

  const delta = readability(decoded) - readability(text)
  return {
    encoded: delta > 0,
    confidence: Math.min(1, Math.max(0, delta / 2)),
    decoded,
    failed: false,
  }
}

/** 可读性打分：未解码的 % 与控制字符扣分，中文与空格加分 */
function readability(text: string): number {
  if (!text) return 0

  let score = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === '%') score -= 1.5
    else if (code === 0xfffd) score -= 2
    else if (code < 0x20 || code === 0x7f) score -= 2
    else if (code > 0x7f) score += 2
    else score += 1
  }
  return score / text.length
}

/* ══════════════ 内部工具 ══════════════ */

function ok<T>(value: T): UrlSuccess<T> {
  return { ok: true, value }
}

function fail(code: UrlErrorCode, detail: string): UrlFailure {
  return { ok: false, code, detail }
}
