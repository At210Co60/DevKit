<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { categoryNames, site } from '@/content'
import EasterEggHost from '@/components/EasterEggHost.vue'
import { usePrefs } from '@/stores/prefs'
import { toolsByCategory } from '@/tools/registry'
import { TOOL_CATEGORIES, type ToolCategory } from '@/tools/registry'

/** 布局 —— 侧栏菜单由 registry 派生，加工具这里自动出现 */
const route = useRoute()
const prefs = usePrefs()

const themeIcon = computed(() => (prefs.theme === 'system' ? '🌗' : prefs.theme === 'light' ? '☀️' : '🌙'))
const themeLabel = computed(() =>
  prefs.theme === 'system' ? '跟随系统' : prefs.theme === 'light' ? '浅色主题' : '深色主题',
)

const groups = computed(() =>
  TOOL_CATEGORIES.map((cat) => ({
    category: cat,
    name: categoryNames[cat as ToolCategory],
    tools: toolsByCategory().get(cat) ?? [],
  })).filter((g) => g.tools.length > 0),
)

const activeId = computed(() => (route.name === 'tool' ? String(route.params.id) : ''))
</script>

<template>
  <div class="layout">
    <header class="header">
      <RouterLink to="/" class="header__brand">
        <span class="header__logo" data-egg="logo" aria-hidden="true">⌬</span>
        <span class="header__names">
          <strong class="header__name">{{ site.name }}</strong>
          <span class="header__tagline">{{ site.tagline }}</span>
        </span>
      </RouterLink>
      <div class="header__right">
        <span class="header__footer">{{ site.footer }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :aria-label="themeLabel"
          :title="themeLabel"
          @click="prefs.cycleTheme()"
        >
          <span aria-hidden="true">{{ themeIcon }}</span>
        </button>
      </div>
    </header>

    <div class="body">
      <nav class="sidebar" :aria-label="site.tagline">
        <RouterLink to="/" class="sidebar__item" :class="{ 'sidebar__item--active': route.name === 'home' }">
          {{ site.name }}
        </RouterLink>

        <div v-for="g in groups" :key="g.category" class="sidebar__group">
          <p class="sidebar__group-title">{{ g.name }}</p>
          <RouterLink
            v-for="tool in g.tools"
            :key="tool.id"
            :to="`/tools/${tool.id}`"
            class="sidebar__item"
            :class="{ 'sidebar__item--active': activeId === tool.id }"
          >
            <span class="sidebar__icon" aria-hidden="true">{{ tool.icon }}</span>
            <span>{{ tool.name }}</span>
          </RouterLink>
        </div>
      </nav>

      <main class="main">
        <RouterView />
      </main>
    </div>

    <EasterEggHost />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ---- Header ---- */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  height: var(--header-h);
  padding: 0 var(--sp-5);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header__brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: inherit;
}

.header__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-size: 18px;
  color: var(--primary-contrast);
  background: var(--primary);
  border-radius: var(--r-md);
  cursor: pointer;
  user-select: none;
}

.header__names {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
}

.header__name {
  font-size: 15px;
  letter-spacing: -0.01em;
}

.header__tagline {
  font-size: 12px;
  color: var(--text-muted);
}

.header__right {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.header__footer {
  font-size: 11.5px;
  color: var(--text-muted);
}

/* ---- Body ---- */
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ---- Sidebar ---- */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  width: var(--sidebar-w);
  padding: var(--sp-4) var(--sp-3);
  overflow-y: auto;
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar__group {
  margin-top: var(--sp-4);
}

.sidebar__group-title {
  margin-bottom: var(--sp-1);
  padding-left: 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 6px 10px;
  font-size: 13px;
  color: var(--text-sub);
  border-radius: var(--r-md);
  transition:
    background var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease);
}

.sidebar__item:hover {
  color: var(--text-main);
  background: var(--bg-subtle);
}

.sidebar__item--active {
  color: var(--primary);
  font-weight: 500;
  background: var(--primary-light);
}

.sidebar__icon {
  font-size: 13px;
  width: 16px;
  text-align: center;
}

/* ---- Main ---- */
.main {
  flex: 1;
  min-width: 0;
  padding: var(--sp-5);
  overflow-y: auto;
}

/* ---- 窄屏：侧栏转横向滚动条 ---- */
@media (max-width: 720px) {
  .header {
    padding: 0 var(--sp-4);
  }

  .header__footer {
    display: none;
  }

  .body {
    flex-direction: column;
  }

  .sidebar {
    flex-direction: row;
    width: auto;
    padding: var(--sp-2) var(--sp-3);
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .sidebar__group {
    display: flex;
    gap: var(--sp-1);
    margin-top: 0;
  }

  .sidebar__group-title {
    display: none;
  }

  .sidebar__item {
    white-space: nowrap;
  }

  .main {
    padding: var(--sp-4);
  }
}
</style>
