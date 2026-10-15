import { computed, onScopeDispose, ref, type Ref } from 'vue'

import { quips, ui } from '@/content'
import { useDebounced } from '@/composables/useDebounced'

import { DIFF_SAMPLE_LEFT, DIFF_SAMPLE_RIGHT, buildDiff, formatUnifiedText } from './core'

/**
 * 文本 Diff 的状态编排 —— 只做「什么时候算、滚动怎么联动、按钮点了干嘛」，
 * 对比逻辑全在 core.ts。
 */

export type DiffViewMode = 'split' | 'unified'

export interface DiffAction {
  key: string
  label: string
  kind?: 'primary' | 'default' | 'ghost'
  disabled?: boolean
  icon?: string
}

export interface DiffViewOption {
  value: DiffViewMode
  label: string
}

export const DIFF_VIEW_OPTIONS: readonly DiffViewOption[] = [
  { value: 'split', label: '并排' },
  { value: 'unified', label: '统一' },
] as const

/** 输入防抖：大文本边打字边 diff 会明显掉帧 */
const INPUT_DEBOUNCE_MS = 200

/**
 * 同步滚动
 *
 * 两个坑必须处理，否则会来回抽搐：
 * 1. 滚动事件触发频率远高于渲染帧率 → 用 rAF 合并，一帧最多处理一次
 * 2. 程序化设置 scrollTop 会再触发一次 scroll → 用 syncing 标志位，
 *    在下一帧再解锁，把这次「回声」吞掉
 */
function useSyncedScroll(enabled: Ref<boolean>) {
  const leftPane = ref<HTMLElement | null>(null)
  const rightPane = ref<HTMLElement | null>(null)
  let syncing = false
  let frame = 0

  function mirror(source: HTMLElement | null, target: HTMLElement | null): void {
    if (!source || !target) return
    const sourceRange = source.scrollHeight - source.clientHeight
    const targetRange = target.scrollHeight - target.clientHeight
    if (sourceRange <= 0 || targetRange <= 0) return
    syncing = true
    target.scrollTop = Math.round((source.scrollTop / sourceRange) * targetRange)
    requestAnimationFrame(() => {
      syncing = false
    })
  }

  function onScroll(side: 'left' | 'right'): void {
    if (!enabled.value || syncing || frame !== 0) return
    // 先记住两端，避免 rAF 里读到已经变化的状态
    const source = side === 'left' ? leftPane.value : rightPane.value
    const target = side === 'left' ? rightPane.value : leftPane.value
    frame = requestAnimationFrame(() => {
      frame = 0
      mirror(source, target)
    })
  }

  function reset(): void {
    leftPane.value?.scrollTo({ top: 0 })
    rightPane.value?.scrollTo({ top: 0 })
  }

  onScopeDispose(() => {
    if (frame !== 0) cancelAnimationFrame(frame)
  })

  return { leftPane, rightPane, onScroll, reset }
}

export function useDiffTool() {
  const left = ref('')
  const right = ref('')
  const ignoreWhitespace = ref(false)
  const ignoreCase = ref(false)
  const inlineChars = ref(true)
  const viewMode = ref<DiffViewMode>('split')
  const syncScroll = ref(true)

  const debouncedLeft = useDebounced(left, INPUT_DEBOUNCE_MS)
  const debouncedRight = useDebounced(right, INPUT_DEBOUNCE_MS)

  const result = computed(() =>
    buildDiff(debouncedLeft.value, debouncedRight.value, {
      ignoreWhitespace: ignoreWhitespace.value,
      ignoreCase: ignoreCase.value,
      inlineChars: inlineChars.value,
    }),
  )

  const unifiedText = computed(() => formatUnifiedText(result.value.rows))
  const isEmpty = computed(() => left.value === '' && right.value === '')
  const hasSideText = computed(() => left.value !== '' || right.value !== '')
  const warning = computed(() => result.value.warnings.find((item) => item.code === 'too-large') ?? null)

  /** 页面顶部那句话：没差异还是发现差异，都从文案层取 */
  const statusText = computed(() => {
    if (isEmpty.value) return quips.diff.empty
    return result.value.stats.identical ? quips.diff.same : quips.diff.differ
  })

  const actions = computed<DiffAction[]>(() => [
    { key: 'sample', label: quips.diff.sample, icon: '✨' },
    { key: 'swap', label: ui.common.swap, icon: '⇄', disabled: !hasSideText.value },
    { key: 'clear', label: ui.common.clear, kind: 'ghost', disabled: !hasSideText.value },
  ])

  const panes = useSyncedScroll(syncScroll)

  function loadSample(): void {
    left.value = DIFF_SAMPLE_LEFT
    right.value = DIFF_SAMPLE_RIGHT
  }

  function swapSides(): void {
    const temp = left.value
    left.value = right.value
    right.value = temp
    panes.reset()
  }

  function clearAll(): void {
    left.value = ''
    right.value = ''
    panes.reset()
  }

  function handleAction(key: string): void {
    if (key === 'sample') loadSample()
    else if (key === 'swap') swapSides()
    else if (key === 'clear') clearAll()
  }

  return {
    /* 输入与选项 */
    left,
    right,
    ignoreWhitespace,
    ignoreCase,
    inlineChars,
    viewMode,
    syncScroll,
    viewOptions: DIFF_VIEW_OPTIONS,

    /* 输出 */
    result,
    unifiedText,
    isEmpty,
    hasSideText,
    warning,
    statusText,
    actions,

    /* 交互 */
    handleAction,
    loadSample,
    swapSides,
    clearAll,
    leftPane: panes.leftPane,
    rightPane: panes.rightPane,
    onScroll: panes.onScroll,
  }
}
