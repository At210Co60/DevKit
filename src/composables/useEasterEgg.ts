import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { easterEggs, pick, type EasterEgg } from '@/content'

/**
 * 彩蛋触发引擎
 *
 * 全部逻辑集中在这里。content/easter-eggs.ts 加一行就是新增一个彩蛋，
 * 不用碰任何组件 —— 这是「彩蛋不侵入业务代码」的兑现方式。
 */

const activeEgg = ref<EasterEgg | null>(null)

/** 当前触发的彩蛋，供 App.vue 决定弹什么 */
export function useEasterEgg() {
  return { activeEgg }
}

function matchesSequence(target: string[], pressed: string[]): boolean {
  if (pressed.length < target.length) return false
  const tail = pressed.slice(-target.length)
  return tail.every((k, i) => k.toLowerCase() === target[i].toLowerCase())
}

export function useEasterEggEngine() {
  const route = useRoute()
  const buffer: string[] = []
  const counters = new Map<string, number>()

  function onKeydown(e: KeyboardEvent) {
    buffer.push(e.key)
    if (buffer.length > 10) buffer.shift()

    for (const egg of easterEggs) {
      if (egg.trigger.kind !== 'key-sequence') continue
      if (matchesSequence(egg.trigger.keys, buffer)) {
        trigger(egg)
        buffer.length = 0
        return
      }
    }
  }

  function onClick(e: MouseEvent) {
    const target = e.target
    if (!(target instanceof Element)) return

    for (const egg of easterEggs) {
      if (egg.trigger.kind !== 'click-count') continue
      const el = target.closest(egg.trigger.selector)
      if (!el) continue

      const count = (counters.get(egg.id) ?? 0) + 1
      counters.set(egg.id, count)
      if (count >= egg.trigger.times) {
        counters.set(egg.id, 0)
        trigger(egg)
      }
      return
    }
  }

  function checkRoute(path: string) {
    for (const egg of easterEggs) {
      if (egg.trigger.kind === 'route' && egg.trigger.path === path) {
        trigger(egg)
        return
      }
    }
  }

  function trigger(egg: EasterEgg) {
    activeEgg.value = egg
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('click', onClick, true)
    checkRoute(route.path)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    document.removeEventListener('click', onClick, true)
  })

  return {
    activeEgg,
    /** 外部主动关闭弹层 */
    dismiss: () => {
      activeEgg.value = null
    },
    /** 彩蛋标题（已按当前语气取文案） */
    titleOf: (egg: EasterEgg) => pick(egg.title),
  }
}
