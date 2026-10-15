import { defineStore } from 'pinia'
import { ref, watchEffect } from 'vue'

/**
 * 跨工具偏好
 *
 * 为什么要 Pinia：单工具状态一律用 ref，只有**跨工具**的东西才进 store。
 * 当前只有两样 —— 主题与最近使用。
 */

export type ThemeMode = 'system' | 'light' | 'dark'

const THEME_KEY = 'devkit:theme'

function readTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* 隐私模式下读不到，走默认 */
  }
  return 'system'
}

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') delete root.dataset.theme
  else root.dataset.theme = mode
}

export const usePrefs = defineStore('prefs', () => {
  const theme = ref<ThemeMode>(readTheme())

  watchEffect(() => {
    applyTheme(theme.value)
    try {
      localStorage.setItem(THEME_KEY, theme.value)
    } catch {
      /* 存不了就算了，主题当次仍然生效 */
    }
  })

  /** 按 system → light → dark 循环 */
  function cycleTheme(): void {
    theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system'
  }

  return { theme, cycleTheme }
})
