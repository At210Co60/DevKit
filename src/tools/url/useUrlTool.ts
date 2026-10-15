import { computed, onScopeDispose, ref, watch } from 'vue'

import { quips, ui } from '@/content'
import { useClipboard } from '@/composables/useClipboard'
import { useDebounced } from '@/composables/useDebounced'

import {
  buildUrl,
  decodeInput,
  detectEncoding,
  encodeInput,
  parseQuery,
  parseUrl,
  type EncodeTargets,
  type QueryRow,
  type UrlDraft,
  type UrlErrorCode,
  type UrlMode,
} from './core'

/**
 * URL 工具的状态编排层
 *
 * 把 core 的纯函数接到响应式状态上，并把错误 code 映射成 @/content 的中文提示。
 * 组件层只负责把这里算好的东西摆到屏幕上。
 */

/** 错误码 → 中文提示 */
const HEADLINES: Record<UrlErrorCode, string> = {
  empty: quips.url.empty,
  invalidPercent: quips.url.invalidPercent,
  invalidUrl: quips.url.error,
}

const MODE_ITEMS: readonly { key: UrlMode; label: string }[] = [
  { key: 'encode', label: ui.common.encoding },
  { key: 'decode', label: ui.common.decoding },
]

const TARGET_ITEMS: readonly { key: keyof EncodeTargets; label: string }[] = [
  { key: 'pathname', label: quips.url.fields.pathname },
  { key: 'search', label: quips.url.fields.query },
  { key: 'hash', label: quips.url.fields.hash },
]

/** 结构面板里为空的值显示成破折号，比留空更容易看出「这一层本来就没有」 */
const EMPTY_FIELD = '—'

export interface StructureRow {
  field: string
  label: string
  value: string
}

export function useUrlTool() {
  const mode = ref<UrlMode>('encode')
  const input = ref('')
  const targets = ref<EncodeTargets>({ pathname: false, search: false, hash: false })
  const rows = ref<QueryRow[]>([])
  const notice = ref('')

  const debouncedInput = useDebounced(input, 200)
  const { copy } = useClipboard()

  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(noticeTimer))

  /* ── 主结果：整串编解码，或按层级开关编解码 ── */

  const result = computed(() =>
    mode.value === 'encode'
      ? encodeInput(debouncedInput.value, targets.value)
      : decodeInput(debouncedInput.value, targets.value),
  )

  const output = computed(() => (result.value.ok ? result.value.value : ''))

  const error = computed(() => (result.value.ok ? null : HEADLINES[result.value.code]))

  const errorDetail = computed(() => (result.value.ok ? null : result.value.detail))

  const emptyHint = computed(() => (input.value ? ui.common.noResultHint : quips.url.empty))

  /* ── 已编码自动识别 ── */

  const detection = computed(() => detectEncoding(debouncedInput.value))

  const detectionText = computed(() => {
    if (!debouncedInput.value) return ''
    if (detection.value.failed) return quips.url.invalidPercent
    return detection.value.encoded ? quips.url.detectedEncoded : quips.url.detectedPlain
  })

  /* ── 结构拆解（走原生 URL，拿规范化后的信息） ── */

  const parsed = computed(() => parseUrl(debouncedInput.value))

  const structureRows = computed<StructureRow[]>(() => {
    const url = parsed.value
    if (!url.ok) return []

    const { protocol, host, pathname, search, hash } = url.value
    return [
      { field: 'protocol', label: quips.url.fields.protocol, value: protocol || EMPTY_FIELD },
      { field: 'host', label: quips.url.fields.host, value: host || EMPTY_FIELD },
      { field: 'pathname', label: quips.url.fields.pathname, value: pathname || EMPTY_FIELD },
      { field: 'query', label: quips.url.fields.query, value: search || EMPTY_FIELD },
      { field: 'hash', label: quips.url.fields.hash, value: hash || EMPTY_FIELD },
    ]
  })

  /** 输入没带协议时提示一下：我们替它补了 https:// */
  const inferredProtocol = computed(() =>
    parsed.value.ok && parsed.value.value.inferredProtocol ? quips.url.inferred : '',
  )

  /* ── Query 参数：编辑 → 反向拼接 ── */

  const draft = computed<UrlDraft>(() => {
    const url = parsed.value
    return {
      protocol: url.ok ? url.value.protocol : 'https:',
      host: url.ok ? url.value.host : '',
      pathname: url.ok ? url.value.pathname : '',
      rows: rows.value,
      hash: url.ok ? url.value.hash.replace(/^#/, '') : '',
    }
  })

  // 输入一变，参数列表跟着重新解析；用户手动编辑的 rows 不会被这个 watch 冲掉
  watch(
    () => debouncedInput.value,
    () => {
      rows.value = parsed.value.ok ? parseQuery(parsed.value.value.search) : []
    },
    { immediate: true },
  )

  const generated = computed(() => {
    const url = parsed.value
    if (!url.ok || !url.value.host) return null
    return buildUrl(draft.value, targets.value)
  })

  const generatedValue = computed(() => (generated.value?.ok ? generated.value.value : ''))

  const generatedError = computed(() =>
    generated.value && !generated.value.ok ? HEADLINES[generated.value.code] : null,
  )

  const generatedDetail = computed(() => (generated.value && !generated.value.ok ? generated.value.detail : null))

  /* ── 操作 ── */

  const actions = computed(() => [
    { key: 'swap', label: ui.common.swap, kind: 'ghost' as const, icon: '⇄' },
    { key: 'copy-input', label: ui.common.copy, kind: 'ghost' as const, icon: '📋', disabled: !input.value },
    {
      key: 'apply',
      label: quips.url.applyGenerated,
      kind: 'ghost' as const,
      icon: '↩',
      disabled: !generatedValue.value,
    },
    { key: 'sample', label: ui.common.loadSample, kind: 'ghost' as const, icon: '✨' },
    { key: 'clear', label: ui.common.clear, kind: 'ghost' as const, icon: '⌫' },
  ])

  function setMode(next: UrlMode): void {
    mode.value = next
  }

  function toggleTarget(key: keyof EncodeTargets): void {
    targets.value = { ...targets.value, [key]: !targets.value[key] }
  }

  function onAction(key: string): void {
    if (key === 'swap') swap()
    else if (key === 'copy-input') void copyInput()
    else if (key === 'apply') applyGenerated()
    else if (key === 'sample') loadSample()
    else if (key === 'clear') clearAll()
  }

  function swap(): void {
    const swapped = output.value
    if (swapped) input.value = swapped
    mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  }

  async function copyInput(): Promise<void> {
    if (!input.value) {
      flash(quips.url.empty)
      return
    }
    flash((await copy(input.value)) ? quips.global.copied : quips.global.copyFailed)
  }

  /** 把 Query 编辑器拼出来的 URL 填回输入框，接着可以继续编解码 */
  function applyGenerated(): void {
    if (!generatedValue.value) return
    input.value = generatedValue.value
    flash(quips.url.parsed)
  }

  /** 示例跟着模式走：编码模式给明文 URL，解码模式给它百分号转义后的样子 */
  function loadSample(): void {
    input.value = mode.value === 'encode' ? quips.url.sampleUrl : quips.url.sampleEncoded
    flash(quips.global.loaded)
  }

  function clearAll(): void {
    input.value = ''
    rows.value = []
    flash(quips.global.cleared)
  }

  /* ── Query 行编辑 ── */

  function addRow(): void {
    rows.value = [...rows.value, { key: '', value: '' }]
  }

  function removeRow(index: number): void {
    rows.value = rows.value.filter((_, i) => i !== index)
  }

  function onRowInput(index: number, field: keyof QueryRow, event: Event): void {
    const el = event.target as HTMLInputElement
    rows.value = rows.value.map((row, i) => (i === index ? { ...row, [field]: el.value } : row))
  }

  function flash(text: string): void {
    notice.value = text
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => {
      notice.value = ''
    }, 2200)
  }

  return {
    /* 文案 */
    title: quips.url.title,
    tagline: quips.url.tagline,
    privacyNotice: ui.privacy.localOnly,
    keyPlaceholder: quips.url.keyPlaceholder,
    valuePlaceholder: quips.url.valuePlaceholder,
    addParam: quips.url.addParam,
    removeParam: quips.url.removeParam,

    /* 渲染数据 */
    modes: MODE_ITEMS,
    targetItems: TARGET_ITEMS,
    mode,
    input,
    targets,
    rows,
    notice,
    detectionText,
    inferredProtocol,
    structureRows,
    output,
    error,
    errorDetail,
    emptyHint,
    generatedValue,
    generatedError,
    generatedDetail,
    actions,

    /* 交互 */
    setMode,
    toggleTarget,
    onAction,
    addRow,
    removeRow,
    onRowInput,
  }
}
