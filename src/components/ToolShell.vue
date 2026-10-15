<script setup lang="ts">
/**
 * 工具页外壳 —— 只负责页面骨架与顶部提示，内部布局由工具自己决定
 *
 * 不同工具形态差异很大（双栏 / 表单+列表 / 三栏对比），
 * 所以这里刻意不做「统一布局强约束」，只提供一致的头部与提示位。
 */
withDefaults(
  defineProps<{
    title: string
    tagline?: string
    /** 常驻提示条，用于隐私承诺、安全边界等不可省略的信息 */
    notice?: string
    noticeKind?: 'info' | 'warn' | 'danger' | 'success'
  }>(),
  { tagline: '', notice: '', noticeKind: 'info' },
)
</script>

<template>
  <section class="tool-shell">
    <header class="tool-shell__head">
      <div class="tool-shell__intro">
        <h1 class="tool-shell__title">{{ title }}</h1>
        <p v-if="tagline" class="tool-shell__tagline">{{ tagline }}</p>
      </div>
      <div v-if="$slots.actions" class="tool-shell__actions">
        <slot name="actions" />
      </div>
    </header>

    <p v-if="notice" class="notice" :class="`notice-${noticeKind}`">
      <slot name="notice-icon">🔒</slot>
      <span>{{ notice }}</span>
    </p>

    <div class="tool-shell__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tool-shell {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.tool-shell__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: flex-start;
  justify-content: space-between;
}

.tool-shell__intro {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tool-shell__title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.tool-shell__tagline {
  font-size: 13px;
  color: var(--text-sub);
}

.tool-shell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.tool-shell__body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
</style>
