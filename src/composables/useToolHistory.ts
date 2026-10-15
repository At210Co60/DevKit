import { ref } from 'vue'

/**
 * 工具使用历史（纯本地）
 *
 * 产品承诺「零上传、零追踪」的兑现方式之一：
 * 历史只写 localStorage，并且提供一键清除。
 * 不做任何上报、不做匿名化统计 —— 说零追踪就得真的零追踪。
 */

export interface HistoryItem {
  id: string
  visitedAt: number
}

const STORAGE_KEY = 'devkit:history'
const MAX_ITEMS = 12

function read(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (it): it is HistoryItem => typeof it === 'object' && it !== null && typeof (it as HistoryItem).id === 'string',
    )
  } catch {
    return []
  }
}

function write(items: HistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* 隐私模式下 localStorage 可能不可写，静默忽略即可 */
  }
}

const items = ref<HistoryItem[]>(read())

/** 记一次访问，同一工具只保留最新时间 */
export function recordVisit(id: string): void {
  const next: HistoryItem[] = [{ id, visitedAt: Date.now() }, ...items.value.filter((i) => i.id !== id)].slice(
    0,
    MAX_ITEMS,
  )
  items.value = next
  write(next)
}

export function useToolHistory() {
  return {
    items,
    /** 按最近访问排序的 id 列表 */
    ids: () => items.value.map((i) => i.id),
    clear: () => {
      items.value = []
      write([])
    },
  }
}
