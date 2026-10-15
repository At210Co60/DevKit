/**
 * Cron 表达式核心逻辑 —— 第 1 层：纯函数
 *
 * 约定：
 * 1. 零 Vue、零 DOM、零副作用，相同入参必得相同出参（now 除外，它由调用方显式传入）
 * 2. 依赖锁定 cron-parser@4.9.x（ARCHITECTURE.md §5.3），升级只动这一个文件
 * 3. 不产出任何玩梗文案：对外只返回结构化数据，文案由 content 层拼
 */

import { parseExpression } from 'cron-parser'

/* ══════════════ 字段定义 ══════════════ */

export type CronFieldKey = 'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek'

/** 英文别名表，与 cron-parser 的 aliases 对齐（只认 3 个字母） */
export const MONTH_ALIASES: Readonly<Record<string, number>> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
}

export const WEEKDAY_ALIASES: Readonly<Record<string, number>> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
}

export interface CronFieldSpec {
  readonly key: CronFieldKey
  /** 字段的中文名，错误提示用：「小时字段『25』」 */
  readonly label: string
  /** 中文单位名，用于拼解释文案：「9 到 18 点」 */
  readonly unit: string
  /** 该字段取 * 时的说法 */
  readonly everyLabel: string
  readonly min: number
  readonly max: number
  readonly aliases?: Readonly<Record<string, number>>
  /** 允许 L：日字段 = 每月最后一天，星期字段 = 最后一个周 X */
  readonly allowsLast?: boolean
  /** 允许 #：每月第 N 个周 X */
  readonly allowsNth?: boolean
}

/** 字段顺序即 cron 的书写顺序：秒 分 时 日 月 周 */
export const CRON_FIELDS: readonly CronFieldSpec[] = [
  { key: 'second', label: '秒', unit: '秒', everyLabel: '每秒', min: 0, max: 59 },
  { key: 'minute', label: '分钟', unit: '分钟', everyLabel: '每分钟', min: 0, max: 59 },
  { key: 'hour', label: '小时', unit: '点', everyLabel: '每小时', min: 0, max: 23 },
  { key: 'dayOfMonth', label: '日', unit: '日', everyLabel: '每天', min: 1, max: 31, allowsLast: true },
  { key: 'month', label: '月', unit: '月', everyLabel: '每月', min: 1, max: 12, aliases: MONTH_ALIASES },
  {
    key: 'dayOfWeek',
    label: '星期',
    unit: '星期',
    everyLabel: '每天（不限星期）',
    min: 0,
    max: 7,
    aliases: WEEKDAY_ALIASES,
    allowsLast: true,
    allowsNth: true,
  },
] as const

/** crontab 标准是五段（分 时 日 月 周），秒段属于扩展 */
export const STANDARD_FIELD_COUNT = 5
export const MAX_FIELD_COUNT = 6

/** cron-parser 原生支持的 @ 别名，仅此五个 */
export const CRON_ALIASES: Readonly<Record<string, string>> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
}

export interface CronPreset {
  readonly label: string
  readonly expression: string
  readonly text: string
}

/** 常用模板快捷输入 */
export const CRON_PRESETS: readonly CronPreset[] = [
  { label: '@hourly', expression: '@hourly', text: '每小时整点' },
  { label: '@daily', expression: '@daily', text: '每天 00:00' },
  { label: '@weekly', expression: '@weekly', text: '每周日 00:00' },
  { label: '@monthly', expression: '@monthly', text: '每月 1 日 00:00' },
  { label: '@yearly', expression: '@yearly', text: '每年 1 月 1 日 00:00' },
] as const

export const TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'local', label: '本地时区' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai（UTC+8）' },
] as const

export const CRON_SAMPLE = '0 9 * * 1-5'

/** cron-parser 明确表达不了的部分 —— 诚实告知，不假装全能 */
export const CRON_LIMITATIONS: readonly string[] = [
  '不支持 Quartz 的 1W（每月第一个工作日）与 L-3（每月倒数第 3 天）写法，cron-parser 会直接报错。',
  '@reboot、@every 1h、@annually、@midnight 不是 cron-parser 的别名，别名只有 @hourly / @daily / @weekly / @monthly / @yearly 五个。',
  '日和星期同时指定时按「或」匹配（Unix 语义），不是「且」——这与 Quartz 不同。',
  '不支持 Jenkins 的 H 随机抖动，也不认识节假日日历。',
  '夏令时切换当天不存在的时间点会被顺延到下一个有效时刻，不会报错。',
] as const

export const UPCOMING_COUNT = 5

/* ══════════════ 结果类型 ══════════════ */

export interface CronFieldInfo {
  readonly key: CronFieldKey
  /** 用户写的原始字段 */
  readonly raw: string
  /** 单字段的人类可读解释 */
  readonly text: string
}

export interface CronRun {
  readonly date: Date
  readonly iso: string
  /** 目标时区下的 YYYY-MM-DD HH:mm:ss */
  readonly text: string
  /** 目标时区下的星期，如「周三」 */
  readonly weekday: string
  /** 相对当前时间的距离，如「3 天后」 */
  readonly relative: string
  readonly distanceMs: number
}

export type CronErrorCode = 'empty' | 'field-count' | 'field-value' | 'unsupported' | 'no-run' | 'timezone'

export interface CronParseError {
  readonly code: CronErrorCode
  /** 具体到字段的说明；空字符串表示交由文案层补全 */
  readonly message: string
  /** 出问题的字段序号（0 起），整体性问题为 null */
  readonly fieldIndex: number | null
  readonly fieldKey: CronFieldKey | null
  /** 原始库报错，作为补充信息展示 */
  readonly libraryMessage?: string
}

export type CronWarningCode = 'six-fields' | 'dom-and-dow' | 'question-mark' | 'last-day' | 'nth-weekday'

export interface CronWarning {
  readonly code: CronWarningCode
  readonly fieldIndex: number | null
  readonly text: string
}

export interface CronParseResult {
  readonly ok: boolean
  readonly input: string
  /** 是否是 @ 别名写法 */
  readonly isAlias: boolean
  readonly hasSeconds: boolean
  readonly fields: readonly CronFieldInfo[]
  /** 整体描述，如「每周一至周五 09:00」 */
  readonly summary: string
  readonly runs: readonly CronRun[]
  readonly error: CronParseError | null
  readonly warnings: readonly CronWarning[]
}

export interface CronDescribeOptions {
  readonly now?: Date
  readonly timeZone?: string
  readonly count?: number
}

/* ══════════════ 时间格式化 ══════════════ */

/** 'local' → 本机 IANA 时区名，其余原样 */
export function resolveTimeZone(timeZone: string): string {
  if (!timeZone || timeZone === 'local') return Intl.DateTimeFormat().resolvedOptions().timeZone
  return timeZone
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** 按目标时区格式化 YYYY-MM-DD HH:mm:ss */
export function formatInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`
}

/** 按目标时区取中文星期 */
export function weekdayInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'short' }).format(date)
}

/** 粗粒度相对时间，cron 的下一次运行只会落在未来 */
export function formatRelativeTime(target: Date, now: Date): string {
  const delta = target.getTime() - now.getTime()
  if (delta <= 0) return '就是现在'
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (delta < minute) return '不到 1 分钟'
  if (delta < hour) return `${Math.round(delta / minute)} 分钟后`
  if (delta < day) return `${Math.round(delta / hour)} 小时后`
  if (delta < 30 * day) return `${Math.round(delta / day)} 天后`
  if (delta < 365 * day) return `${Math.round(delta / (30 * day))} 个月后`
  return `${Math.round(delta / (365 * day))} 年后`
}

/* ══════════════ 字段取值工具 ══════════════ */

const WEEKDAY_NAMES: readonly string[] = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 7 与 0 都表示周日 */
export function weekdayName(value: number): string {
  return WEEKDAY_NAMES[((value % 7) + 7) % 7]
}

function specOf(key: CronFieldKey): CronFieldSpec {
  const spec = CRON_FIELDS.find((item) => item.key === key)
  if (!spec) throw new Error(`unknown cron field: ${key}`)
  return spec
}

/** 单个取值 → 数字；别名与大小写不敏感 */
function resolveValue(token: string, spec: CronFieldSpec): number | null {
  if (/^\d+$/.test(token)) {
    const value = Number(token)
    return value >= spec.min && value <= spec.max ? value : null
  }
  const alias = spec.aliases?.[token.toUpperCase()]
  return alias ?? null
}

function isValidValue(token: string, spec: CronFieldSpec): boolean {
  if (/^\d+$/.test(token)) return resolveValue(token, spec) !== null
  if (token.length !== 3) return false
  return spec.aliases?.[token.toUpperCase()] !== undefined
}

/* ══════════════ 字段校验 ══════════════ */

export interface CronFieldIssue {
  readonly fieldIndex: number
  readonly fieldKey: CronFieldKey
  readonly message: string
}

/**
 * 单段校验 —— 在调用 cron-parser 之前先给出「哪个字段哪一处不合法」，
 * 因为库的报错只说「Invalid characters」，不说人话。
 */
export function checkCronAtom(atom: string, spec: CronFieldSpec): string | null {
  if (atom === '') return '这一段是空的'
  // Quartz 的「不指定」，cron-parser 内部按 * 处理
  if (atom === '?' || atom === '*') return null

  const [base, ...steps] = atom.split('/')
  if (steps.length > 1) return `步长写了好几遍（/${steps.join('/')}）`
  if (steps.length === 1) {
    if (!/^\d+$/.test(steps[0])) return `步长 /${steps[0]} 不是数字`
    if (Number(steps[0]) === 0) return '步长不能是 0'
  }

  if (base.includes('#')) {
    if (!spec.allowsNth) return `「${spec.label}」字段不支持 #`
    const [dow, nth] = base.split('#')
    if (!isValidValue(dow, spec)) return `# 前面必须是一个星期值（0-7 或 MON-FRI）`
    if (!nth || !/^[1-5]$/.test(nth)) return '# 后面只能是 1-5（每月第 N 个周 X）'
    return null
  }

  if (base.includes('L')) {
    if (!spec.allowsLast) return `「${spec.label}」字段不支持 L`
    if (base === 'L') return null
    return 'L 只能单独使用，暂不支持 L-3 这类倒数写法'
  }

  // 「*」「?」加步长，或纯列表，这两种底座无需再逐项校验
  if (base === '*' || base === '?') return null

  for (const part of base.split(',')) {
    if (part === '') return '列表里混进了空项'
    const [from, to] = part.split('-')
    if (!isValidValue(from, spec)) {
      return `「${part}」不是合法取值（${spec.min}-${spec.max}）`
    }
    if (to !== undefined) {
      if (!isValidValue(to, spec)) return `「${part}」不是合法取值（${spec.min}-${spec.max}）`
      // 星期允许 5-1 这种跨圈区间，其他字段不允许
      if (spec.key !== 'dayOfWeek') {
        const start = resolveValue(from, spec)
        const end = resolveValue(to, spec)
        if (start !== null && end !== null && start > end) return `区间 ${part} 的起点比终点还大`
      }
    }
  }
  return null
}

/** 逐段校验整条表达式，返回第一处问题 */
export function validateCronFields(atoms: readonly string[]): CronFieldIssue | null {
  const start = MAX_FIELD_COUNT - atoms.length
  for (let i = 0; i < MAX_FIELD_COUNT; i += 1) {
    const spec = CRON_FIELDS[i]
    const atom = i < start ? '0' : atoms[i - start]
    const message = checkCronAtom(atom, spec)
    if (message) {
      return { fieldIndex: i, fieldKey: spec.key, message: `${spec.label}字段「${atom}」：${message}` }
    }
  }
  return null
}

/* ══════════════ 字段解释 ══════════════ */

function describeSinglePart(part: string, spec: CronFieldSpec): string {
  const [from, to] = part.split('-')

  if (spec.key === 'dayOfWeek') {
    const start = resolveValue(from, spec)
    const end = to === undefined ? null : resolveValue(to, spec)
    if (start !== null) {
      if (end === null) return weekdayName(start)
      // 5-1 这类跨圈区间读作「周五到周一」
      if (end <= start) return `${weekdayName(start)}到${weekdayName(end)}`
      return `${weekdayName(start)}至${weekdayName(end)}`
    }
  }

  if (to === undefined) {
    if (spec.key === 'month') return `${resolveValue(part, spec)} 月`
    if (spec.key === 'dayOfMonth') return `${part} 日`
    if (spec.key === 'hour') return `${part} 点`
    return `${part} ${spec.unit}`
  }
  return `${from} 到 ${to} ${spec.unit}`
}

function describeAtom(atom: string, spec: CronFieldSpec): string {
  if (atom === '?') return '不指定（等同 *）'

  const [base, step] = atom.split('/')
  const stepText = step ? `每 ${step} ${spec.unit}` : ''

  if (base.includes('#')) {
    const [dow, nth] = base.split('#')
    const value = resolveValue(dow, spec)
    return `每月第 ${nth} 个${value === null ? dow : weekdayName(value)}`
  }
  if (base === 'L') return spec.key === 'dayOfMonth' ? '每月最后一天' : '最后一个周 X'
  if (base.includes('L')) return `不支持的写法：${base}`

  if (base === '*') {
    if (step) return `每 ${step} ${spec.unit}`
    return spec.everyLabel
  }

  const parts = base.split(',').map((part) => describeSinglePart(part, spec))
  const joined = parts.join('、')
  return step ? `${joined}，${stepText}` : joined
}

/** 单字段解释，如 minute 段为「星号 + 斜杠 15」→ 「每 15 分钟」 */
export function describeCronField(raw: string, key: CronFieldKey): string {
  return describeAtom(raw, specOf(key))
}

/* ══════════════ 整体描述 ══════════════ */

function isAny(atom: string | undefined): boolean {
  return atom === undefined || atom === '*' || atom === '?'
}

/** 「9-18」这种简单区间 → [9, 18]；列表、通配、别名一律返回 null */
function simpleRange(atom: string, key: CronFieldKey): [number, number] | null {
  if (!atom.includes('-') || atom.includes(',')) return null
  const spec = specOf(key)
  const [from, to] = atom.split('-')
  const start = resolveValue(from, spec)
  const end = to === undefined ? null : resolveValue(to, spec)
  return start !== null && end !== null ? [start, end] : null
}

function describeTimeOfDay(minute: string, hour: string): string {
  const spec = specOf('minute')
  const minuteValue = resolveValue(minute, spec)
  const minuteStep = minute.startsWith('*/') ? Number(minute.slice(2)) : null
  const hourValue = resolveValue(hour, specOf('hour'))
  const hourRange = simpleRange(hour, 'hour')

  if (isAny(hour) && isAny(minute)) return '每分钟'

  if (isAny(hour)) {
    if (minuteStep !== null && Number.isFinite(minuteStep)) return `每 ${minuteStep} 分钟`
    if (minuteValue === 0) return '每小时整点'
    return `每小时第 ${minute} 分钟`
  }

  if (isAny(minute)) return `${describeAtom(hour, specOf('hour'))}的每一分钟`

  if (minuteValue !== null && hourRange) {
    const clock = (value: number): string => `${String(value).padStart(2, '0')}:${String(minuteValue).padStart(2, '0')}`
    return hourRange[0] === hourRange[1] ? clock(hourRange[0]) : `${clock(hourRange[0])} 到 ${clock(hourRange[1])}`
  }

  if (minuteValue !== null && hourValue !== null) {
    return `${String(hourValue).padStart(2, '0')}:${String(minuteValue).padStart(2, '0')}`
  }

  return `${describeAtom(hour, specOf('hour'))}的${describeAtom(minute, specOf('minute'))}`
}

/** 日字段里的「L」「每 N 天」自带语义，不再套「每月」 */
function isBareDayOfMonth(atom: string): boolean {
  return atom === 'L' || atom.startsWith('*/')
}

function describeDate(dayOfMonth: string, month: string, dayOfWeek: string): string {
  const monthAny = isAny(month)
  const domAny = isAny(dayOfMonth)
  const dowAny = isAny(dayOfWeek)
  const monthText = monthAny ? '' : describeAtom(month, specOf('month'))
  const domText = describeAtom(dayOfMonth, specOf('dayOfMonth'))
  const dowText = describeAtom(dayOfWeek, specOf('dayOfWeek'))

  // 日与星期都没写死 → 不挑日子
  if (domAny && dowAny) return monthAny ? '每天' : monthText

  // 只写了星期
  if (domAny) {
    if (dayOfWeek.includes('#')) return monthAny ? dowText : `${monthText}的${dowText}`
    return monthAny ? `每${dowText}` : `${monthText}的每${dowText}`
  }

  // 只写了日
  if (dowAny) {
    if (isBareDayOfMonth(dayOfMonth)) return monthAny ? domText : `${monthText}的${domText}`
    return monthAny ? `每月 ${domText}` : `${monthText} ${domText}`
  }

  // 日与星期同时写死 → 这是「或」语义，别让人以为要同时满足
  const domDesc = isBareDayOfMonth(dayOfMonth) ? domText : monthAny ? `每月 ${domText}` : `${monthText} ${domText}`
  return `${domDesc}或${dowText}（满足其一）`
}

/**
 * 整体描述 —— 尽力给一句人话，解释不了的情况由逐字段说明兜底。
 * 纯组合，不解析日期。
 */
export function summarizeCronFields(fields: readonly CronFieldInfo[]): string {
  const raw = (key: CronFieldKey): string => fields.find((field) => field.key === key)?.raw ?? '*'
  const second = fields.some((field) => field.key === 'second') ? raw('second') : undefined

  const time = describeTimeOfDay(raw('minute'), raw('hour'))
  const date = describeDate(raw('dayOfMonth'), raw('month'), raw('dayOfWeek'))

  if (second !== undefined && !isAny(second) && second !== '0') {
    const described = describeAtom(second, specOf('second'))
    // 「每 10 秒」这类本身已带频率的说法，不要再套「第」
    const seconds = second.includes('/') ? described : `第 ${described}`
    // 「每分钟」后面再补秒读着别扭，换个说法
    if (time === '每分钟') return [date, `每分钟${seconds}`].filter(Boolean).join(' ')
    return [date, seconds, time].filter(Boolean).join(' ')
  }
  const joined = [date, time].filter(Boolean).join(' ')
  return joined || '每分钟'
}

/* ══════════════ 主入口 ══════════════ */

function emptyResult(input: string, error: CronParseError): CronParseResult {
  return {
    ok: false,
    input,
    isAlias: false,
    hasSeconds: false,
    fields: [],
    summary: '',
    runs: [],
    error,
    warnings: [],
  }
}

/**
 * 收集使用上的提醒。
 * specs[i] 与 atoms[i] 一一对应（5 段时 specs 已去掉「秒」）。
 */
function collectWarnings(atoms: readonly string[], specs: readonly CronFieldSpec[]): CronWarning[] {
  const warnings: CronWarning[] = []
  const indexOfKey = (key: CronFieldKey): number => specs.findIndex((spec) => spec.key === key)

  if (atoms.length === MAX_FIELD_COUNT) {
    warnings.push({
      code: 'six-fields',
      fieldIndex: 0,
      text: '检测到六段式（首段是秒）。crontab 标准是五段，多数调度器不支持秒段，贴到生产环境前先确认对端认不认。',
    })
  }

  const domIndex = indexOfKey('dayOfMonth')
  const dowIndex = indexOfKey('dayOfWeek')
  if (domIndex >= 0 && dowIndex >= 0 && !isAny(atoms[domIndex]) && !isAny(atoms[dowIndex])) {
    warnings.push({
      code: 'dom-and-dow',
      fieldIndex: dowIndex,
      text: '日和星期同时指定，cron 按「或」匹配：满足任意一个就会触发，不是两个都要满足。',
    })
  }

  const questionIndex = atoms.findIndex((atom) => atom.includes('?'))
  if (questionIndex >= 0) {
    warnings.push({
      code: 'question-mark',
      fieldIndex: questionIndex,
      text: '? 是 Quartz 的「不指定」，cron-parser 会按 * 处理，结果通常符合预期但并非标准 crontab 语法。',
    })
  }

  const lastIndex = atoms.findIndex((atom) => atom.includes('L'))
  if (lastIndex >= 0) {
    warnings.push({
      code: 'last-day',
      fieldIndex: lastIndex,
      text: 'L 表示「最后」，只有日字段（每月最后一天）与星期字段能这么用。',
    })
  }

  const nthIndex = atoms.findIndex((atom) => atom.includes('#'))
  if (nthIndex >= 0) {
    warnings.push({
      code: 'nth-weekday',
      fieldIndex: nthIndex,
      text: '# 表示「每月第 N 个周 X」，这是 cron-parser 的扩展，多数 crontab 不认。',
    })
  }

  return warnings
}

function describeAlias(raw: string, options: CronDescribeOptions): CronParseResult {
  const expanded = CRON_ALIASES[raw.toLowerCase()]
  if (!expanded) {
    return emptyResult(raw, {
      code: 'unsupported',
      message: `别名 ${raw} 不被支持，可用别名：${Object.keys(CRON_ALIASES).join(' / ')}`,
      fieldIndex: null,
      fieldKey: null,
    })
  }
  const inner = describeCron(expanded, options)
  if (!inner.ok) {
    return { ...inner, input: raw, isAlias: true }
  }
  return { ...inner, input: raw, isAlias: true }
}

/**
 * 解析 + 解释 + 预览，唯一入口。
 *
 * ⚠️ 每次调用都新建 options 对象：cron-parser 4.9 会把 dayOfWeek 里的 `#`
 * 解析结果写回传入的 options.nthDayOfWeek，复用同一个对象会让后续所有解析被
 * 悄悄污染（表现为莫名其妙的 "loop limit exceeded"）。
 */
export function describeCron(input: string, options: CronDescribeOptions = {}): CronParseResult {
  const now = options.now ?? new Date()
  const count = options.count ?? UPCOMING_COUNT
  const timeZone = options.timeZone ?? 'local'
  const raw = input.trim()

  if (!raw) return emptyResult(input, { code: 'empty', message: '', fieldIndex: null, fieldKey: null })

  if (raw.startsWith('@')) return describeAlias(raw, options)

  const atoms = raw.split(/\s+/)
  if (atoms.length < STANDARD_FIELD_COUNT || atoms.length > MAX_FIELD_COUNT) {
    return emptyResult(raw, {
      code: 'field-count',
      message: `需要 ${STANDARD_FIELD_COUNT} 段（分 时 日 月 周），收到 ${atoms.length} 段`,
      fieldIndex: null,
      fieldKey: null,
    })
  }

  const issue = validateCronFields(atoms)
  if (issue) {
    return emptyResult(raw, {
      code: 'field-value',
      message: issue.message,
      fieldIndex: issue.fieldIndex,
      fieldKey: issue.fieldKey,
    })
  }

  const hasSeconds = atoms.length === MAX_FIELD_COUNT
  const start = MAX_FIELD_COUNT - atoms.length
  const specs = hasSeconds ? CRON_FIELDS : CRON_FIELDS.slice(start)
  const fields: CronFieldInfo[] = specs.map((spec, index) => {
    const atom = atoms[index]
    return { key: spec.key, raw: atom, text: describeAtom(atom, spec) }
  })
  const warnings = collectWarnings(atoms, hasSeconds ? CRON_FIELDS : CRON_FIELDS.slice(start))

  let runs: CronRun[]
  const zone = resolveTimeZone(timeZone)
  if (!isValidTimeZone(zone)) {
    return {
      ok: false,
      input: raw,
      isAlias: false,
      hasSeconds,
      fields,
      summary: '',
      runs: [],
      error: { code: 'timezone', message: `无法识别的时区：${zone}`, fieldIndex: null, fieldKey: null },
      warnings,
    }
  }
  try {
    // 每次都传全新的 options —— 见函数注释
    const interval = parseExpression(raw, { currentDate: now, tz: zone })
    runs = []
    for (let i = 0; i < count; i += 1) {
      const date = interval.next().toDate()
      runs.push({
        date,
        iso: date.toISOString(),
        text: formatInTimeZone(date, zone),
        weekday: weekdayInTimeZone(date, zone),
        relative: formatRelativeTime(date, now),
        distanceMs: date.getTime() - now.getTime(),
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const never = message.includes('loop limit exceeded') || message.includes('Invalid explicit day of month')
    return {
      ok: false,
      input: raw,
      isAlias: false,
      hasSeconds,
      fields,
      summary: '',
      runs: [],
      error: {
        code: never ? 'no-run' : 'unsupported',
        message: never ? '这个日期组合永远不会成立（例如 2 月 30 日），换个日子或去掉限制再试' : message,
        fieldIndex: null,
        fieldKey: null,
        libraryMessage: message,
      },
      warnings,
    }
  }

  return {
    ok: true,
    input: raw,
    isAlias: false,
    hasSeconds,
    fields,
    summary: summarizeCronFields(fields),
    runs,
    error: null,
    warnings,
  }
}
