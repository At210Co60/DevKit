/**
 * 时间戳转换的纯逻辑层
 *
 * 三个关键点：
 * 1. 位数识别：≤10 位按秒、≥13 位按毫秒，11/12 位按量级兜底
 * 2. 指定时区 ↔ 纪元毫秒：不引第三方库，用 Intl.DateTimeFormat 反解偏移量
 * 3. 相对时间：自己算，不引依赖
 *
 * 所有函数都允许传入 `now`，测试才能拿到确定结果。
 */

export type TimestampUnit = 'seconds' | 'millis'

export type TimestampInputKind = 'timestamp' | 'date'

export type TimestampErrorCode = 'empty' | 'notTimestamp' | 'invalidDate' | 'outOfRange'

export type TimestampParseResult =
  { ok: true; epochMs: number; unit: TimestampUnit; kind: TimestampInputKind } | { ok: false; code: TimestampErrorCode }

export type RelativeUnit = 'justNow' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'

export interface RelativeParts {
  unit: RelativeUnit
  amount: number
  /** true = 已经过去，false = 还没到 */
  past: boolean
}

export interface TimestampView {
  epochMs: number
  epochSeconds: number
  /** YYYY-MM-DD HH:mm:ss */
  dateTime: string
  /** UTC 的 ISO 8601 */
  iso: string
  /** 星期几，按所选时区 */
  weekday: string
  relative: RelativeParts
  timeZone: string
}

export const TIME_ZONE_IDS = ['local', 'UTC', 'Asia/Shanghai', 'America/New_York'] as const

export type TimeZoneId = (typeof TIME_ZONE_IDS)[number]

/** 加载示例：2024-05-20 13:45:30 +08:00 的秒级时间戳 */
export const TIMESTAMP_SAMPLE = '1716183930'

/** Date 能表示的最大范围（±100,000,000 天） */
const MAX_EPOCH_MS = 8.64e15

/* ══════════════ 时区 ══════════════ */

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** 'local' 或非法时区一律退回系统时区，绝不因为一个下拉项抛错 */
export function resolveTimeZone(id: string): string {
  if (!id || id === 'local') return localZone()
  try {
    // resolvedOptions 会回传规范化后的时区名，同时完成合法性校验
    return new Intl.DateTimeFormat('en-US', { timeZone: id }).resolvedOptions().timeZone || localZone()
  } catch {
    return localZone()
  }
}

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  formatterCache.set(timeZone, created)
  return created
}

interface ZoneParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zoneParts(utcMs: number, timeZone: string): ZoneParts {
  const parts = zoneFormatter(timeZone).formatToParts(new Date(utcMs))
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type)
    return found ? Number.parseInt(found.value, 10) : 0
  }
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/** 某时刻在该时区的 UTC 偏移（毫秒），正数表示时区在 UTC 以东 */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = zoneParts(utcMs, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const base = utcMs - (utcMs % 1000)
  return asUtc - base
}

/**
 * 把「某时区的墙上时间」换成纪元毫秒
 *
 * 标准两步法：先按 UTC 猜一次偏移，用修正后的时刻再算一次偏移。
 * 两次一致说明不在夏令时切换点，否则采用第二次的结果。
 */
export function zonedTimeToEpoch(parts: ZoneParts, timeZone: string): number {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const firstOffset = zoneOffsetMs(guess, timeZone)
  const candidate = guess - firstOffset
  const secondOffset = zoneOffsetMs(candidate, timeZone)
  return secondOffset === firstOffset ? candidate : guess - secondOffset
}

/** 取某时刻在指定时区下的年月日时分秒 */
export function getZonedParts(utcMs: number, timeZone: string): ZoneParts {
  return zoneParts(utcMs, resolveTimeZone(timeZone))
}

/* ══════════════ 位数识别与解析 ══════════════ */

/**
 * 按位数猜单位
 *   ≤10 位 → 秒
 *   ≥13 位 → 毫秒
 *   11/12 位 → 按量级兜底（1e11 以内当秒，超过当毫秒）
 */
export function detectUnit(raw: string): TimestampUnit | null {
  const text = raw.trim()
  const digits = text.startsWith('-') ? text.slice(1) : text
  if (!/^\d+$/.test(digits)) return null

  const length = digits.length
  if (length === 0 || length > 19) return null
  if (length <= 10) return 'seconds'
  if (length >= 13) return 'millis'
  return Number(digits) < 1e11 ? 'seconds' : 'millis'
}

const DATE_TEXT_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

/**
 * 解析日期文本（按所选时区解读）。
 * 带显式偏移（Z / ±HH:mm）时直接交给 Date.parse。
 */
export function parseZonedDateTime(text: string, timeZoneId: string): number | null {
  const trimmed = text.trim()

  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const ms = Date.parse(trimmed)
    return Number.isFinite(ms) ? ms : null
  }

  const matched = DATE_TEXT_RE.exec(trimmed)
  if (!matched) return null

  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  const hour = matched[4] ? Number(matched[4]) : 0
  const minute = matched[5] ? Number(matched[5]) : 0
  const second = matched[6] ? Number(matched[6]) : 0

  if (!isRealDate(year, month, day)) return null
  if (hour > 23 || minute > 59 || second > 59) return null

  return zonedTimeToEpoch({ year, month, day, hour, minute, second }, resolveTimeZone(timeZoneId))
}

/**
 * 统一入口：时间戳与日期文本共用一个输入框
 * 是数字就按位数当时间戳，否则尝试当日期文本
 */
export function parseTimestampInput(input: string, timeZoneId: string = 'local'): TimestampParseResult {
  const text = input.trim()
  if (!text) return { ok: false, code: 'empty' }

  if (/^-?\d+$/.test(text)) {
    const unit = detectUnit(text)
    if (!unit) return { ok: false, code: 'notTimestamp' }
    const numeric = Number(text)
    const epochMs = unit === 'seconds' ? numeric * 1000 : numeric
    if (!Number.isFinite(epochMs) || Math.abs(epochMs) > MAX_EPOCH_MS) return { ok: false, code: 'outOfRange' }
    return { ok: true, epochMs, unit, kind: 'timestamp' }
  }

  const epochMs = parseZonedDateTime(text, timeZoneId)
  if (epochMs === null) {
    return { ok: false, code: /\d{4}/.test(text) ? 'invalidDate' : 'notTimestamp' }
  }
  return { ok: true, epochMs, unit: 'millis', kind: 'date' }
}

/* ══════════════ 输出视图 ══════════════ */

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** 相对时间，不引依赖，按「秒→分→时→天→月→年」逐级收敛 */
export function formatRelative(targetMs: number, nowMs: number = Date.now()): RelativeParts {
  const diff = nowMs - targetMs
  const past = diff >= 0
  const abs = Math.abs(diff)
  const seconds = Math.floor(abs / 1000)

  if (seconds < 5) return { unit: 'justNow', amount: 0, past }
  if (seconds < 60) return { unit: 'second', amount: seconds, past }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return { unit: 'minute', amount: minutes, past }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hour', amount: hours, past }

  const days = Math.floor(hours / 24)
  if (days < 30) return { unit: 'day', amount: days, past }

  const months = Math.round(days / 30.44)
  if (months < 12) return { unit: 'month', amount: months, past }

  return { unit: 'year', amount: Math.floor(months / 12), past }
}

function weekdayOf(utcMs: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'long' }).format(new Date(utcMs))
  } catch {
    return new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(new Date(utcMs))
  }
}

/** 把纪元毫秒展开成界面需要的全部派生值 */
export function buildTimestampView(
  epochMs: number,
  timeZoneId: string = 'local',
  nowMs: number = Date.now(),
): TimestampView {
  const timeZone = resolveTimeZone(timeZoneId)
  const p = zoneParts(epochMs, timeZone)

  return {
    epochMs,
    epochSeconds: Math.floor(epochMs / 1000),
    dateTime: `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`,
    iso: new Date(epochMs).toISOString(),
    weekday: weekdayOf(epochMs, timeZone),
    relative: formatRelative(epochMs, nowMs),
    timeZone,
  }
}

/** 「当前时间」按钮的填充值 */
export function nowTimestamps(nowMs: number = Date.now()): { seconds: string; millis: string } {
  return { seconds: String(Math.floor(nowMs / 1000)), millis: String(nowMs) }
}
