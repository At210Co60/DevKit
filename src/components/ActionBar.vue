<script setup lang="ts">
import type { ActionItem } from './types'

/**
 * 操作按钮条 —— 工具的操作区统一走这里
 * 用数据描述而不是散落的按钮标签，方便置灰与键盘遍历。
 *
 * ActionItem 定义在 ./types.ts：放在 <script setup> 里外部无法 type-import，
 * 工具层只能各自复制一份（已经踩过这个坑）。
 */
export type { ActionItem }

withDefaults(defineProps<{ items: ActionItem[] }>(), {})

const emit = defineEmits<{ action: [key: string] }>()
</script>

<template>
  <div class="action-bar">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="btn"
      :class="{
        'btn-primary': item.kind === 'primary',
        'btn-ghost': item.kind === 'ghost',
      }"
      :disabled="item.disabled"
      @click="emit('action', item.key)"
    >
      <span v-if="item.icon" aria-hidden="true">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
}
</style>
