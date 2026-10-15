<script setup lang="ts">
import { computed } from 'vue'

import ActionBar from '@/components/ActionBar.vue'
import ResultBox from '@/components/ResultBox.vue'
import ToolPanel from '@/components/ToolPanel.vue'
import ToolShell from '@/components/ToolShell.vue'
import { quips } from '@/content'

import { useCronTool } from './useCronTool'

const {
  expression,
  timeZone,
  timezoneOptions,
  presets,
  limitations,
  result,
  isEmpty,
  errorTitle,
  errorText,
  errorDetail,
  actions,
  applyPreset,
  handleAction,
} = useCronTool()

const presetItems = computed(() => presets.map((preset) => ({ key: preset.expression, label: preset.label })))
</script>

<template>
  <ToolShell
    title="Cron 表达式"
    tagline="五段式解析：逐字段解释 + 接下来 5 次运行时间"
    notice="只按 crontab 标准五段式（分 时 日 月 周）校对。六段式首段是秒，cron-parser 支持，但多数调度器不认。"
    notice-kind="info"
  >
    <template #notice-icon>📌</template>

    <ToolPanel left-title="Cron 表达式" right-title="解析结果">
      <template #left-actions>
        <ActionBar :items="actions" @action="handleAction" />
      </template>

      <div class="cron-input">
        <input
          v-model="expression"
          class="input cron-input__field"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="0 0 * * *"
          aria-label="Cron 表达式"
        />
        <label class="cron-input__zone">
          <span class="cron-input__zone-label">时区</span>
          <select v-model="timeZone" class="select">
            <option v-for="option in timezoneOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="cron-presets">
        <span class="cron-presets__label">常用模板</span>
        <ActionBar :items="presetItems" @action="applyPreset" />
      </div>
    </ToolPanel>

    <ResultBox
      v-if="!result.ok"
      value=""
      :error="errorTitle"
      :error-detail="errorText || errorDetail"
      :empty-hint="quips.cron.empty"
      mono
    />

    <div v-else class="cron-result">
      <section class="card cron-summary">
        <p class="cron-summary__hint">{{ quips.cron.valid }}</p>
        <p class="cron-summary__text">{{ result.summary }}</p>
        <p v-if="result.isAlias" class="cron-summary__alias">{{ result.input }} → 已展开为标准五段式</p>
      </section>

      <section v-if="result.warnings.length" class="cron-warnings">
        <p v-for="(warning, index) in result.warnings" :key="index" class="notice notice-warn">
          <span aria-hidden="true">⚠️</span>
          <span>{{ warning.text }}</span>
        </p>
      </section>

      <section class="card cron-card">
        <h2 class="cron-card__title">{{ quips.cron.explained }}</h2>
        <ul class="cron-fields">
          <li v-for="field in result.fields" :key="field.key" class="cron-fields__row">
            <span class="cron-fields__raw">{{ field.raw }}</span>
            <span class="cron-fields__text">{{ field.text }}</span>
          </li>
        </ul>
      </section>

      <section class="card cron-card">
        <h2 class="cron-card__title">接下来 {{ result.runs.length }} 次运行</h2>
        <ol class="cron-runs">
          <li v-for="run in result.runs" :key="run.iso" class="cron-runs__row">
            <span class="cron-runs__time">{{ run.text }}</span>
            <span class="cron-runs__weekday">{{ run.weekday }}</span>
            <span class="tag cron-runs__relative">{{ run.relative }}</span>
          </li>
        </ol>
      </section>
    </div>

    <p v-if="isEmpty" class="notice notice-info">
      <span aria-hidden="true">💡</span>
      <span>{{ quips.cron.empty }}</span>
    </p>

    <section class="card cron-limit">
      <h2 class="cron-card__title">{{ quips.cron.limitations }}</h2>
      <ul class="cron-limit__list">
        <li v-for="item in limitations" :key="item">{{ item }}</li>
      </ul>
    </section>
  </ToolShell>
</template>

<style scoped>
.cron-input {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
}

.cron-input__field {
  flex: 1;
  min-width: 0;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: var(--code-fg-size);
}

.cron-input__zone {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
  flex: none;
}

.cron-input__zone-label,
.cron-presets__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  white-space: nowrap;
}

.cron-presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
}

.cron-result {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.cron-summary {
  padding: var(--sp-4);
}

.cron-summary__hint {
  font-size: 12px;
  color: var(--text-muted);
}

.cron-summary__text {
  margin-top: var(--sp-1);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.cron-summary__alias {
  margin-top: var(--sp-1);
  font-size: 12px;
  color: var(--text-sub);
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
}

.cron-warnings {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.cron-card {
  padding: var(--sp-4);
}

.cron-card__title {
  margin-bottom: var(--sp-3);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cron-fields,
.cron-runs,
.cron-limit__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.cron-fields__row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: var(--sp-3);
  align-items: baseline;
  font-size: 13px;
}

.cron-fields__raw {
  padding: 2px 6px;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-sub);
  background: var(--bg-subtle);
  border-radius: var(--r-sm);
  overflow-wrap: anywhere;
}

.cron-fields__text {
  color: var(--text-main);
}

.cron-runs__row {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  font-size: 13px;
}

.cron-runs__time {
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  color: var(--text-main);
}

.cron-runs__weekday {
  color: var(--text-sub);
}

.cron-runs__relative {
  margin-left: auto;
  color: var(--info);
  background: var(--info-bg);
}

.cron-limit {
  padding: var(--sp-4);
}

.cron-limit__list {
  margin: 0;
  padding-left: var(--sp-5);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-sub);
}

@media (max-width: 880px) {
  .cron-input {
    flex-direction: column;
    align-items: stretch;
  }

  .cron-fields__row {
    grid-template-columns: 96px 1fr;
  }
}
</style>
