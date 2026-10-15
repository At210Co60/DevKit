import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      /**
       * 只统计「值得测」的纯逻辑层。
       * 组件渲染、composables 的响应式胶水代码不纳入指标 ——
       * 为覆盖率而测组件是自欺欺人。
       */
      include: ['src/utils/**/*.ts', 'src/tools/*/core.ts', 'src/tools/*/crypto.ts', 'src/tools/*/sniffer.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
})
