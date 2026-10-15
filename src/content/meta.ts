/**
 * 站点元信息 —— 全站唯一的身份来源
 */

export const site = {
  name: 'DevKit',
  alias: '码匠',
  /** 侧栏顶部副标题 */
  tagline: '程序员的小工具箱',
  /** 首页 hero 区一句话 */
  hero: '正经功能，欠揍文案',
  /** 首页 hero 区说明 */
  heroDesc: '所有计算都在你自己的浏览器里完成。我们看不到你的数据，也不想看到。',
  /** 页脚 */
  footer: '本地计算 · 零上传 · 无追踪',
  /** 默认标题，路由守卫会用 */
  titleTemplate: (page?: string) => (page ? `${page} · DevKit 码匠` : 'DevKit 码匠'),
} as const

/** 工具分组的显示名（正经文案，不参与玩梗） */
export const categoryNames = {
  encode: '编码转换',
  text: '文本处理',
  devops: '运维排错',
  security: '安全分析',
} as const
