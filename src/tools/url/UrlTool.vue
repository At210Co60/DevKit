<script setup lang="ts">
import ActionBar from '@/components/ActionBar.vue'
import ResultBox from '@/components/ResultBox.vue'
import ToolPanel from '@/components/ToolPanel.vue'
import ToolShell from '@/components/ToolShell.vue'

import { quips, ui } from '@/content'

import { useUrlTool } from './useUrlTool'

/**
 * URL 工具页 —— 只渲染
 *
 * 判断全在 use 层：结构拆解是已经算好的行数组，Query 是已经解析好的行数组，
 * 错误是已经映射好的文案。这里没有任何业务 if-else。
 */

const {
  title,
  tagline,
  privacyNotice,
  keyPlaceholder,
  valuePlaceholder,
  addParam,
  removeParam,
  modes,
  targetItems,
  mode,
  input,
  targets,
  rows,
  notice,
  detectionText,
  inferredProtocol,
  structureRows,
  output,
  error,
  errorDetail,
  emptyHint,
  generatedValue,
  generatedError,
  generatedDetail,
  actions,
  setMode,
  toggleTarget,
  onAction,
  addRow,
  removeRow,
  onRowInput,
} = useUrlTool()
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
        <textarea v-model="input" class="input url__input" rows="7" spellcheck="false" :placeholder="quips.url.empty" />

        <p v-if="detectionText" class="notice notice-info">{{ detectionText }}</p>

        <fieldset class="targets">
          <legend class="targets__legend">{{ ui.common.encoding }}</legend>
          <label v-for="item in targetItems" :key="item.key" class="targets__item">
            <input type="checkbox" :checked="targets[item.key]" @change="toggleTarget(item.key)" />
            <span>{{ item.label }}</span>
          </label>
        </fieldset>
      </template>

      <template #right>
        <ResultBox :value="output" :error="error" :error-detail="errorDetail" :empty-hint="emptyHint" mono />
      </template>
    </ToolPanel>

    <section v-if="inferredProtocol" class="notice notice-warn">{{ inferredProtocol }}</section>

    <section class="card url__card">
      <h2 class="url__card-title">URL</h2>
      <dl class="url__fields">
        <template v-for="row in structureRows" :key="row.field">
          <dt class="url__field-label">{{ row.label }}</dt>
          <dd class="url__field-value">{{ row.value }}</dd>
        </template>
      </dl>
    </section>

    <section class="card url__card">
      <h2 class="url__card-title">{{ quips.url.fields.query }}</h2>

      <div v-for="(row, index) in rows" :key="index" class="query__row">
        <input
          class="input query__key"
          :value="row.key"
          :placeholder="keyPlaceholder"
          spellcheck="false"
          @input="onRowInput(index, 'key', $event)"
        />
        <input
          class="input query__value"
          :value="row.value"
          :placeholder="valuePlaceholder"
          spellcheck="false"
          @input="onRowInput(index, 'value', $event)"
        />
        <button type="button" class="btn btn-sm btn-ghost" :aria-label="removeParam" @click="removeRow(index)">
          ✕
        </button>
      </div>

      <div class="url__row-actions">
        <button type="button" class="btn btn-sm" @click="addRow">
          <span aria-hidden="true">＋</span>
          <span>{{ addParam }}</span>
        </button>
      </div>

      <ResultBox
        class="url__generated"
        :value="generatedValue"
        :error="generatedError"
        :error-detail="generatedDetail"
        :empty-hint="quips.url.empty"
        mono
      />
    </section>
  </ToolShell>
</template>

<style scoped>
.url__input {
  min-height: 132px;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: var(--code-fg-size);
  line-height: 1.6;
  resize: vertical;
}

.targets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.targets__legend {
  padding: 0 var(--sp-1);
  font-size: 12px;
  color: var(--text-sub);
}

.targets__item {
  display: inline-flex;
  gap: var(--sp-1);
  align-items: center;
  font-size: 12.5px;
  color: var(--text-main);
  cursor: pointer;
}

.url__card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}

.url__card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.url__fields {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: var(--sp-2) var(--sp-3);
  margin: 0;
}

.url__field-label {
  font-size: 12px;
  color: var(--text-sub);
}

.url__field-value {
  margin: 0;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  color: var(--text-main);
  overflow-wrap: anywhere;
}

.query__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  gap: var(--sp-2);
  align-items: center;
}

.query__key,
.query__value {
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 12.5px;
}

.url__row-actions {
  display: flex;
  gap: var(--sp-2);
}
</style>
