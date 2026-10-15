/**
 * JSON 工具的状态编排层
 *
 * 只做三件事：把 core 的结果摊平成界面能直接用的 ref、加防抖、转发操作。
 * 这里不允许出现任何解析细节，更不允许出现文案。
 */
import { computed, ref } from 'vue'

import { quips, ui } from '@/content'
import { useClipboard } from '@/composables/useClipboard'
import { useDebounced } from '@/composables/useDebounced'
import type { IndentStyle } from '@/utils/json-error'
import { toFixedNumber } from '@/utils/format'

import {
  JSON_INDENT_STYLES,
  JSON_MODES,
  JSON_SAMPLE,
  extractLineText,
  locateJsonError,
  measureInput,
  runJson,
  type JsonMode,
} from './core'

export interface SelectOption {
  value: string
  label: string
}

export interface ActionEntry {
  key: string
  label: string
  kind?: 'primary' | 'default' | 'ghost'
  disabled?: boolean
}

const MODE_LABEL: Record<JsonMode, string> = {
  format: quips.json.labelFormat,
  minify: quips.json.labelMinify,
  sort: quips.json.labelSort,
}

const INDENT_LABEL: Record<IndentStyle, string> = {
  '2': quips.json.indentTwo,
  '4': quips.json.indentFour,
  tab: quips.json.indentTab,
}

export function useJsonTool() {
  const source = ref('')
  const mode = ref<JsonMode>('format')
  const indent = ref<IndentStyle>('4')

  /** 大段 JSON 边贴边算，必须防抖 */
  const debounced = useDebounced(source, 250)

  const outcome = computed(() => runJson(debounced.value, mode.value, indent.value))

  const output = computed(() => (outcome.value.kind === 'ok' ? outcome.value.text : ''))
  const isBlank = computed(() => outcome.value.kind === 'blank')
  const tooLarge = computed(() => outcome.value.kind === 'oversized')
  const size = computed(() => measureInput(debounced.value))

  const errorMessage = computed(() => (outcome.value.kind === 'error' ? quips.json.error : null))

  /** 行列定位是本工具的核心价值，放在最显眼的位置 */
  const errorDetail = computed(() => {
    if (outcome.value.kind !== 'error') return null
    const { info } = outcome.value
    const location = locateJsonError(debounced.value, info)
    const position = location ? quips.json.lineCol(location.line, location.column) : null
    const excerpt = location ? extractLineText(debounced.value, location.line) : ''
    return [position, info.message, excerpt].filter(Boolean).join('\n')
  })

  const sizeText = computed(() => quips.json.sizeText(toFixedNumber(size.value.bytes)))
  const emptyHint = computed(() => quips.json.empty)
  const tooLargeHint = computed(() => quips.json.tooLarge)

  const modeOptions = computed<SelectOption[]>(() => JSON_MODES.map((value) => ({ value, label: MODE_LABEL[value] })))
  const indentOptions = computed<SelectOption[]>(() =>
    JSON_INDENT_STYLES.map((value) => ({ value, label: INDENT_LABEL[value] })),
  )

  /** 压缩模式没有缩进概念，藏起来省得误导 */
  const showIndent = computed(() => mode.value !== 'minify')

  const { copy, copied } = useClipboard()

  const actions = computed<ActionEntry[]>(() => [
    { key: 'format', label: quips.json.labelFormat, kind: mode.value === 'format' ? 'primary' : 'ghost' },
    { key: 'minify', label: quips.json.labelMinify, kind: mode.value === 'minify' ? 'primary' : 'ghost' },
    { key: 'sort', label: quips.json.labelSort, kind: mode.value === 'sort' ? 'primary' : 'ghost' },
    { key: 'clear', label: ui.common.clear, kind: 'ghost', disabled: source.value.length === 0 },
    { key: 'sample', label: ui.common.loadSample, kind: 'ghost' },
    { key: 'copy', label: copied.value ? ui.common.copied : ui.common.copy, kind: 'primary', disabled: !output.value },
  ])

  function onAction(key: string): void {
    switch (key) {
      case 'format':
        mode.value = 'format'
        break
      case 'minify':
        mode.value = 'minify'
        break
      case 'sort':
        mode.value = 'sort'
        break
      case 'clear':
        source.value = ''
        break
      case 'sample':
        source.value = JSON_SAMPLE
        break
      case 'copy':
        void copy(output.value)
        break
      default:
        break
    }
  }

  function onModeChange(value: string): void {
    mode.value = value as JsonMode
  }

  function onIndentChange(value: string): void {
    indent.value = value as IndentStyle
  }

  return {
    source,
    mode,
    indent,
    output,
    isBlank,
    tooLarge,
    tooLargeHint,
    sizeText,
    emptyHint,
    errorMessage,
    errorDetail,
    modeOptions,
    indentOptions,
    showIndent,
    actions,
    onAction,
    onModeChange,
    onIndentChange,
  }
}
