# DevKit / 码匠 —— 架构决策文档

> **状态**：已定稿（v1.0）
> **定稿日期**：2026-10-15
> **适用版本**：v0.2.0 起
> **性质**：本文件是架构的唯一事实来源（single source of truth）。任何与本文件冲突的临场决策，先改本文件。

---

## 0. 一句话定位

**DevKit / 码匠 = 一个正经好用、但说话很欠的程序员小工具集。**
功能上完全可信（纯本地计算、零上传、可离线），人格上持续玩梗。

**核心约束**：玩梗绝不能侵入功能代码。所有梗集中在 `src/content/`，可一键关闭。

---

## 1. 已确认的决策（2026-10-15）

| 维度 | 决策 | 影响 |
|---|---|---|
| 产品形态 | **纯 Web 静态 SPA**（后续可加 PWA 离线） | 不引入任何原生桥接层，不引入 Electron/Tauri |
| 恶搞调性 | **中度**：独立 `content/` 模块 + 彩蛋系统 | 文案集中管理，不散落在组件里 |
| 质量基建 | **A 档起步 → C 档收口** | 现在上 ESLint+Prettier+Vitest，架构按 C 档预留免迁移 |
| UI 组件库 | **不引入**（手写 CSS + design token） | 见 §5.2，这是本方案最关键的一条取舍 |

**运行环境已核实**：Node v24.15.0 / npm 11.12.1 / git 2.54.0（Windows）。Node 24 意味着可以使用原生 TypeScript 剥离、稳定的 `Intl`、原生 fetch，无需额外 polyfill。

---

## 2. 现状体检（v0.1.0 实测）

在动手前必须承认的问题，按严重度排序：

| # | 问题 | 严重度 | 说明 |
|---|---|---|---|
| 1 | **路由三处硬编码** | 🔴 高 | 7 条路由写死在 `router/index.ts`；侧栏菜单在 `BasicLayout.vue`；首页卡片在 `views/home/index.vue`。加第 7 个工具要改 3 个文件，漏一处就是半成品 |
| 2 | **业务代码为零** | 🔴 高 | 6 个工具页各 532–600 字节，共用 3.8KB 的 `ToolPlaceholder`。功能层面没有任何一行逻辑 |
| 3 | **依赖与代码脱节** | 🟡 中 | `codemirror` / `cron-parser` / `diff` / `pinia` 已进 `package.json` 但零 import。要么用起来要么删掉，不能悬着 |
| 4 | **零质量基建** | 🟡 中 | 无 ESLint / Prettier / Vitest / CI |
| 5 | **无 git 仓库** | 🟡 中 | `.gitignore` 已写好但未 `init`，改错了无法回滚 |
| 6 | **无 README / LICENSE** | 🟢 低 | 准备公开发布时要补 |
| 7 | 依赖版本激进 | 🟢 低 | Vite ^8.3 / TS ~6.0 / npm 11，务必提交 `package-lock.json` |

**结论**：骨架可用但不可扩展。v0.2.0 的核心任务不是"实现 6 个工具"，而是**先把注册表机制建起来**，再实现工具。

---

## 3. 文件框架（目录结构）

### 3.1 设计原则

1. **工具自包含** —— 一个工具的所有文件在 `src/tools/<id>/` 一个文件夹内，删掉这个文件夹等于彻底移除该工具。
2. **三层分离** —— 每个工具强制拆成纯逻辑 / 状态编排 / 视图渲染三层（见 §4.2）。这是测试成本和未来复用能力的唯一来源。
3. **单向依赖** —— `app → views → components → composables → utils`，反向依赖一律禁止。
4. **梗与功能隔离** —— 业务代码永远不写中文吐槽，一律从 `content/` 取。

### 3.2 完整目录树

```
devkit/
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── main.ts                     # 入口：只做装配，零业务
│   │
│   ├── app/                        # ══ 装配层 ══
│   │   ├── App.vue
│   │   ├── router.ts               # 由 registry 生成路由，零手写路径
│   │   └── plugins.ts              # pinia / CodeMirror 主题等插件注册
│   │
│   ├── tools/                      # ══ 工具区（加工具只动这里）══
│   │   ├── registry.ts             # ★ 工具注册表 —— 全站唯一清单
│   │   ├── shared.ts               # ToolDefinition 类型契约
│   │   ├── json/
│   │   │   ├── index.ts            # 导出 ToolDefinition（唯一出口）
│   │   │   ├── core.ts             # 纯函数：格式化 / 压缩 / 错误定位
│   │   │   ├── useJsonTool.ts      # 响应式状态编排
│   │   │   ├── JsonTool.vue        # 仅渲染
│   │   │   └── __tests__/core.test.ts
│   │   ├── base64/
│   │   │   ├── index.ts
│   │   │   ├── core.ts             # UTF-8 安全的编解码 + URL-safe
│   │   │   ├── useBase64Tool.ts
│   │   │   ├── Base64Tool.vue
│   │   │   └── __tests__/core.test.ts
│   │   ├── url/        { index, core, useUrlTool, UrlTool.vue, __tests__ }
│   │   ├── cron/       { index, core, useCronTool, CronTool.vue, __tests__ }
│   │   ├── timestamp/  { index, core, useTimestampTool, TimestampTool.vue, __tests__ }
│   │   ├── codec/                # ★ 解码 / 解密工作台（重型，独立 chunk）
│   │   │   ├── index.ts
│   │   │   ├── sniffer.ts        # 类型自动嗅探（同步纯函数）
│   │   │   ├── core.ts           # 解码编解码（同步）
│   │   │   ├── crypto.ts         # 加解密（异步，Web Crypto API）
│   │   │   ├── useCodecTool.ts   # 多结果编排 + 深度上限控制
│   │   │   ├── CodecTool.vue
│   │   │   └── __tests__/        # sniffer/core/crypto 各一份
│   │   └── diff/       { index, core, useDiffTool, DiffTool.vue, __tests__ }
│   │
│   ├── components/                 # ══ 跨工具复用 UI ══
│   │   ├── ToolShell.vue           # 工具页统一外壳（取代 ToolPlaceholder）
│   │   ├── ToolPanel.vue           # 左右双栏输入/输出容器
│   │   ├── ActionBar.vue           # 操作按钮组（复制/清空/示例）
│   │   ├── CodeEditor.vue          # CodeMirror 6 封装（业务不直接碰 CodeMirror）
│   │   ├── ResultBox.vue           # 输出区（含错误态）
│   │   └── IconBase.vue            # 图标基础组件
│   │
│   ├── layouts/
│   │   └── BasicLayout.vue         # Header + Sidebar + 内容区（数据来自 registry）
│   │
│   ├── views/
│   │   ├── HomeView.vue            # 卡片网格（数据来自 registry）
│   │   ├── ToolsView.vue           # /tools/:id 通用容器，动态解析工具
│   │   └── NotFoundView.vue
│   │
│   ├── content/                    # ══ 文案层（恶搞唯一来源）══
│   │   ├── index.ts                # 统一出口 + 类型
│   │   ├── strings.ts              # 全站 UI 文案
│   │   ├── quips.ts                # 各工具的吐槽（加载中/成功/失败）
│   │   ├── easter-eggs.ts          # 彩蛋定义表
│   │   └── meta.ts                 # 站点元信息（站名/副标题/描述）
│   │
│   ├── composables/
│   │   ├── useClipboard.ts         # 复制 + 降级提示
│   │   ├── useEasterEgg.ts         # 彩蛋触发引擎
│   │   ├── useToolHistory.ts       # 最近使用（localStorage）
│   │   └── useDebounced.ts         # 输入防抖（工具高频需求）
│   │
│   ├── stores/
│   │   └── prefs.ts                # Pinia：主题/最近使用/偏好
│   │
│   ├── utils/                      # ══ 无业务、无 Vue 依赖的纯工具 ══
│   │   ├── base64.ts
│   │   ├── bytes.ts                # Uint8Array ↔ 各文本编码互转（codec 的地基）
│   │   ├── encoding.ts             # Hex / Binary / Octal / Unicode 转义
│   │   ├── charset.ts              # GBK / UTF-8 乱码检测与修复
│   │   ├── format.ts
│   │   └── json-error.ts           # JSON 错误位置定位
│   │
│   ├── styles/
│   │   ├── tokens.css              # 设计 token（颜色/间距/圆角/阴影）
│   │   ├── reset.css
│   │   └── main.css
│   │
│   └── types/
│       └── tool.ts                 # ToolDefinition 契约（严格）
│
├── tests/                          # 跨工具集成测试（非单文件测试放这）
├── ARCHITECTURE.md                 # 本文件
├── CONTRIBUTING.md                 # 加一个工具的 SOP
└── CHANGELOG.md                    # v1.0.0 起启用
```

### 3.3 关键路径说明

| 目录 | 能否被业务代码直接依赖 |
|---|---|
| `src/utils/` | ✅ 任意层，但**不得含业务语义**（只写"怎么算"，不写"算完给谁看"） |
| `src/content/` | ✅ 任意层，但只能取用，不得修改 |
| `src/components/` | ✅ 视图层可用；`tools/*/core.ts` 禁用 |
| `src/app/` | ❌ 仅 `main.ts` 与 `App.vue` 触碰 |

---

## 4. 代码框架（架构模式）

### 4.1 核心机制：工具注册表（Manifest-driven）

**这是整个架构的支点。** 它一次性消灭"加工具改三处"的问题。

```ts
// src/tools/shared.ts
import type { Component } from 'vue'

export type ToolStatus = 'stable' | 'beta' | 'wip'
export type ToolCategory = 'encode' | 'text' | 'devops' | 'security'

export interface ToolDefinition {
  /** 唯一 id，同时是 URL 片段：/tools/json */
  id: string
  /** 侧栏与卡片显示名 */
  name: string
  /** 一句话说明，卡片副标题 */
  tagline: string
  /** 图标（emoji 或 SVG path） */
  icon: string
  /** 分组，用于侧栏折叠与首页分区 */
  category: ToolCategory
  /** 搜索关键词 */
  keywords: string[]
  /** 成熟度，决定卡片角标 */
  status: ToolStatus
  /** 工具页组件，必须懒加载 */
  component: () => Promise<{ default: Component }>
}
```

```ts
// src/tools/registry.ts —— 全站唯一的工具清单
import type { ToolDefinition } from './shared'
import { defineTool } from './define'

export const TOOLS: ToolDefinition[] = [
  defineTool('json',    { name: 'JSON 格式化', category: 'text',    icon: '{}'  }, () => import('./json')),
  defineTool('base64',  { name: 'Base64',      category: 'encode',  icon: '🔐' }, () => import('./base64')),
  defineTool('url',     { name: 'URL 编解码',  category: 'encode',  icon: '🔗' }, () => import('./url')),
  defineTool('cron',    { name: 'Cron 表达式',  category: 'devops',  icon: '⏰' }, () => import('./cron')),
  defineTool('timestamp', { name: '时间戳',    category: 'devops',  icon: '📅' }, () => import('./timestamp')),
  defineTool('diff',    { name: '文本 Diff',   category: 'text',    icon: '🔍' }, () => import('./diff')),
]
```

**注册表被四处消费，零重复**：

```
                    ┌──────────────────────┐
                    │  tools/registry.ts   │
                    │  （唯一清单）          │
                    └──────────┬───────────┘
         ┌─────────────┬───────┴────────┬──────────────┐
         ▼             ▼                ▼              ▼
    app/router.ts  BasicLayout.vue  HomeView.vue   未来：搜索/命令面板
      生成路由        生成侧栏          生成卡片
```

### 4.2 三层分离（每个工具强制）

```ts
// ── 第 1 层：core.ts ── 纯函数，零 Vue、零 DOM、零副作用
// 可被 Vitest 直接测，未来可原样搬到 CLI / Worker / 桌面端
export function formatJson(input: string, indent = 4): Result<string> { ... }

// ── 第 2 层：useXxxTool.ts ── 组合式状态，只做编排，不做计算
export function useJsonTool() {
  const input = ref('')
  const output = computed(() => formatJson(input.value))  // 复用 core
  return { input, output }
}

// ── 第 3 层：XxxTool.vue ── 只渲染，不含 if-else 业务分支
```

**为什么强制三层**：
- `core.ts` 有类型 + 有单测 = 工具逻辑**可证明正确**，这是唯一能自动化的质量面
- 输入边打字边算的响应式性能问题只存在于第 2 层，用 `useDebounced` 统一解决
- 未来若要做桌面版 / CLI，第 1 层**一行不用改**

#### core 层的两条硬约定

**约定一：禁止自己实现加密算法。**
`core.ts` / `crypto.ts` 一律调用浏览器原生 **Web Crypto API**。任何需要手写 AES / DES / RSA 的场景都不做——宁可标注"不支持"，也不引入自研密码学。自研实现是本项目**绝对的红线**。

> 已实测确认（Node 24）：`SubtleCrypto` 支持 SHA-1/256/384/512、AES-CBC/GCM/CTR/KW、RSA-OAEP/PKCS1v1.5、PBKDF2、HKDF；
> **不支持 MD5，也不支持 DES/3DES**。codec 工具遇到这三者一律显式说明不可用及原因。

**约定二：允许异步，但禁止副作用。**
默认写同步纯函数。只有必须走 Web Crypto（本质是异步）的模块才写 `async`，且必须满足：
- 不读写 DOM、不碰 `window`、不发送网络请求
- 相同输入 → 相同输出（可测）
- 测试环境可直接调用（Node 24 内置 `globalThis.crypto`，与浏览器同源，无需 mock）

异步 core 在 `useXxxTool.ts` 里统一收敛成 `ref` + `watch` 触发，组件层感知不到 await。

### 4.3 文案层（恶搞的隔离带）

```ts
// src/content/quips.ts
export const quips = {
  json: {
    loading: '正在给 JSON 梳头…',
    success: '整形完毕，这段 JSON 现在体面多了',
    empty:   '你倒是贴点东西进来啊',
    error:   '这 JSON 自己都承认它坏了',
  },
  base64: { loading: '正在把它塞进保险箱…', /* ... */ },
}
```

**硬性规则**：
1. `.vue` 文件里**不允许**出现中二或吐槽文案，一律 `import { quips } from '@/content'`
2. 站点提供 `VITE_DEVKIT_TONE=off` 开关，一键退回纯专业 UI（这是给"分享给同事时"的体面开关）
3. `content/` 只允许被读取，不允许被工具反向修改

### 4.4 彩蛋系统

```ts
// src/content/easter-eggs.ts
export const eggs = [
  { id: 'konami',   trigger: 'keydown-sequence', value: '↑↑↓↓←→←→BA', reward: '全站彩带雨' },
  { id: 'version',  trigger: 'click',           target: 'footer-logo', count: 7, reward: '码匠秘史浮层' },
  { id: 'coffee',   trigger: 'route',           path: '/tools/cron',  reward: '摸鱼计时器' },
]
```

由 `composables/useEasterEgg.ts` 统一挂载。新增彩蛋 = 在数组加一行，不改任何组件。

---

## 5. 技术栈

### 5.1 选型总表

| 层 | 选型 | 版本 | 决策理由 |
|---|---|---|---|
| 框架 | Vue | ^3.5 | 工具页面是**高交互密度表单**，组合式 API 的逻辑复用收益最大 |
| 语言 | TypeScript | ~6.0 | 工具集本质是**字符串处理**，类型是最主要防线 |
| 构建 | Vite | ^8.3 | 现状沿用，冷启动快 |
| 路由 | Vue Router | ^4.6 | 现状沿用 |
| 状态 | Pinia | ^3.0 | **仅用于跨工具**（偏好、最近使用）。单工具状态一律用 `ref` |
| 编辑器 | CodeMirror 6 | ^6.0 | JSON / Diff 需要行号 + 语法高亮，CodeMirror 6 的模块化比 Monaco 更轻 |
| Cron | cron-parser | **锁定 4.9.x** | ⚠️ 见 §5.3 风险登记。实测结论：4.9 **原生支持六段式（首段秒）**；不支持的是 `@annually`/`@midnight`/`@reboot`/`@every 1h` 这几个别名；`?`、`L`、`5#3` 是支持的 |
| Diff | diff | ^5.2 | 字符级 diff 成熟稳定 |
| 测试 | Vitest | **^5.x** | 与 Vite 同源，零配置，`tsconfig.app.json` 已预留 `__tests__` 排除规则 |
| Lint | ESLint | **^10.x**（flat config） | ESLint 10 起 `@eslint/js` 同步到 v10；加载 TS 配置需额外装 `jiti` |
| 格式 | Prettier | ^3.x | 与 ESLint 分工：Prettier 管格式，ESLint 管质量 |
| 样式 | 原生 CSS + CSS 变量 | — | 见 §5.2 |
| PWA（v0.3+） | vite-plugin-pwa | ^1.x | 可选，延后 |

### 5.2 关键取舍：不引入 UI 组件库

**决定：不用 Element Plus / Naive UI / Ant Design Vue。**

| 维度 | 引入组件库 | 手写 CSS（本方案） |
|---|---|---|
| 双栏编辑器布局 | 需大量 `#deep` 覆写，改造成本高 | 直接写，20 行搞定 |
| 体积 | +80~300KB | +0 |
| 主题定制（恶搞需要非标准视觉） | 处处对抗组件库设计语言 | 完全自由 |
| 学习成本 | 需额外学组件库 API | 无 |
| 维护成本 | 组件库大版本升级可能 break | 零依赖风险 |

**判断依据**：这类工具站的 UI 高度定制化（左右分栏、粘性操作条、可拖拽分割），组件库的 80% 能力都用不上，只会在 20% 的地方增加阻力。CSS 变量已经在 `main.css` 里立好了体系，顺着 `tokens.css` 扩展即可。

**代价**：表单控件（输入框、下拉框、模态框）要手写。缓解办法：`components/` 里沉淀 6–8 个原子组件，之后就不重复造了。

### 5.3 风险登记

| 风险 | 等级 | 处置 |
|---|---|---|
| Vite 8 / TS 6 / npm 11 版本激进，生态包可能未适配 | 🟡 | **必须提交 `package-lock.json`**；升级前先跑 `npm run check` |
| `cron-parser` 4.x → 5.x 是破坏性变更（API 从函数改为 class） | 🟡 | **锁死 4.9.x**，升级时只改 `tools/cron/core.ts` 一个文件 |
| **`cron-parser` 4.9 会就地修改传入的 `options` 对象** | 🔴 高 | `parseExpression` 内部的 `parseNthDay` 会把 `#` 的结果写回 `options.nthDayOfWeek`。**复用同一个 options 字面量会让之后每一次解析都被静默污染**，表现为莫名其妙的 `loop limit exceeded`。`tools/cron/core.ts` 每次调用都新建 options，并已加回归测试锁死这个行为 |
| CodeMirror 6 无官方 Vue 封装 | 🟢 | 只在 `components/CodeEditor.vue` 一处封装，业务只碰封装 |
| `dist/` 已被构建但无版本管理 | 🟡 | v0.2.0 第一件事 `git init` |
| **Web Crypto 不支持 DES / 3DES，也不支持 MD5** | 🟡 | 浏览器原生只提供 AES（CBC/GCM/CTR/KW）、RSA（OAEP/PKCS1v1.5）、HMAC、PBKDF2、HKDF 与 SHA-1/256/384/512。**MD5 与 DES 系列都要明确标注不支持并说明原因**，绝不用不安全的纯 JS 实现顶替 |
| **RSA 老式 PKCS#1 私钥（`BEGIN RSA PRIVATE KEY`）无法原生导入** | 🟡 | Web Crypto 只吃 PKCS#8。第一版仅支持 PKCS#8；PKCS#1 转换列入 v0.3，若要支持须引 `@noble/*` 或 `node-forge`，需单独评估体积与安全 |
| **codec 工具明显比其余工具重** | 🟢 | 靠 registry 懒加载隔离成独立 chunk，**绝不放进公共 chunk**，否则拖累全部工具首屏 |
| **codec 会诱导用户往在线工具粘贴真实密文** | 🟡 | 工具页顶部常驻隐私提示：「所有计算在你的浏览器里完成，我们看不到你的数据」——这是**功能承诺**，不是免责声明 |

---

## 6. 质量基建与 A → C 路径

用户决策：**A 档起步，后续升级 C 档**。为避免升级时重构，脚本命名从一开始就按 C 档预留：

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",

    // ── A 档 ──
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/",

    // ── B/C 档（脚本先占位，C 档接 CI）──
    "typecheck": "vue-tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

**关键设计**：`npm run check` 是**聚合命令**。

- A 档：本地手动跑 `npm run check` 保证质量
- C 档：只需在 GitHub Actions 里加一行 `run: npm run check`，**本地脚本零改动**

这就是"免迁移"的具体含义。CI 配置文件本身在 C 档新建，不影响现有结构。

**ESLint 与 Prettier 的分工**（不配 `eslint-config-prettier` 而直接在 ESLint 里关规则）：
关闭 `no-undef`（TS 已覆盖，且它不认浏览器全局，只会误报）以及全部 `vue/*` 格式化类规则，只留语义类检查。

**测试范围界定**（很重要，避免陷入为覆盖率而测）：

| 对象 | 测不测 | 理由 |
|---|---|---|
| `tools/*/core.ts` | ✅ **必须测** | 纯函数、纯逻辑、出错能精确定位，是投入产出比最高的 |
| `tools/*/crypto.ts`、`sniffer.ts` | ✅ 必须测 | 同上；Web Crypto 在 Node 24 与浏览器同源，测试无需 mock |
| `utils/*` | ✅ 测 | 纯函数 |
| `composables/*` | ⚠️ 视情况 | 只测有分支逻辑的（如 `useClipboard` 的降级路径） |
| `*.vue` | ❌ 不测 | 组件薄到只有渲染，测了是自欺欺人 |

**覆盖率统计范围**已写入 `vitest.config.ts` 的 `coverage.include`，只含上述前三类，阈值 lines/functions 80%、branches 70%。

**目标：core + crypto + sniffer + utils 覆盖率 ≥ 80%，不设全局指标。**

---

## 7. 维护难度评估

诚实评估，不灌鸡汤。

### 7.1 难度分级

| 事项 | 难度 | 说明 |
|---|---|---|
| 加一个新工具 | 🟢 **低** | 新建一个文件夹 + registry 加一行。SOP 见 `CONTRIBUTING.md` |
| 改现有工具的 UI | 🟢 低 | 只动该工具文件夹内 `.vue` 和 `components/` |
| 批量调整全站文案/梗 | 🟢 低 | 只动 `content/`，不动任何组件 |
| 加一个新彩蛋 | 🟢 低 | `easter-eggs.ts` 加一行 |
| 升级依赖 | 🟡 **中** | 重点盯 `cron-parser`（breaking）；跑 `npm run check` 兜底 |
| 加跨工具功能（历史/收藏） | 🟡 中 | `stores/prefs.ts` + `localStorage`，有现成挂载点 |
| 加 i18n（多语言） | 🟡 中 | `content/` 已经是纯数据，改造面可控 |
| 加 PWA 离线 | 🟢 低 | 一个插件 + manifest，不动业务代码 |
| 加后端 / 账号体系 | 🔴 **高** | 推翻"零上传"定位，产品性质改变，需重新决策 |

### 7.2 认知负担

| 项 | 评估 |
|---|---|
| 需要理解的概念 | Vue 组合式 API + TS + 注册表模式，**门槛可控** |
| 上手时间（熟悉 Vue 的前提下） | 半天读懂架构，1 天写出第一个工具 |
| 上手时间（不熟悉 Vue） | 约 1 周 |
| 新人踩坑点 | 主要是不习惯"工具自己带 core.ts"这个约定，靠 `CONTRIBUTING.md` + 一个模板工具兜底 |

### 7.3 长期风险

1. **工具数量膨胀后的路由性能** —— 40+ 工具时 `/tools/:id` 动态解析 + 懒加载仍然没问题，因为每个工具独立 chunk。**不会成为瓶颈**。
2. **CodeMirror 体积** —— 每个工具独立 chunk，JSON 工具不会让 Cron 工具变慢。
3. **"梗"过度导致的品牌风险** —— 已用 §4.3 的 `VITE_DEVKIT_TONE=off` 开关兜底。

---

## 8. 版本迭代路线

### 8.1 版本策略

采用 **SemVer**，并引入**工具级成熟度**：

| 状态 | 含义 | 对外展示 |
|---|---|---|
| `wip` | 骨架已建，功能未完成 | 灰色角标"开发中" |
| `beta` | 功能可用但未打磨 | 黄色角标"Beta" |
| `stable` | 完整实现且有测试 | 无角标 |

**版本号规则**：
- 新增工具 → `minor`（0.2.0 → 0.3.0）
- 修 bug / 文案调整 → `patch`
- 工具接口或 URL 结构的破坏性变更 → `major`（1.0.0 前不适用）

### 8.2 路线图

| 版本 | 主题 | 交付内容 | 完成判据 |
|---|---|---|---|
| **v0.1.0** ✅ | 脚手架 | 项目初始化 + 依赖安装 + 6 个占位页 | 已完成 |
| **v0.2.0** | **立骨架** | ① `git init` + 首次提交<br>② 注册表机制（registry/shared/define）<br>③ 三层分离落地<br>④ `content/` 文案层<br>⑤ ESLint + Prettier + Vitest 落地<br>⑥ 6 个工具**全部实现** + core 单测<br>⑦ 删 `ToolPlaceholder`<br>⑧ README + CONTRIBUTING | 6 个工具全部可用；`npm run check` 全绿；core 覆盖率 ≥ 80% |
| **v0.3.0** | 补短板 | ① 跨工具最近使用历史<br>② 全文搜索工具<br>③ 键盘快捷键<br>④ 深色主题<br>⑤ CodeMirror 封装组件抽稳 | 搜索能命中所有工具；深色主题无残留硬编码颜色 |
| **v0.4.0** | 离线 | ① PWA（`vite-plugin-pwa`）<br>② 桌面快捷方式<br>③ 工具数据本地导入导出 | 断网可完整使用全部工具 |
| **v0.5.0** | 扩编 | 按优先级加：正则测试 / JWT 解码 / UUID / Hash / 颜色转换 / 二维码 / Markdown | 新增工具不修改任何框架文件 |
| **v1.0.0** | 定版 | ① 彩蛋系统完整上线<br>② GitHub Actions CI（A→C 收口）<br>③ 语义化版本 + CHANGELOG<br>④ 性能与体积优化<br>⑤ LICENSE + 贡献指南 | `npm run check` 在 CI 中自动跑；公开可发布 |

### 8.3 迭代原则

1. **一个版本一个主题**，不做半途而废的多目标并行
2. **工具必须带测试**才算完成 —— 没有 `core.test.ts` 的工具不进 `registry`
3. **框架文件不随工具改动** —— 如果加一个工具需要改 `app/` 或 `components/`，说明注册表抽象漏了需求，停下来修抽象
4. **依赖升级独立成一个版本** —— 不和功能混在一起，出问题好定位

---

## 9. 落地清单（v0.2.0 立即可执行）

```
□ 1. git init + .gitignore 复核 + 首次提交（把 dist 排除，提交 lock 文件）
□ 2. npm i -D eslint eslint-plugin-vue prettier vitest @vitest/coverage-v8
□ 3. 创建 src/tools/shared.ts（ToolDefinition 契约）
□ 4. 创建 src/tools/define.ts + registry.ts
□ 5. 改造 app/router.ts → 由 registry 生成
□ 6. 改造 BasicLayout.vue → 侧栏由 registry 生成
□ 7. 改造 HomeView.vue → 卡片由 registry 生成
□ 8. 新建 /tools/:id 通用容器，删除 6 个占位 View
□ 9. 创建 components/ToolShell、ToolPanel、ActionBar、ResultBox、CodeEditor
□ 10. 创建 content/{index,strings,quips,easter-eggs,meta}.ts
□ 11. 抽 utils/{base64,bytes,json-error}.ts
□ 12. 迁移 6 个工具为三层结构，逐个补 core.test.ts
□ 13. styles/ 拆为 tokens.css + reset.css + main.css
□ 14. 删除 ToolPlaceholder.vue
□ 15. 补 README.md + CONTRIBUTING.md
□ 16. npm run check 全绿 → tag v0.2.0
```

---

**文档维护**：每次架构决策变更，先改本文件并更新版本日期，再改代码。

**相关文档**：实现阶段完成后，`CONTRIBUTING.md` 将承载"如何加一个工具"的逐步 SOP。
