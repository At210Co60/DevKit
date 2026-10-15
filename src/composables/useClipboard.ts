import { ref } from 'vue'

/**
 * 剪贴板写入
 *
 * navigator.clipboard 只在安全上下文（HTTPS / localhost）可用，
 * 且需要用户手势。所以任何一步失败都必须优雅降级，而不是静默失败 ——
 * 工具站的复制按钮是高频操作，降级体验直接影响可信度。
 */
export function useClipboard(resetDelay = 1600) {
  const copied = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string): Promise<boolean> {
    if (!text) return false

    clearTimeout(timer)

    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
      copied.value = true
      failed.value = false
    } catch {
      // 降级：用选中文段 + execCommand 兜底
      const ok = fallbackCopy(text)
      copied.value = ok
      failed.value = !ok
    }

    timer = setTimeout(() => {
      copied.value = false
      failed.value = false
    }, resetDelay)

    return copied.value
  }

  return { copy, copied, failed }
}

/** 老办法兜底：临时 textarea + execCommand */
function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
