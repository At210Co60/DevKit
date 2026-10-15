<script setup lang="ts">
import { computed, ref } from 'vue'

import { categoryNames, site, ui } from '@/content'
import { searchTools, toolsByCategory } from '@/tools/registry'
import { TOOL_CATEGORIES, type ToolCategory, type ToolDefinition } from '@/tools/registry'

/** 首页 —— 卡片网格完全由 registry 派生，加工具这里自动出现 */

const query = ref('')

const grouped = computed(() => {
  if (query.value.trim()) {
    const hits = searchTools(query.value)
    return hits.length ? [['全部', hits] as [string, ToolDefinition[]]] : []
  }
  return [...toolsByCategory()].map(
    ([cat, tools]) => [categoryNames[cat as ToolCategory], tools] as [string, ToolDefinition[]],
  )
})

const total = TOOL_CATEGORIES.reduce((n, c) => n + (toolsByCategory().get(c)?.length ?? 0), 0)
</script>

<template>
  <div class="home">
    <section class="hero">
      <h1 class="hero__title">{{ site.hero }}</h1>
      <p class="hero__desc">{{ site.heroDesc }}</p>
      <p class="hero__count">{{ ui.home.toolCount(total) }}</p>

      <div class="search">
        <span class="search__icon" aria-hidden="true">🔍</span>
        <input
          v-model="query"
          type="search"
          class="search__input"
          :placeholder="ui.home.searchPlaceholder"
          :aria-label="ui.home.searchPlaceholder"
        />
      </div>
    </section>

    <section class="privacy card">
      <h2 class="privacy__title">{{ ui.home.privacyTitle }}</h2>
      <p class="privacy__desc">{{ ui.home.privacyDesc }}</p>
    </section>

    <p v-if="grouped.length === 0" class="empty">{{ ui.home.emptyResult }}</p>

    <section v-for="[name, tools] in grouped" :key="name" class="group">
      <h2 class="group__title">{{ name }}</h2>
      <div class="grid">
        <RouterLink v-for="tool in tools" :key="tool.id" :to="`/tools/${tool.id}`" class="tool-card card">
          <span class="tool-card__icon" aria-hidden="true">{{ tool.icon }}</span>
          <span class="tool-card__name">
            {{ tool.name }}
            <span v-if="tool.status !== 'stable'" class="tag" :class="`tag-${tool.status}`">
              {{ tool.status.toUpperCase() }}
            </span>
          </span>
          <span class="tool-card__tagline">{{ tool.tagline }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}

/* ---- Hero ---- */
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-6) 0 var(--sp-2);
}

.hero__title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.hero__desc {
  max-width: 520px;
  font-size: 14px;
  color: var(--text-sub);
  line-height: 1.7;
}

.hero__count {
  font-size: 12px;
  color: var(--text-muted);
}

/* ---- 搜索 ---- */
.search {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 420px;
  margin-top: var(--sp-3);
}

.search__icon {
  position: absolute;
  left: 12px;
  font-size: 13px;
  opacity: 0.6;
  pointer-events: none;
}

.search__input {
  width: 100%;
  padding: 9px 12px 9px 34px;
  font-size: 13px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  transition: border-color var(--t-fast) var(--ease);
}

.search__input:focus {
  border-color: var(--primary);
  outline: none;
}

/* ---- 隐私声明 ---- */
.privacy {
  padding: var(--sp-4);
}

.privacy__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--sp-1);
}

.privacy__desc {
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.7;
}

/* ---- 分组与卡片 ---- */
.group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.group__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--sp-3);
}

.tool-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-4);
  color: inherit;
  transition:
    border-color var(--t-fast) var(--ease),
    box-shadow var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}

.tool-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.tool-card__icon {
  font-size: 20px;
  line-height: 1;
  margin-bottom: var(--sp-1);
}

.tool-card__name {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: 14px;
  font-weight: 600;
}

.tool-card__tagline {
  font-size: 12.5px;
  color: var(--text-sub);
  line-height: 1.6;
}

.empty {
  padding: var(--sp-6);
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

@media (max-width: 720px) {
  .hero__title {
    font-size: 22px;
  }
}
</style>
