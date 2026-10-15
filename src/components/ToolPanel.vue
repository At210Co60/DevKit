<script setup lang="ts">
/**
 * 双栏容器 —— 左输入右输出的通用骨架
 *
 * 窄屏（≤880px）自动堆叠，工具内部无需写响应式。
 */
withDefaults(
  defineProps<{
    leftTitle?: string
    rightTitle?: string
    /** 强制上下堆叠，用于本身就纵向的布局 */
    stacked?: boolean
  }>(),
  { leftTitle: '', rightTitle: '', stacked: false },
)
</script>

<template>
  <div class="tool-panel" :class="{ 'tool-panel--stacked': stacked }">
    <div class="tool-panel__col">
      <div v-if="leftTitle || $slots.leftActions" class="tool-panel__bar">
        <span class="tool-panel__label">{{ leftTitle }}</span>
        <div class="tool-panel__bar-actions">
          <slot name="left-actions" />
        </div>
      </div>
      <slot name="left" />
    </div>

    <div class="tool-panel__col">
      <div v-if="rightTitle || $slots.rightActions" class="tool-panel__bar">
        <span class="tool-panel__label">{{ rightTitle }}</span>
        <div class="tool-panel__bar-actions">
          <slot name="right-actions" />
        </div>
      </div>
      <slot name="right" />
    </div>
  </div>
</template>

<style scoped>
.tool-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
  align-items: start;
}

.tool-panel--stacked {
  grid-template-columns: 1fr;
}

.tool-panel__col {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 0;
}

.tool-panel__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  min-height: 28px;
}

.tool-panel__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tool-panel__bar-actions {
  display: flex;
  gap: var(--sp-1);
}

@media (max-width: 880px) {
  .tool-panel {
    grid-template-columns: 1fr;
  }
}
</style>
