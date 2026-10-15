<script setup lang="ts">
import { onMounted, shallowRef, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'

import { ui } from '@/content'
import { recordVisit } from '@/composables/useToolHistory'
import { getToolById } from '@/tools/registry'
import NotFoundView from '@/views/NotFoundView.vue'

/**
 * 通用工具容器 —— 所有 /tools/:id 都走这里
 *
 * 职责：从注册表按 id 取工具 → 懒加载它的组件 → 挂载。
 * 不认识任何具体工具，所以加工具时这个文件永远不用改。
 */
const route = useRoute()

const toolComponent = shallowRef<Component | null>(null)
const loading = shallowRef(false)
const found = shallowRef(true)

async function load(id: string) {
  loading.value = true
  found.value = false
  toolComponent.value = null

  const tool = getToolById(id)
  if (!tool) {
    loading.value = false
    return
  }

  found.value = true
  recordVisit(tool.id)

  try {
    const mod = await tool.component()
    toolComponent.value = mod.default
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  (id) => {
    if (typeof id === 'string') void load(id)
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof route.params.id === 'string') void load(route.params.id)
})
</script>

<template>
  <component :is="toolComponent" v-if="toolComponent" />

  <div v-else-if="loading" class="tool-loading" role="status" aria-live="polite">
    {{ ui.common.working }}
  </div>

  <NotFoundView v-else-if="!found" />

  <div v-else class="tool-loading">{{ ui.common.working }}</div>
</template>

<style scoped>
.tool-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
