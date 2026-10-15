<script setup lang="ts">
/**
 * 时间戳转换 —— 只负责渲染，判断与文案都在 useTimestampTool 里
 */
import ActionBar from '@/components/ActionBar.vue'
import ResultBox from '@/components/ResultBox.vue'
import ToolPanel from '@/components/ToolPanel.vue'
import ToolShell from '@/components/ToolShell.vue'

import { quips, ui } from '@/content'

import { useTimestampTool } from './useTimestampTool'

const {
  input,
  zoneId,
  rows,
  summary,
  emptyHint,
  errorMessage,
  errorDetail,
  zoneOptions,
  actions,
  onAction,
  onInputChange,
  onZoneChange,
} = useTimestampTool()
</script>

<template>
  <ToolShell
    title="时间戳转换"
    tagline="Unix 秒 / 毫秒 ↔ 可读日期，双向互转，带时区与相对时间"
    :notice="ui.privacy.localOnly"
  >
    <template #actions>
      <ActionBar :items="actions" @action="onAction" />
    </template>

    <ToolPanel left-title="输入时间戳或日期" right-title="输出">
      <template #left-actions>
        <select
          class="select ts-zone"
          :value="zoneId"
          @change="onZoneChange(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in zoneOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </template>

      <template #left>
        <input
          class="input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :value="input"
          :placeholder="emptyHint"
          @input="onInputChange(($event.target as HTMLInputElement).value)"
        />
        <p class="ts-hint">
          {{ quips.timestamp.formatHint }}
          <span class="ts-hint__zone">· {{ quips.timestamp.zoneHint }}</span>
        </p>
      </template>

      <template #right>
        <ResultBox v-if="errorMessage" :value="summary" :error="errorMessage" :error-detail="errorDetail" />

        <ul v-else-if="rows.length" class="ts-rows">
          <li v-for="row in rows" :key="row.key" class="ts-rows__item">
            <span class="ts-rows__label">{{ row.label }}</span>
            <span class="ts-rows__value">{{ row.value }}</span>
          </li>
        </ul>

        <p v-else class="ts-empty">{{ emptyHint }}</p>
      </template>
    </ToolPanel>
  </ToolShell>
</template>

<style scoped>
.ts-zone {
  width: auto;
  min-width: 148px;
  padding: 3px 8px;
  font-size: 12.5px;
}

.ts-hint {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
  font-size: 12px;
  color: var(--text-muted);
}

.ts-hint__zone {
  color: var(--text-sub);
}

.ts-empty {
  padding: var(--sp-5) var(--sp-3);
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.ts-rows {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--sp-2);
  padding: 0;
  margin: 0;
  list-style: none;
}

.ts-rows__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sp-2);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.ts-rows__label {
  font-size: 11px;
  color: var(--text-muted);
}

.ts-rows__value {
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 13px;
  color: var(--text-main);
  overflow-wrap: anywhere;
}
</style>
