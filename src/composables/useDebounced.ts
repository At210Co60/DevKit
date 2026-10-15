import { onScopeDispose, ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * 防抖
 *
 * 工具类页面几乎都是「边输入边算」，不防抖会让大文本输入卡顿。
 * 这是第 2 层（状态编排）该统一解决的问题，core 层不需要知道它的存在。
 */
export function useDebounced<T>(source: WatchSource<T>, delay = 300): Ref<T> {
  const debounced = ref(source) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, delay)
  })

  onScopeDispose(() => clearTimeout(timer))

  return debounced
}
