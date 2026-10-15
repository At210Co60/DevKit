<script setup lang="ts">
import { computed } from 'vue'

import ActionBar from '@/components/ActionBar.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import ResultBox from '@/components/ResultBox.vue'
import ToolPanel from '@/components/ToolPanel.vue'
import ToolShell from '@/components/ToolShell.vue'
import { quips, ui } from '@/content'

import { useDiffTool } from './useDiffTool'
import type { DiffRowType } from './core'

const {
  left,
  right,
  ignoreWhitespace,
  ignoreCase,
  inlineChars,
  viewMode,
  syncScroll,
  viewOptions,
  result,
  unifiedText,
  isEmpty,
  warning,
  statusText,
  actions,
  handleAction,
  leftPane,
  rightPane,
  onScroll,
} = useDiffTool()

/** 一行在左右两栏分别长什么样：纯新增在左侧是占位空行，纯删除在右侧同理 */
function cellClass(type: DiffRowType, side: 'left' | 'right'): string {
  const isVoid = (side === 'left' && type === 'added') || (side === 'right' && type === 'removed')
  if (isVoid) return 'diff-cell--void'
  if (type === 'modified') return 'diff-cell--mod'
  if (type === 'added') return 'diff-cell--add'
  if (type === 'removed') return 'diff-cell--del'
  return ''
}

const summary = computed(() => {
  const { added, removed, modified } = result.value.stats
  return { added, removed, modified }
})
</script>

<template>
  <ToolShell
    title="文本 Diff"
    tagline="左右两栏逐行对比，修改行再做字符级标色"
    :notice="ui.privacy.localOnly"
    notice-kind="success"
  >
    <template #notice-icon>🔒</template>

    <section class="card diff-options">
      <div class="segmented" role="group" aria-label="展示方式">
        <button
          v-for="option in viewOptions"
          :key="option.value"
          type="button"
          :aria-pressed="viewMode === option.value"
          @click="viewMode = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <label class="diff-check">
        <input v-model="ignoreWhitespace" type="checkbox" />
        <span>忽略空白</span>
      </label>
      <label class="diff-check">
        <input v-model="ignoreCase" type="checkbox" />
        <span>忽略大小写</span>
      </label>
      <label class="diff-check">
        <input v-model="inlineChars" type="checkbox" />
        <span>字符级</span>
      </label>
      <label class="diff-check">
        <input v-model="syncScroll" type="checkbox" />
        <span>同步滚动</span>
      </label>
    </section>

    <ToolPanel left-title="原文" right-title="新内容">
      <template #left-actions>
        <ActionBar :items="actions" @action="handleAction" />
      </template>
      <CodeEditor v-model="left" language="plain" placeholder="粘贴原始文本…" />
      <template #right-actions>
        <span class="diff-side-stats">{{ result.leftStats.lines }} 行 / {{ result.rightStats.lines }} 行</span>
      </template>
      <CodeEditor v-model="right" language="plain" placeholder="粘贴对比文本…" />
    </ToolPanel>

    <p v-if="warning" class="notice notice-warn">
      <span aria-hidden="true">🐘</span>
      <span>{{ quips.diff.tooLarge }}（{{ (warning.bytes / 1024).toFixed(0) }} KB）</span>
    </p>

    <section v-if="isEmpty" class="card diff-empty">
      <p class="diff-empty__text">{{ statusText }}</p>
    </section>

    <template v-else>
      <div class="diff-stats">
        <span class="tag diff-stats__item diff-stats__item--add">+{{ summary.added }} 行</span>
        <span class="tag diff-stats__item diff-stats__item--del">-{{ summary.removed }} 行</span>
        <span class="tag diff-stats__item diff-stats__item--mod">~{{ summary.modified }} 行</span>
        <span class="diff-stats__status">{{ statusText }}</span>
      </div>

      <div v-if="viewMode === 'split'" class="diff-split">
        <div ref="leftPane" class="diff-pane" @scroll="onScroll('left')">
          <div v-for="(row, index) in result.rows" :key="index" class="diff-row">
            <span class="diff-row__no">{{ row.oldNumber ?? '' }}</span>
            <span class="diff-row__body" :class="cellClass(row.type, 'left')">
              <template v-for="(segment, i) in row.left?.segments ?? []" :key="i">
                <span class="diff-seg" :class="`diff-seg--${segment.type}`">{{ segment.text }}</span>
              </template>
            </span>
          </div>
        </div>

        <div ref="rightPane" class="diff-pane" @scroll="onScroll('right')">
          <div v-for="(row, index) in result.rows" :key="index" class="diff-row">
            <span class="diff-row__no">{{ row.newNumber ?? '' }}</span>
            <span class="diff-row__body" :class="cellClass(row.type, 'right')">
              <template v-for="(segment, i) in row.right?.segments ?? []" :key="i">
                <span class="diff-seg" :class="`diff-seg--${segment.type}`">{{ segment.text }}</span>
              </template>
            </span>
          </div>
        </div>
      </div>

      <ResultBox v-else :value="unifiedText" :placeholder="quips.diff.empty" mono />
    </template>
  </ToolShell>
</template>

<style scoped>
.diff-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
  padding: var(--sp-3);
}

.diff-check {
  display: inline-flex;
  gap: var(--sp-1);
  align-items: center;
  font-size: 12.5px;
  color: var(--text-sub);
  cursor: pointer;
}

.diff-check input {
  accent-color: var(--primary);
}

.diff-side-stats {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.diff-empty {
  padding: var(--sp-5);
}

.diff-empty__text {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.diff-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
}

.diff-stats__item--add {
  color: var(--diff-add);
  background: var(--diff-add-bg);
}

.diff-stats__item--del {
  color: var(--diff-del);
  background: var(--diff-del-bg);
}

.diff-stats__item--mod {
  color: var(--diff-mod);
  background: var(--diff-mod-bg);
}

.diff-stats__status {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}

/* ── 并排视图 ── */
.diff-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
}

.diff-pane {
  max-height: 52vh;
  overflow: auto;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.diff-row {
  display: flex;
  align-items: flex-start;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: var(--code-fg-size);
  line-height: 1.6;
}

.diff-row__no {
  flex: none;
  width: 40px;
  padding: 0 var(--sp-2);
  color: var(--text-muted);
  text-align: right;
  user-select: none;
}

.diff-row__body {
  flex: 1;
  min-width: 0;
  padding: 0 var(--sp-2);
  white-space: pre;
  color: var(--text-muted);
}

.diff-cell--void {
  background: var(--bg-subtle);
}

.diff-cell--add {
  color: var(--diff-add);
  background: var(--diff-add-bg);
}

.diff-cell--del {
  color: var(--diff-del);
  background: var(--diff-del-bg);
}

.diff-cell--mod {
  color: var(--text-main);
  background: var(--diff-mod-bg);
}

.diff-seg--same {
  color: inherit;
}

.diff-seg--added {
  color: var(--diff-add);
  background: var(--diff-add-bg);
  border-radius: 2px;
}

.diff-seg--removed {
  color: var(--diff-del);
  background: var(--diff-del-bg);
  border-radius: 2px;
  text-decoration: line-through;
  text-decoration-color: var(--diff-del);
}

@media (max-width: 880px) {
  .diff-split {
    grid-template-columns: 1fr;
  }

  .diff-pane {
    max-height: 40vh;
  }
}
</style>
