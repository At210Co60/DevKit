/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 语气开关。任意值 = 玩梗（默认）；`off` = 全站退回正经文案。
   * 见 `.env.example` 与 src/content/pick.ts
   */
  readonly VITE_DEVKIT_TONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
