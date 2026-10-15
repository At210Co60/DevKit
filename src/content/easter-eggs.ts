import type { Quip } from './pick'

/**
 * 彩蛋定义表 —— 新增彩蛋只在这里加一行，不改任何组件
 * 由 composables/useEasterEgg.ts 统一挂载
 */

export type EggTrigger =
  /** 键盘序列，如 Konami 码 */
  | { kind: 'key-sequence'; keys: string[] }
  /** 访问特定路由 */
  | { kind: 'route'; path: string }
  /** 同一元素连点 N 次 */
  | { kind: 'click-count'; selector: string; times: number }

export interface EasterEgg {
  id: string
  trigger: EggTrigger
  /** 彩蛋标题，同样成对（玩梗版 / 正经版） */
  title: Quip
  /** 触发后的动作标识，交给 useEasterEgg 分发 */
  action: 'confetti' | 'about-modal' | 'slacker-clock' | 'secret-page'
}

export const easterEggs: readonly EasterEgg[] = [
  {
    id: 'konami',
    trigger: {
      kind: 'key-sequence',
      keys: [
        'ArrowUp',
        'ArrowUp',
        'ArrowDown',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'ArrowLeft',
        'ArrowRight',
        'b',
        'a',
      ],
    },
    action: 'confetti',
    title: ['恭喜解锁成就：手速检测器已爆表', 'Konami 码已识别'],
  },
  {
    id: 'logo-x7',
    trigger: { kind: 'click-count', selector: '[data-egg="logo"]', times: 7 },
    action: 'about-modal',
    title: ['你连点 7 下logo，图什么呢', '码匠秘史'],
  },
  {
    id: 'slacker',
    trigger: { kind: 'route', path: '/tools/cron' },
    action: 'slacker-clock',
    title: ['上班时间不摸鱼，来这儿算下一个 Cron？', '摸鱼计时器'],
  },
  {
    id: 'hello-world',
    trigger: { kind: 'route', path: '/tools/hello-world' },
    action: 'secret-page',
    title: ['第一个吐司，永远是 Hello World', 'Hello World'],
  },
] as const

export function findEggById(id: string): EasterEgg | undefined {
  return easterEggs.find((e) => e.id === id)
}
