<script setup lang="ts">
import { computed } from 'vue'

import { ui } from '@/content'
import { useClipboard } from '@/composables/useClipboard'

/**
 * 输出区 —— 统一处理「空 / 出错 / 有结果」三种形态
 *
 * 工具只管传值，不用各自写复制按钮和错误样式。
 * 错误信息应当是可操作的（说清楚哪里错了），不是一句「出错了」。
 */
const props = withDefaults(
  defineProps<{
    value: string
    /** 错误描述，传了优先于 value 显示 */
    error?: string | null
    /** 额外的错误补充说明，如行号列号 */
    errorDetail?: string | null
    /** 无内容时的提示 */
    emptyHint?: string
    placeholder?: string
    /** 用等宽字体（大段代码） */
    mono?: boolean
  }>(),
  {
    error: null,
    errorDetail: null,
    emptyHint: '',
    placeholder: '',
    mono: true,
  },
)

const { copy, copied, failed } = useClipboard()

const isEmpty = computed(() => !props.error && !props.value)
const canCopy = computed(() => Boolean(props.value) && !props.error)
</script>

<template>
  <div class="result-box" :class="{ 'result-box--mono': mono }">
    <div v-if="error" class="result-box__error">
      <p class="result-box__error-msg">{{ error }}</p>
      <p v-if="errorDetail" class="result-box__error-detail">{{ errorDetail }}</p>
    </div>

    <template v-else>
      <button v-if="canCopy" type="button" class="result-box__copy btn btn-sm" @click="copy(value)">
        {{ copied ? '✓ 已复制' : failed ? ui.common.copyFailed : ui.common.copy }}
      </button>

      <pre v-if="!isEmpty" class="result-box__content">{{ value }}</pre>

      <p v-else class="result-box__empty">{{ emptyHint || placeholder || ui.common.noResultHint }}</p>
    </template>
  </div>
</template>

<style scoped>
.result-box {
  position: relative;
  min-height: 160px;
  max-height: 60vh;
  padding: var(--sp-3);
  overflow: auto;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.result-box__content {
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-main);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.result-box--mono .result-box__content {
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: var(--code-fg-size);
}

.result-box__copy {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
  z-index: 1;
}

.result-box__empty {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding-top: var(--sp-5);
}

.result-box__error {
  padding: var(--sp-2) 0;
}

.result-box__error-msg {
  font-size: 13px;
  font-weight: 500;
  color: var(--danger);
}

.result-box__error-detail {
  margin-top: var(--sp-1);
  font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  color: var(--text-sub);
  white-space: pre-wrap;
}
</style>
