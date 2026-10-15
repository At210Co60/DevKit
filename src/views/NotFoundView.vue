<script setup lang="ts">
import { site, ui } from '@/content'

/** 404 —— 也是彩蛋路由 /tools/hello-world 的落点 */
</script>

<template>
  <div class="not-found">
    <p class="not-found__code">404</p>
    <h1 class="not-found__title">{{ ui.notFound.title }}</h1>
    <p class="not-found__desc">{{ ui.notFound.desc }}</p>
    <RouterLink to="/" class="btn btn-primary">{{ ui.notFound.action }}</RouterLink>
    <p class="not-found__foot">{{ site.footer }}</p>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.not-found__code {
  font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 56px;
  font-weight: 700;
  color: var(--border-strong);
  line-height: 1;
}

.not-found__title {
  font-size: 18px;
  font-weight: 600;
}

.not-found__desc {
  max-width: 360px;
  font-size: 13px;
  color: var(--text-sub);
}

.not-found__foot {
  margin-top: var(--sp-4);
  font-size: 12px;
  color: var(--text-muted);
}
</style>
