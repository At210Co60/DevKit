import { computed, onScopeDispose, ref, watch } from 'vue'

import { quips } from '@/content'
import { useDebounced } from '@/composables/useDebounced'

import {
  CRON_ALIASES,
  CRON_LIMITATIONS,
  CRON_PRESETS,
  CRON_SAMPLE,
  TIMEZONE_OPTIONS,
  describeCron,
  isValidTimeZone,
  type CronParseResult,
} from './core'

/**
 * Cron 工具的状态编排 —— 只负责「什么时候算、算什么、给界面什么文案」，
 * 真正的解析与解释全在 core.ts。
 */

/** 相对时间（「3 天后」）会随时间失真，定期把 now 推一下 */
const CLOCK_TICK_MS = 30_000
const INPUT_DEBOUNCE_MS = 200

export interface CronAction {
  key: string
  label: string
  kind?: 'primary' | 'default' | 'ghost'
  disabled?: boolean
  icon?: string
}

export function useCronTool() {
  const expression = ref('')
  const timeZone = ref('local')
  const now = ref(new Date())

  const timer = setInterval(() => {
    now.value = new Date()
  }, CLOCK_TICK_MS)
  onScopeDispose(() => clearInterval(timer))

  const debouncedExpression = useDebounced(expression, INPUT_DEBOUNCE_MS)

  const result = computed<CronParseResult>(() =>
    describeCron(debouncedExpression.value, {
      now: now.value,
      timeZone: timeZone.value,
    }),
  )

  /** 改了时区立即重算，不用等输入防抖 */
  watch(timeZone, () => {
    debouncedExpression.value = expression.value
  })

  const isEmpty = computed(() => debouncedExpression.value.trim() === '')

  /** ResultBox 的三件套：错误标题、具体位置、库原始报错 */
  const errorTitle = computed(() => {
    if (isEmpty.value) return quips.cron.empty
    if (result.value.error?.code === 'no-run') return quips.cron.noRun
    if (result.value.error?.code === 'timezone') return quips.cron.timeZone
    return quips.cron.error
  })

  const errorText = computed(() => {
    const error = result.value.error
    if (!error) return ''
    if (isEmpty.value || error.code === 'timezone') return ''
    return error.message
  })

  const errorDetail = computed(() => result.value.error?.libraryMessage ?? '')

  const actions = computed<CronAction[]>(() => [
    { key: 'sample', label: quips.cron.sample, icon: '✨' },
    { key: 'clear', label: '清空', kind: 'ghost', disabled: isEmpty.value },
  ])

  function applyPreset(value: string) {
    expression.value = value
  }

  function loadSample() {
    expression.value = CRON_SAMPLE
  }

  function clear() {
    expression.value = ''
  }

  function handleAction(key: string): void {
    if (key === 'sample') loadSample()
    else if (key === 'clear') clear()
  }

  return {
    /* 输入 */
    expression,
    timeZone,
    timezoneOptions: TIMEZONE_OPTIONS,
    presets: CRON_PRESETS,
    supportedAliases: Object.keys(CRON_ALIASES),
    limitations: CRON_LIMITATIONS,
    isValidTimeZone,

    /* 输出 */
    result,
    isEmpty,
    errorTitle,
    errorText,
    errorDetail,
    actions,

    /* 交互 */
    applyPreset,
    handleAction,
    loadSample,
    clear,
  }
}
