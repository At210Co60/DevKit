<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useEasterEggEngine } from '@/composables/useEasterEgg'

/**
 * 彩蛋宿主 —— 挂载所有触发器并渲染反馈
 *
 * 必须放在路由上下文内（BasicLayout 里），useRoute 才有效。
 * 所有彩蛋的 UI 都在这一个文件里，content/easter-eggs.ts 加新彩蛋时
 * 只有 action 已实现的情况才需要动这里。
 */
const { activeEgg, dismiss, titleOf } = useEasterEggEngine()

/** confetti 撒花的 emoji 池 */
const CONFETTI = ['🎉', '✨', '🎊', '💻', '⌬', '🐛', '🔥', '☕']
const confetti = ref<{ id: number; emoji: string; left: number; delay: number }[]>([])
let seed = 0

watch(activeEgg, (egg) => {
  if (egg?.action === 'confetti') {
    confetti.value = Array.from({ length: 28 }, () => ({
      id: seed++,
      emoji: CONFETTI[seed % CONFETTI.length],
      left: Math.round(Math.random() * 100),
      delay: Math.round(Math.random() * 400),
    }))
    setTimeout(() => {
      confetti.value = []
    }, 3200)
  }
})

const isHelloWorld = computed(() => activeEgg.value?.action === 'secret-page')
</script>

<template>
  <!-- 撒花 -->
  <Teleport to="body">
    <div v-if="confetti.length" class="confetti" aria-hidden="true">
      <span
        v-for="c in confetti"
        :key="c.id"
        class="confetti__bit"
        :style="{ left: c.left + '%', animationDelay: c.delay + 'ms' }"
      >
        {{ c.emoji }}
      </span>
    </div>
  </Teleport>

  <!-- 弹层 -->
  <Teleport to="body">
    <div v-if="activeEgg" class="egg" role="dialog" aria-modal="true" @click.self="dismiss">
      <div class="egg__panel card">
        <h2 class="egg__title">{{ titleOf(activeEgg) }}</h2>

        <div class="egg__body">
          <template v-if="activeEgg.action === 'about-modal'">
            <p>DevKit 码匠，v0.2.0。</p>
            <p>前身是某次线上事故复盘会上，那句没人接的「要不写个小工具吧」。</p>
            <p>目前共 <strong>7</strong> 个工具，全部本地计算，零上传。</p>
            <p>你刚才连点了 7 下，所以看到了这段没人想看的历史。</p>
          </template>

          <template v-else-if="isHelloWorld">
            <p class="egg__hello">Hello, world.</p>
            <p>第一个程序永远打的是这句，所以我们从这句开始。</p>
          </template>

          <template v-else-if="activeEgg.action === 'slacker-clock'">
            <p>你已经在这个 Cron 页面待了一会儿了。</p>
            <p>摸鱼要有始有终，别让下一个 Cron 表达式等太久。</p>
          </template>

          <p v-else>就这点彩蛋，不值得你按 10 个键。</p>
        </div>

        <button type="button" class="btn" @click="dismiss">关闭</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.egg {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
  background: rgb(0 0 0 / 45%);
}

.egg__panel {
  width: min(420px, 100%);
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  box-shadow: var(--shadow-lg);
}

.egg__title {
  font-size: 15px;
  font-weight: 600;
}

.egg__body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-sub);
}

.egg__hello {
  font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 18px;
  color: var(--primary);
}

.egg__panel .btn {
  align-self: flex-end;
}

.confetti {
  position: fixed;
  inset: 0;
  z-index: 101;
  pointer-events: none;
  overflow: hidden;
}

.confetti__bit {
  position: absolute;
  top: -40px;
  font-size: 20px;
  animation: fall 3s linear forwards;
}

@keyframes fall {
  to {
    transform: translateY(105vh) rotate(420deg);
    opacity: 0;
  }
}
</style>
