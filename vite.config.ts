import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    // @ 代表 src 目录，路径一长也不容易写错
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // DevKit 默认端口 8090（避开 web-project 的 8080，可同时跑两个项目）
    port: 8090,
  },
})