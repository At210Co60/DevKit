import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'src/**/*.tmp'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // ── 全局规则 ──
  {
    rules: {
      /**
       * 关闭 no-undef：TypeScript 已经在类型层面拦未定义标识符，
       * 且它不认浏览器全局（HTMLDivElement / setTimeout），只会制造误报。
       */
      'no-undef': 'off',

      // 格式化统一交给 Prettier，避免两套规则互相打架
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attributes-order': 'off',
    },
  },

  // ── .vue 文件：让 TS 能解析 <script setup lang="ts"> ──
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // 工具组件用单一功能名（JsonTool 而非 TheJsonTool），单文件模板里的强约束反而添乱
      'vue/multi-word-component-names': 'off',
    },
  },

  // ── 测试文件：允许 describe/it/expect 直接用，不必每个文件 import ──
  {
    files: ['**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ── 纯逻辑层：这几个目录不允许出现 console 与 any ──
  {
    files: ['src/utils/**/*.ts', 'src/tools/*/core.ts', 'src/tools/*/crypto.ts', 'src/tools/*/sniffer.ts'],
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
