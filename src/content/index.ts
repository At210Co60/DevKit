/**
 * 文案层统一出口
 *
 * 业务代码只允许从 '@/content' 取文案，禁止在组件里直接写中文吐槽。
 * 这样「关掉玩梗」只需要设 VITE_DEVKIT_TONE=off，不需要改任何组件。
 */

export { site, categoryNames } from './meta'
export { ui } from './strings'
export { quips } from './quips'
export { easterEggs, findEggById } from './easter-eggs'
export type { EasterEgg, EggTrigger } from './easter-eggs'
export { pick, TONE_ENABLED } from './pick'
export type { Quip } from './pick'
