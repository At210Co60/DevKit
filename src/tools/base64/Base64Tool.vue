<script setup lang="ts">
import ActionBar from '@/components/ActionBar.vue'
import ResultBox from '@/components/ResultBox.vue'
import ToolPanel from '@/components/ToolPanel.vue'
import ToolShell from '@/components/ToolShell.vue'

import { ui } from '@/content'

import { useBase64Tool } from './useBase64Tool'

/**
 * Base64 工具页 —— 只渲染
 *
 * 判断全在 use 层，这里只负责把状态摆到屏幕上：
 * 没有 if-else 业务分支，只有「要不要显示」的 v-if。
 */

const {
  title,
  tagline,
  privacyNotice,
  securityNotice,
  dropHint,
  dropActive,
  modes,
  mode,
  input,
  file,
  dragging,
  notice,
  output,
  error,
  errorDetail,
  emptyHint,
  placeholder,
  sizeLabel,
  actions,
  setMode,
  onAction,
  onDragOver,
  onDragLeave,
  onDrop,
  onPickFile,
} = useBase64Tool()
</script>

<template>
  <ToolShell :title="title" :tagline="tagline" :notice="privacyNotice" notice-kind="info">
    <template #actions>
      <div class="segmented">
        <button
          v-for="item in modes"
          :key="item.key"
          type="button"
          :aria-pressed="item.key === mode"
          @click="setMode(item.key)"
        >
          {{ item.label }}
        </button>
      </div>

      <ActionBar :items="actions" @action="onAction" />
    </template>

    <p v-if="notice" class="notice notice-success">{{ notice }}</p>

    <ToolPanel :left-title="ui.common.input" :right-title="ui.common.output">
      <template #left>
        <div
          class="dropzone"
          :class="{ 'dropzone--active': dragging }"
          @dragenter.prevent="onDragOver"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
        >
          <textarea
            v-model="input"
            class="input dropzone__text"
            rows="9"
            spellcheck="false"
            :placeholder="placeholder"
          />

          <p class="dropzone__hint">{{ dragging ? dropActive : dropHint }}</p>

          <label class="btn btn-sm dropzone__pick">
            <span aria-hidden="true">📎</span>
            <span>{{ ui.common.upload }}</span>
            <input type="file" hidden @change="onPickFile" />
          </label>

          <p v-if="file" class="tag tag-stable dropzone__file">📎 {{ file.name }} · {{ sizeLabel }}</p>
        </div>
      </template>

      <template #right>
        <p class="stat">{{ sizeLabel }}</p>

        <ResultBox :value="output" :error="error" :error-detail="errorDetail" :empty-hint="emptyHint" mono />
      </template>
    </ToolPanel>

    <p class="notice notice-warn">
      <span aria-hidden="true">⚠️</span>
      <span>{{ securityNotice }}</span>
    </p>
  </ToolShell>
</template>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
  padding: var(--sp-3);
  background: var(--bg-card);
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-md);
  transition:
    border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}

.dropzone--active {
  background: var(--bg-subtle);
  border-color: var(--primary);
}

.dropzone__text {
  min-height: 190px;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: var(--code-fg-size);
  line-height: 1.6;
  resize: vertical;
}

.dropzone__hint {
  font-size: 12px;
  color: var(--text-muted);
}

.dropzone__pick {
  cursor: pointer;
}

.dropzone__file {
  font-weight: 500;
}

.stat {
  margin: 0;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
