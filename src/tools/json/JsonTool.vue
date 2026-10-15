<script setup lang="ts">
/**
 * JSON 格式化 —— 只负责渲染，所有判断与文案都在 useJsonTool 里
 */
import ActionBar from '@/components/ActionBar.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import ResultBox from '@/components/ResultBox.vue'
import ToolPanel from '@/components/ToolPanel.vue'
import ToolShell from '@/components/ToolShell.vue'

import { quips, ui } from '@/content'

import { useJsonTool } from './useJsonTool'

const {
  source,
  mode,
  indent,
  output,
  isBlank,
  tooLarge,
  tooLargeHint,
  sizeText,
  emptyHint,
  errorMessage,
  errorDetail,
  modeOptions,
  indentOptions,
  showIndent,
  actions,
  onAction,
  onModeChange,
  onIndentChange,
} = useJsonTool()
</script>

<template>
  <ToolShell title="JSON 格式化" tagline="美化 / 压缩 / 按 key 排序，报错直接给出行列号" :notice="ui.privacy.localOnly">
    <template #actions>
      <ActionBar :items="actions" @action="onAction" />
    </template>

    <ToolPanel left-title="输入 JSON" right-title="输出">
      <template #left-actions>
        <div class="segmented">
          <button
            v-for="option in modeOptions"
            :key="option.value"
            type="button"
            :aria-pressed="mode === option.value"
            @click="onModeChange(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </template>

      <template #right-actions>
        <div v-if="showIndent" class="segmented">
          <button
            v-for="option in indentOptions"
            :key="option.value"
            type="button"
            :aria-pressed="indent === option.value"
            @click="onIndentChange(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </template>

      <template #left>
        <CodeEditor v-model="source" language="json" :placeholder="emptyHint" />
        <p class="json-meta">
          <span>{{ sizeText }}</span>
          <span v-if="isBlank" class="json-meta__hint">{{ quips.json.empty }}</span>
        </p>
      </template>

      <template #right>
        <p v-if="tooLarge" class="notice notice-warn">
          <span aria-hidden="true">⚠️</span>
          <span>{{ tooLargeHint }}</span>
        </p>

        <ResultBox v-else-if="errorMessage" :value="output" :error="errorMessage" :error-detail="errorDetail" />

        <CodeEditor v-else :model-value="output" language="json" readonly :placeholder="emptyHint" />
      </template>
    </ToolPanel>
  </ToolShell>
</template>

<style scoped>
.json-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
}

.json-meta__hint {
  color: var(--text-sub);
}
</style>
