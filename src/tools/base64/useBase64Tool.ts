import { computed, onScopeDispose, ref, watch } from 'vue'

import { quips, ui } from '@/content'
import { useClipboard } from '@/composables/useClipboard'
import { useDebounced } from '@/composables/useDebounced'

import {
  MAX_FILE_BYTES,
  convert,
  describeSize,
  invertMode,
  isEncodeMode,
  planDownload,
  type Base64ErrorCode,
  type Base64Mode,
} from './core'

/**
 * Base64 工具的状态编排层
 *
 * 只做三件事：把 core 的纯函数接到响应式状态上、把 DOM 副作用（FileReader / Blob /
 * <a download>）收在这一层、把错误 code 映射成 @/content 的中文提示。
 * 组件层不碰任何判断。
 */

/** 错误码 → 中文提示。技术细节由 core 的 detail 提供，这里只出「发生了什么」 */
const HEADLINES: Record<Base64ErrorCode, string> = {
  empty: quips.base64.empty,
  invalidChar: quips.base64.error,
  badLength: quips.base64.error,
  notUtf8: quips.base64.notText,
  tooLarge: quips.base64.fileTooLarge,
  readFailed: quips.base64.fileReadFailed,
  invalidDataUrl: quips.base64.error,
}

const MODE_ITEMS: readonly { key: Base64Mode; label: string }[] = [
  { key: 'encode', label: ui.common.encoding },
  { key: 'decode', label: ui.common.decoding },
  { key: 'encodeUrl', label: `URL-safe ${ui.common.encoding}` },
  { key: 'decodeUrl', label: `URL-safe ${ui.common.decoding}` },
]

/** 拖进来的文件。文件本身就是结果，所以单独占一路输出 */
export interface FilePayload {
  name: string
  size: number
  dataUrl: string
}

export function useBase64Tool() {
  const mode = ref<Base64Mode>('encode')
  const input = ref('')
  const file = ref<FilePayload | null>(null)
  const dragging = ref(false)
  const notice = ref('')

  const debouncedInput = useDebounced(input, 180)
  const { copy } = useClipboard()

  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(noticeTimer))

  /* ── 转换结果 ── */

  const textResult = computed(() => convert(debouncedInput.value, mode.value))

  const error = computed(() => {
    if (file.value || textResult.value.ok) return null
    return HEADLINES[textResult.value.code]
  })

  const errorDetail = computed(() => {
    if (file.value || textResult.value.ok) return null
    return textResult.value.detail
  })

  const output = computed(() => {
    if (file.value) return file.value.dataUrl
    return textResult.value.ok ? textResult.value.value : ''
  })

  const byteLength = computed(() => {
    if (file.value) return file.value.size
    return textResult.value.ok ? textResult.value.byteLength : 0
  })

  const sizeLabel = computed(() => describeSize(byteLength.value))

  const emptyHint = computed(() => (input.value || file.value ? ui.common.noResultHint : quips.base64.empty))

  const placeholder = computed(() => (isEncodeMode(mode.value) ? quips.base64.empty : 'SGVsbG8='))

  const canDownload = computed(() => Boolean(output.value) && !error.value)

  /* ── 操作 ── */

  const actions = computed(() => [
    { key: 'swap', label: ui.common.swap, kind: 'ghost' as const, icon: '⇄' },
    { key: 'copy-input', label: ui.common.copy, kind: 'ghost' as const, icon: '📋', disabled: !input.value },
    { key: 'sample', label: ui.common.loadSample, kind: 'ghost' as const, icon: '✨' },
    { key: 'clear', label: ui.common.clear, kind: 'ghost' as const, icon: '⌫' },
    { key: 'download', label: ui.common.download, kind: 'primary' as const, icon: '⬇', disabled: !canDownload.value },
  ])

  function setMode(next: Base64Mode): void {
    file.value = null
    mode.value = next
  }

  function onAction(key: string): void {
    if (key === 'swap') swap()
    else if (key === 'copy-input') void copyInput()
    else if (key === 'sample') loadSample()
    else if (key === 'clear') clearAll()
    else if (key === 'download') download()
  }

  /** 交换左右：结果回填输入，模式取互逆 */
  function swap(): void {
    const swapped = output.value
    file.value = null
    if (swapped) input.value = swapped
    mode.value = invertMode(mode.value)
  }

  async function copyInput(): Promise<void> {
    if (!input.value) {
      flash(quips.base64.empty)
      return
    }
    flash((await copy(input.value)) ? quips.global.copied : quips.global.copyFailed)
  }

  /** 示例跟着模式走：编码模式给中文原文，解码模式给它的 Base64 */
  function loadSample(): void {
    file.value = null
    input.value = isEncodeMode(mode.value) ? quips.base64.sampleText : quips.base64.sampleEncoded
    flash(quips.global.loaded)
  }

  function clearAll(): void {
    input.value = ''
    file.value = null
    flash(quips.global.cleared)
  }

  /* ── 文件：拖拽 / 选择 → DataURL（FileReader 属于 DOM，只能待在这一层） ── */

  function onDragOver(): void {
    dragging.value = true
  }

  function onDragLeave(): void {
    dragging.value = false
  }

  function onDrop(event: DragEvent): void {
    dragging.value = false
    const dropped = event.dataTransfer?.files?.[0]
    if (dropped) readFile(dropped)
  }

  function onPickFile(event: Event): void {
    const el = event.target as HTMLInputElement
    const picked = el.files?.[0]
    if (picked) readFile(picked)
    el.value = '' // 允许连续选同一个文件
  }

  function readFile(blob: File): void {
    if (blob.size > MAX_FILE_BYTES) {
      flash(quips.base64.fileTooLarge)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      if (!dataUrl) {
        flash(quips.base64.fileReadFailed)
        return
      }
      file.value = { name: blob.name || 'pasted-file', size: blob.size, dataUrl }
      flash(quips.base64.fileOk)
    }
    reader.onerror = () => flash(quips.base64.fileReadFailed)
    reader.readAsDataURL(blob)
  }

  // 用户开始打字就意味着放弃当前文件，否则输出会一直卡在旧文件上
  watch(input, () => {
    file.value = null
  })

  /* ── 下载：解码结果 → Blob → <a download> ── */

  function download(): void {
    const result = planDownload(output.value)
    if (!result.ok) {
      flash(HEADLINES[result.code])
      return
    }

    const { bytes, mime, filename } = result.value
    // 复制一份再进 Blob：Uint8Array 的 buffer 在类型上是 ArrayBufferLike，而 BlobPart 只收 ArrayBuffer
    const href = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }))
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(href), 0)

    flash(quips.base64.downloaded)
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
    title: quips.base64.title,
    tagline: quips.base64.tagline,
    privacyNotice: ui.privacy.localOnly,
    securityNotice: quips.base64.isNotEncryption,
    dropHint: quips.base64.dropHint,
    dropActive: quips.base64.dropActive,

    /* 渲染数据 */
    modes: MODE_ITEMS,
    mode,
    input,
    file,
    dragging,
    notice,
    output,
    error,
    errorDetail,
    emptyHint,
    placeholder,
    sizeLabel,
    actions,

    /* 交互 */
    setMode,
    onAction,
    onDragOver,
    onDragLeave,
    onDrop,
    onPickFile,
  }
}
