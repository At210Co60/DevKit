/**
 * 时间戳工具的状态编排层
 *
 * 输入是一个框：填数字当时间戳、填日期文本当日期，由 core 判断。
 * 本层只做文案拼装、定时刷新与操作转发。
 */
import { computed, onScopeDispose, ref } from 'vue'

import { quips, ui } from '@/content'
import { useClipboard } from '@/composables/useClipboard'

import {
  TIME_ZONE_IDS,
  TIMESTAMP_SAMPLE,
  buildTimestampView,
  nowTimestamps,
  parseTimestampInput,
  type RelativeParts,
  type TimeZoneId,
  type TimestampErrorCode,
} from './core'

export interface ActionEntry {
  key: string
  label: string
  kind?: 'primary' | 'default' | 'ghost'
  disabled?: boolean
}

export interface SelectOption {
  value: string
  label: string
}

export interface OutputRow {
  key: string
  label: string
  value: string
}

/** IANA 标识本身就是名字，只给「本地时区」配文案 */
const ZONE_LABEL: Record<TimeZoneId, string> = {
  local: quips.timestamp.zoneLocal,
  UTC: 'UTC',
  'Asia/Shanghai': 'Asia/Shanghai',
  'America/New_York': 'America/New_York',
}

const ERROR_TEXT: Record<TimestampErrorCode, string> = {
  empty: quips.timestamp.empty,
  notTimestamp: quips.timestamp.errNotTimestamp,
  invalidDate: quips.timestamp.errInvalidDate,
  outOfRange: quips.timestamp.errOutOfRange,
}

const RELATIVE_FORMATTER: Record<RelativeParts['unit'], (amount: number, future: boolean) => string> = {
  justNow: (_amount, future) => (future ? quips.timestamp.relFuture : quips.timestamp.relJustNow),
  second: quips.timestamp.relSecond,
  minute: quips.timestamp.relMinute,
  hour: quips.timestamp.relHour,
  day: quips.timestamp.relDay,
  month: quips.timestamp.relMonth,
  year: quips.timestamp.relYear,
}

function relativeText(parts: RelativeParts): string {
  return RELATIVE_FORMATTER[parts.unit](parts.amount, !parts.past)
}

export function useTimestampTool() {
  const input = ref('')
  const zoneId = ref<TimeZoneId>('local')
  /** 相对时间需要一个「现在」，用 tick 触发重新计算 */
  const tick = ref(Date.now())

  const timer = setInterval(() => {
    tick.value = Date.now()
  }, 30_000)
  onScopeDispose(() => clearInterval(timer))

  const parsed = computed(() => parseTimestampInput(input.value, zoneId.value))
  const nowMs = computed(() => tick.value)

  const errorMessage = computed(() => (parsed.value.ok ? null : quips.timestamp.error))
  const errorDetail = computed(() => (parsed.value.ok ? null : ERROR_TEXT[parsed.value.code]))

  const view = computed(() =>
    parsed.value.ok ? buildTimestampView(parsed.value.epochMs, zoneId.value, nowMs.value) : null,
  )

  const rows = computed<OutputRow[]>(() => {
    const v = view.value
    if (!v || !parsed.value.ok) return []
    const unitText =
      parsed.value.kind === 'date'
        ? quips.timestamp.unitDate
        : parsed.value.unit === 'seconds'
          ? quips.timestamp.unitSeconds
          : quips.timestamp.unitMillis

    return [
      { key: 'datetime', label: quips.timestamp.labelDateTime, value: v.dateTime },
      { key: 'weekday', label: quips.timestamp.labelWeekday, value: v.weekday },
      { key: 'iso', label: quips.timestamp.labelIso, value: v.iso },
      { key: 'relative', label: quips.timestamp.labelRelative, value: relativeText(v.relative) },
      { key: 'seconds', label: quips.timestamp.labelSeconds, value: String(v.epochSeconds) },
      { key: 'millis', label: quips.timestamp.labelMillis, value: String(v.epochMs) },
      { key: 'unit', label: quips.timestamp.labelUnit, value: unitText },
    ]
  })

  const summary = computed(() => rows.value.map((row) => `${row.label}  ${row.value}`).join('\n'))
  const emptyHint = computed(() => quips.timestamp.empty)

  const zoneOptions = computed<SelectOption[]>(() =>
    TIME_ZONE_IDS.map((value) => ({ value, label: ZONE_LABEL[value] })),
  )

  const { copy, copied } = useClipboard()

  const actions = computed<ActionEntry[]>(() => [
    { key: 'now', label: quips.timestamp.now, kind: 'primary', icon: '⏱' },
    { key: 'clear', label: ui.common.clear, kind: 'ghost', disabled: input.value.length === 0 },
    { key: 'sample', label: ui.common.loadSample, kind: 'ghost' },
    { key: 'copy', label: copied.value ? ui.common.copied : ui.common.copy, kind: 'ghost', disabled: !summary.value },
  ])

  function onAction(key: string): void {
    switch (key) {
      case 'now': {
        const stamps = nowTimestamps()
        input.value = stamps.seconds
        tick.value = Date.now()
        break
      }
      case 'clear':
        input.value = ''
        break
      case 'sample':
        input.value = TIMESTAMP_SAMPLE
        break
      case 'copy':
        void copy(summary.value)
        break
      default:
        break
    }
  }

  function onInputChange(value: string): void {
    input.value = value
  }

  function onZoneChange(value: string): void {
    zoneId.value = value as TimeZoneId
  }

  return {
    input,
    zoneId,
    rows,
    summary,
    emptyHint,
    errorMessage,
    errorDetail,
    zoneOptions,
    actions,
    onAction,
    onInputChange,
    onZoneChange,
  }
}
