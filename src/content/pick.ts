/**
 * 语气开关 —— 恶搞人格的唯一总闸
 *
 * 设计要点：
 * 1. 每条文案都成对出现：[玩梗版, 正经版]
 * 2. 设 VITE_DEVKIT_TONE=off 后全站退回正经版，用于分享给同事
 * 3. 业务代码永远不写文案，一律 pick(['梗', '正经'])
 */

/**
 * 一对文案。第一个是玩梗版，第二个是正经版。
 */
export type Quip = readonly [playful: string, plain: string]

/** 当前是否启用玩梗语气 */
export const TONE_ENABLED: boolean = import.meta.env.VITE_DEVKIT_TONE !== 'off'

/** 按当前语气从文案对里取值 */
export function pick(q: Quip): string {
  return TONE_ENABLED ? q[0] : q[1]
}
