# DevKit 文件结构详解

> 本文件逐个说明项目里每个文件的存在理由。想知道**为什么这么设计**，看 [ARCHITECTURE.md](../ARCHITECTURE.md)；想知道**怎么加一个新工具**，看 [CONTRIBUTING.md](../CONTRIBUTING.md)。

---

## 规模总览

| 指标 | 数值 |
|---|---|
| 源码文件（不含测试） | 62 |
| 测试文件 | 15 |
| 单元测试用例 | 425 |
| 工具数量 | 7 |
| 业务代码（src/） | ~340 KB |
| 依赖数量 | 7 运行时 + 14 开发时 |

---

## 根目录配置

| 文件 | 大小 | 职责 | 关键点 |
|---|---:|---|---|
| `package.json` | 1.4 KB | 依赖与脚本 | `check` 是聚合命令，为将来接 CI 预留 |
| `package-lock.json` | 144 KB | 依赖锁 | **必须提交**。Vite 8 / TS 6 / npm 11 版本激进，不锁会炸 |
| `vite.config.ts` | 474 B | 构建配置 | `@` 别名指向 `src`；dev 端口 8090 |
| `vitest.config.ts` | 870 B | 测试配置 | 覆盖率**只统计纯逻辑层**，阈值 lines/functions 80% |
| `eslint.config.ts` | 2.0 KB | Lint 配置 | 关闭 `no-undef`（TS 已覆盖且它不认浏览器全局）；格式化规则交给 Prettier |
| `prettier.config.js` | 253 B | 格式化配置 | 无分号、单引号、120 列 |
| `tsconfig.json` / `.app.json` / `.node.json` | 762 B | TS 配置 | 拆三份；app 已预留 `__tests__` 排除规则 |
| `env.d.ts` | 309 B | 环境变量类型 | 声明 `VITE_DEVKIT_TONE` |
| `.env.example` | 279 B | 环境变量模板 | 只有一个可选变量，语气开关 |
| `.gitignore` | 443 B | 忽略规则 | `node_modules` / `dist` / `coverage` / `.env` / 临时探测文件 |
| `.editorconfig` | 225 B | 编辑器规范 | 统一缩进与换行 |

---

## `src/` 应用骨架

| 文件 | 大小 | 职责 |
|---|---:|---|
| `main.ts` | 320 B | 入口，**只做装配**：挂 Pinia、Router、样式。零业务 |
| `App.vue` | 229 B | 根组件，**最薄**：只渲染 `<RouterView />` |

### `src/app/` —— 装配层

| 文件 | 大小 | 职责 |
|---|---:|---|
| `router.ts` | 1.5 KB | **由注册表驱动**的路由表。只有一个通用 `/tools/:id` 容器 + 404，不为每个工具写死路由 |

路由守卫从注册表查工具名设置标题，所以改名字后标题不会忘记改。

---

## `src/tools/` —— 工具区（★ 加工具只动这里）

### 契约与注册表

| 文件 | 大小 | 职责 |
|---|---:|---|
| `shared.ts` | 1.8 KB | `ToolDefinition` 契约 + `ToolDefinitionInput`（三个字段可选的输入形状） |
| `define.ts` | 726 B | 工厂函数，补 `status` / `order` / `keywords` 默认值 |
| `registry.ts` | 2.0 KB | **全站唯一清单**。导出 `TOOLS` / `getToolById` / `toolsByCategory` / `searchTools` |

> 注册表被四处消费：路由、侧栏菜单、首页卡片、未来搜索面板。加工具时**只加一行**。

### 工具目录（每个都是三层结构）

| 工具 | core.ts | use 层 | 视图 | 测试 |
|---|---:|---:|---:|---:|
| `json/` | 4.9 KB | 4.6 KB | 2.8 KB | 31 例 |
| `base64/` | 11.0 KB | 7.5 KB | 3.7 KB | 35 例 |
| `url/` | 13.1 KB | 8.4 KB | 5.7 KB | 44 例 |
| `timestamp/` | 9.7 KB | 5.1 KB | 3.4 KB | 34 例 |
| `cron/` | **25.2 KB** | 3.0 KB | 6.8 KB | 49 例 |
| `diff/` | 9.4 KB | 5.1 KB | 7.6 KB | 32 例 |
| `codec/` | 15.0 KB + 12.0 KB + 18.7 KB | 14.2 KB | 13.4 KB | 100 例 |

`codec` 特殊在有**四层**：`sniffer.ts`（类型嗅探）+ `core.ts`（无密钥编解码）+ `crypto.ts`（Web Crypto）+ `useCodecTool.ts`（编排），因为它的逻辑量是其他工具的数倍。

每个工具的 `index.ts` 只做一件事：导出 `ToolDefinition`，含 `id` / `name` / `tagline` / `icon` / `category` / `keywords` / `status` / `order` / 懒加载 `component`。

---

## `src/components/` —— 复用 UI（6 个原子组件）

| 文件 | 大小 | 职责 | 为什么存在 |
|---|---:|---|---|
| `ToolShell.vue` | 1.9 KB | 工具页外壳：标题、tagline、常驻提示条 | 安全声明需要一个固定位置（`notice`） |
| `ToolPanel.vue` | 1.9 KB | 左右双栏容器 | 窄屏自动堆叠，工具内部无需写响应式 |
| `ActionBar.vue` | 1.1 KB | 操作按钮条 | 用 `ActionItem[]` 数据描述，便于置灰与遍历 |
| `ResultBox.vue` | 2.9 KB | 输出区 | **内建空/错/正常三态 + 自带复制**，工具只管传值 |
| `CodeEditor.vue` | 3.5 KB | CodeMirror 6 封装 | **全站唯一接触 CodeMirror 的文件**；配色靠 CSS 变量跟随深色模式，不引 oneDark |
| `EasterEggHost.vue` | 3.9 KB | 彩蛋宿主 | 所有触发器与反馈集中在此 |
| `types.ts` | 571 B | `ActionItem` / `NoticeKind` 类型 | 放 `.vue` 里外部无法 type-import（已踩坑） |

---

## `src/composables/` —— 组合式函数

| 文件 | 大小 | 职责 |
|---|---:|---|
| `useClipboard.ts` | 1.6 KB | 复制 + **两级降级**（`navigator.clipboard` → `execCommand`） |
| `useDebounced.ts` | 672 B | 输入防抖，`onScopeDispose` 自动清理定时器 |
| `useEasterEgg.ts` | 2.5 KB | 彩蛋触发引擎：键盘序列 / 路由 / 连点次数 |
| `useToolHistory.ts` | 1.6 KB | 最近使用，**只写 localStorage**，提供一键清除 |

---

## `src/content/` —— ★ 文案层（恶搞隔离带）

| 文件 | 大小 | 职责 |
|---|---:|---|
| `pick.ts` | 669 B | **语气总闸**：`TONE_ENABLED` + `pick(['梗', '正经'])` |
| `strings.ts` | 3.0 KB | 全站正经文案，任何语气下都一致 |
| `quips.ts` | 16.1 KB | 恶搞文案库，7 个工具各自的吐槽（每条成对） |
| `easter-eggs.ts` | 1.9 KB | 彩蛋定义表：4 个彩蛋的触发器与奖励 |
| `meta.ts` | 839 B | 站点名、标语、页脚、分组显示名 |
| `index.ts` | 525 B | 统一出口，业务代码只允许从这里 import |

**硬规则**：`.vue` 文件里禁止写吐槽文案，一律从 `@/content` 取。关掉玩梗只需改一个环境变量，不碰任何组件。

---

## `src/utils/` —— 纯函数层（零业务、零 Vue）

| 文件 | 大小 | 职责 | 关键点 |
|---|---:|---|---|
| `bytes.ts` | 4.5 KB | 字节 ↔ 文本/十六进制/二进制/八进制 | 分块处理，避免大文本栈溢出 |
| `base64.ts` | 2.9 KB | UTF-8 安全 Base64 + URL-safe | 原生 `btoa` 不支持中文 |
| `encoding.ts` | 2.4 KB | Unicode 转义、码位互转 | 超 BMP 字符必须用 `\u{...}` |
| `charset.ts` | 3.6 KB | 编码检测与乱码修复 | 浏览器只有 decoder 没有 encoder |
| `format.ts` | 2.5 KB | 文本统计、HTML 实体、截断 | |
| `json-error.ts` | 9.9 KB | **安全解析 + 错误定位 + JSON 扫描器** | 见下方说明 |

### `json-error.ts` 为什么最大

内置了一个显式栈的 JSON 语法扫描器（`findJsonSyntaxError`），解决一个真实缺陷：

新版 V8 在输入较短时会改用 `Unexpected token '}', "..." is not valid JSON` 这种文案，**不提供 `at position N`**，行列定位整个丢失——而短 JSON 恰恰是工具里最常见的输入。

用显式栈而非递归：深层嵌套的坏 JSON 不能把调用栈打爆。

---

## 其余 `src/` 目录

| 目录 | 文件 | 职责 |
|---|---|---|
| `layouts/` | `BasicLayout.vue` (5.7 KB) | Header + 侧栏 + 内容区。**侧栏菜单由注册表派生**，主题切换按钮挂这里 |
| `views/` | `HomeView.vue` (4.9 KB) | 卡片网格 + 搜索，按分组渲染 |
| | `ToolsView.vue` (1.8 KB) | 通用容器：按 id 查注册表 → 懒加载 → 挂载 |
| | `NotFoundView.vue` (1.1 KB) | 404，同时是彩蛋路由落点 |
| `stores/` | `prefs.ts` (1.3 KB) | Pinia：**仅跨工具**状态（主题）。其余一律 `ref` |
| `styles/` | `tokens.css` (2.6 KB) | 设计 token，换肤只改这里 |
| | `reset.css` (1.6 KB) | 重置 + 可访问性（`prefers-reduced-motion`） |
| | `main.css` (3.2 KB) | 导入上面两个 + 全站原子类 |

---

## 文档

| 文件 | 大小 | 职责 |
|---|---:|---|
| `README.md` | 16.1 KB | 项目解析、功能清单、技术栈、隐私承诺、快速开始 |
| `ARCHITECTURE.md` | 26.6 KB | 架构决策、目录设计、维护难度评估、版本路线、风险登记 |
| `CONTRIBUTING.md` | 4.9 KB | 加工具 SOP、三层分离规范、质量红线、提交前自检 |
| `handoff.md` | 11.5 KB | 历史交接文档（描述 v0.1.0 脚手架状态，已部分过时） |

---

## 不在仓库里的东西

| 路径 | 原因 |
|---|---|
| `node_modules/` | 依赖，靠 `npm install` 重建 |
| `dist/` | 构建产物，靠 `npm run build` 生成 |
| `coverage/` | 覆盖率报告，靠 `npm run test:coverage` 生成 |
| `.env` | 环境变量（含可能的私密配置），只有 `.env.example` 进仓库 |

---

## 想改哪里，改哪儿

| 你想做的事 | 改这些文件 |
|---|---|
| 加一个新工具 | 新建 `src/tools/<id>/` + `registry.ts` 加一行 |
| 改某个工具的功能 | 该工具目录内的 `core.ts`（逻辑）/ `useXxxTool.ts`（编排） |
| 批量改全站玩梗文案 | `src/content/quips.ts`，只加 key 不改已有 |
| 加一个彩蛋 | `src/content/easter-eggs.ts` 加一行 |
| 换肤 / 改配色 | `src/styles/tokens.css` |
| 关掉玩梗 | 设 `VITE_DEVKIT_TONE=off`，不用改代码 |
| 加一个全站通用按钮 | `src/components/` 沉淀原子组件 |
| 调整质量门槛 | `vitest.config.ts`（覆盖率）、`eslint.config.ts` |
