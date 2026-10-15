# 移交文档 — DevKit / 码匠

> **交接对象**：下一位维护者
> **文档日期**：2026-10-15
> **代码版本**：`b07bcb7`（tag: 无，对应 v0.2.0）
> **仓库**：https://github.com/At210Co60/DevKit
> **文档性质**：本文件是**交接入口**。想深入设计意图看 [ARCHITECTURE.md](./ARCHITECTURE.md)，想动手加工具看 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 30 秒速览

一个纯本地的程序员小工具集，7 个工具，Vue 3 + TypeScript + Vite 8，425 个单元测试全绿。

**当前状态：功能完整，可运行，可部署。不是半成品。**

如果你只有 5 分钟，读完下面三节就能开始干活：

1. [当前状态](#1-当前状态)
2. [必须知道的 6 条红线](#3-必须知道的-6-条红线)
3. [踩过的坑，别重蹈覆辙](#5-踩过的-坑别重蹈覆辙)

---

## 1. 当前状态

### 已完成（v0.2.0）

| 模块 | 状态 | 验证方式 |
|---|---|---|
| 工具注册表机制 | ✅ 完成 | 加工具只需改 1 行 |
| 7 个工具 | ✅ 全部可用 | 425 个单元测试 |
| 文案隔离带 + 玩梗开关 | ✅ 完成 | `VITE_DEVKIT_TONE=off` 实测 |
| 彩蛋系统 | ✅ 完成（4 个彩蛋） | 手动触发 |
| 深色主题 | ✅ 完成（跟随系统 + 手动） | 手动切换 |
| 响应式布局 | ✅ 完成（桌面侧栏 / 窄屏抽屉） | 手动 |
| 质量基建 | ✅ 完成 | `npm run check` 全绿 |
| 文档体系 | ✅ 完成 | 4 份 |

### 工具完成度

| 工具 | 路径 | 状态 | 测试 | 主要能力 |
|---|---|---|---:|---|
| JSON 格式化 | `/tools/json` | 可用 | 31 | 美化/压缩/键排序，**错误定位到行列** |
| 时间戳转换 | `/tools/timestamp` | 可用 | 34 | 秒/毫秒双向，8 时区，相对时间 |
| Base64 | `/tools/base64` | 可用 | 35 | UTF-8 中文友好，URL-safe，文件双向 |
| URL 编解码 | `/tools/url` | 可用 | 44 | 双向编解码，结构拆解，Query 双向生成 |
| Cron 表达式 | `/tools/cron` | 可用 | 49 | 人类可读解释，接下来 5 次运行 |
| 文本 Diff | `/tools/diff` | 可用 | 32 | 行级+字符级，同步滚动，统一视图 |
| 解码/解密 | `/tools/codec` | 可用 | 100 | 12 类嗅探，多层解码，AES/RSA |

> 注册表里所有工具的 `status` 目前是 `'wip'`。**如果它们在你手上稳定可用，可以改成 `'beta'` 或 `'stable'`**——这个字段只影响 UI 角标，改 `src/tools/registry.ts` 里各工具的 `index.ts` 即可。

### 未完成（明确不在当前版本范围）

- PWA 离线、快捷键体系、全局搜索、最近使用 UI
- GitHub Actions CI（脚本已预留，见第 6 节）
- i18n / 多语言
- 移动端专项优化（响应式做了，但不是重点打磨过）

---

## 2. 环境与运行

### 环境要求

| 项 | 要求 | 实测环境 |
|---|---|---|
| Node.js | **≥ 20.19** | v24.15.0 |
| npm | ≥ 10 | 11.12.1 |
| 操作系统 | Windows / macOS / Linux | Windows 11 |
| 浏览器 | Chrome 105+ / Firefox 121+ / Safari 16.4+ | — |

浏览器下限由 **Web Crypto API** 决定（codec 工具的加解密全靠它）。

### 上手

```bash
git clone https://github.com/At210Co60/DevKit.git
cd DevKit
npm install          # 必须用 lock 文件：npm ci 更稳
npm run dev          # → http://localhost:8090
```

### 验证（提交前必跑）

```bash
npm run check
```

聚合执行 4 件事，**任何一项失败就不要提交**：

```
lint      ESLint 10            0 error 0 warning
typecheck vue-tsc              exit 0
test      Vitest 5             425 例全绿
build     Vite 8               构建成功
```

单项命令：

```bash
npm run test:watch        # 开发时看测试
npm run test:coverage     # 覆盖率（只统计纯逻辑层）
npm run format            # Prettier 格式化
```

---

## 3. 必须知道的 6 条红线

这 6 条是**不可让步**的约束，违反会直接破坏产品定位或可维护性。

### ① 禁止自研加密算法

一律调用浏览器原生 **Web Crypto API**。任何需要手写 AES / DES / RSA 的场景都**不做**——宁可标注"不支持"，也不引入不安全的纯 JS 实现。

> 已实测确认 Web Crypto 支持：`SHA-1/256/384/512`、`AES-CBC/GCM/CTR/KW`、`RSA-OAEP/PKCS1v1.5`、`PBKDF2`、`HKDF`
>
> **不支持**：**MD5**、**DES / 3DES**

### ② 禁止假装万能

哈希是单向函数就说不可逆；MD5/DES/PKCS#1 不支持就说明原因。

codec 工具会诱导用户粘贴**真实密文和令牌**（JWT、内部 URL），这类工具号称"万能解密"意味着它有后门或在收集密钥。**宁可功能少，不能不可信。**

### ③ 每个工具强制三层分离

```
core.ts        纯函数，零 Vue 零 DOM 零副作用  → 可单测，未来可搬到 CLI/Worker
useXxxTool.ts  响应式编排，只调 core，不算业务
XxxTool.vue    只渲染，不含业务 if-else 分支
```

破坏这个约定的典型代价：一个 300 行的 `core.ts` 混进 DOM 操作，测试要 mock 环境，CI 跑不起来。

### ④ 禁止在组件里写中文吐槽

一切从 `@/content` 取，业务代码只写 `pick(['玩梗版', '正经版'])`。

**理由**：玩梗是这个产品的特色，但不是业务逻辑。散落在组件里会导致想关掉梗或做多语言时，要改几十个文件。现在改一个环境变量就能全站切换。

例外：**安全相关的文案不许开玩笑**。哈希不可逆、无密钥不能解密这类内容，越严肃越可信。

### ⑤ 加工具只许动两个地方

```
新建 src/tools/<id>/          （core / use / vue / index / __tests__）
src/tools/registry.ts 加一行
```

如果发现"加一个工具需要改框架文件"，**说明抽象漏了需求，应该修抽象**，而不是在各处加特例。

### ⑥ `cron-parser` 锁死 4.9.x

**不要升级。** 5.x 是破坏性变更（API 从函数改为 class）。而且 4.9 有个陷阱见下节。

---

## 4. 代码地图

```
src/
├── tools/registry.ts          ★ 唯一工具清单（路由/侧栏/首页全派生自它）
├── tools/shared.ts            ToolDefinition 契约
├── tools/<id>/
│   ├── core.ts                业务逻辑（纯函数）
│   ├── use<Id>Tool.ts         状态编排
│   ├── <Id>Tool.vue           渲染
│   ├── index.ts               导出 ToolDefinition
│   └── __tests__/core.test.ts 必测
├── content/pick.ts            语气总闸
├── components/CodeEditor.vue  全站唯一 import CodeMirror 的地方
├── utils/json-error.ts        含 JSON 错误定位扫描器
└── styles/tokens.css          换肤只改这里
```

**完整逐文件说明见 [docs/FILE-STRUCTURE.md](./docs/FILE-STRUCTURE.md)。**

---

## 5. 踩过的坑，别重蹈覆辙

这些都是实际调试出来的，代码里有注释，但这里集中列出。

### 🔴 `cron-parser` 4.9 会就地修改传入的 options 对象

`parseExpression` 内部的 `parseNthDay` 会把 `#` 的结果写回 `options.nthDayOfWeek`。

**后果**：复用同一个 options 字面量会让之后每一次解析都被静默污染，表现为莫名的 `loop limit exceeded`，且难以定位。

**已处理**：`src/tools/cron/core.ts` 每次调用都新建 options，并加了回归测试锁死。**改动 cron 工具时不要为了"省一点开销"把它改成模块级常量。**

### 🔴 V8 对短 JSON 不给错误位置

新版 V8 的报错分两种：

```
长输入: "Expected ',' in JSON at position 7 (line 1 column 8)"     ← 有位置
短输入: "Unexpected token '}', "{"a":}" is not valid JSON"          ← 没位置！
```

短 JSON 恰恰是工具里最常见的输入，直接用引擎的 position 会让招牌功能在主场景失效。

**已处理**：`src/utils/json-error.ts` 内置显式栈的扫描器 `findJsonSyntaxError` 兜底。**用递归实现的版本在深层嵌套坏 JSON 上会打爆调用栈，别退回递归。**

### 🟡 `encodeURIComponent` 之外的三处 UTF-8 坑

1. **原生 `btoa` 不支持中文**，遇中文直接抛 `InvalidCharacterError`
2. **`String.fromCharCode(...bytes)` 在大文本上栈溢出**，必须分块（项目用 0x8000）
3. **`\uXXXX` 只吃 4 位十六进制**：码位超 BMP（emoji）若写成 `\u1f41b` 会被解析成 `\u1f41` + 字母 `b`，必须用 `\u{1F41B}`

### 🟡 浏览器只有 decoder，没有 encoder

`TextDecoder` 能用，`TextEncoder` 只有 UTF-8。所以"用 GBK 编码一段中文"在浏览器里做不到，**自动修复乱码只能覆盖部分场景**（UTF-8 被误读成 Latin-1 可修，GBK 误读不可）。不要设计"万能乱码修复"功能。

### 🟡 时间相关测试别写死 `Date.now()`

实现和断言各调一次 `Date.now()`，跨过毫秒边界就必然失败。**用区间断言**（`toBeGreaterThanOrEqual(before)` / `toBeLessThanOrEqual(after)`），不要写 `ms === s * 1000 + Date.now() % 1000`。

### 🟡 Vite 8 / TS 6 / Vitest 5 都较新

生态包可能未适配。**依赖升级必须单独开一个版本做**，不要和功能混在一起，出问题好定位。

---

## 6. 下一步路线

| 版本 | 主题 | 建议做法 |
|---|---|---|
| **v0.3.0** | 补短板 | ① 最近使用 UI（`useToolHistory` 已就位，只缺界面）<br>② 全局搜索（`searchTools` 已就位，只缺 ⌘K 面板）<br>③ 快捷键体系<br>④ 深色主题打磨 |
| **v0.4.0** | 离线 | PWA：`vite-plugin-pwa`，加 manifest + 图标，不动业务代码 |
| **v0.5.0** | 扩编 | 按价值排序：正则测试 → JWT 解码 → UUID → Hash → 颜色转换 → 二维码 |
| **v1.0.0** | 定版 | CI + 语义化版本 + CHANGELOG + 彩蛋系统收口 |

### 接 CI 的最短路径（为 v1.0 预留好的）

`package.json` 里的 `check` 是聚合命令，所以 CI 只需要一行：

```yaml
- run: npm ci
- run: npm run check
```

**本地脚本零改动**——这是当初选 A 档基建时就在为 C 档收口做的设计。

### v0.3.0 的隐藏福利

`searchTools()` 和 `useToolHistory()` 都已经写好并接入注册表了，**只差 UI**。这是 v0.3 最快的切入点。

---

## 7. 部署

纯静态 SPA，产物在 `dist/`：

| 方式 | 配置 |
|---|---|
| Vercel / Netlify | 连仓库，构建命令 `npm run build`，输出目录 `dist` |
| GitHub Pages | `npm run build` 后把 `dist/` 推到 `gh-pages` 分支 |
| 自建 Nginx | 放 `dist/`，配 `try_files $uri $uri/ /index.html`（SPA 路由必需） |

**注意**：项目用的是 History 路由（`createWebHistory`），服务器**必须**配 fallback，否则刷新 `/tools/json` 会 404。

---

## 8. 交接自检

接手后请按顺序确认：

- [ ] `npm install` 成功，无 peer dependency 报错
- [ ] `npm run dev` 能打开 `http://localhost:8090`，侧栏出现 7 个工具
- [ ] `npm run check` 四项全绿
- [ ] 随便改一个工具的 `core.ts`，确认测试会挂（验证测试真的在测）
- [ ] 读一遍 [ARCHITECTURE.md](./ARCHITECTURE.md) 的 §4（代码框架）和 §5（技术栈）
- [ ] 读一遍本文件的第 3 节（红线）与第 5 节（踩坑）

---

## 9. 文档索引

| 文档 | 什么时候看 |
|---|---|
| **本文件** | 刚接手，不知道从哪开始 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 想知道"为什么这么设计"、技术选型的理由、风险在哪 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 准备加一个新工具 |
| [docs/FILE-STRUCTURE.md](./docs/FILE-STRUCTURE.md) | 想知道某个文件是干什么的 |
| [README.md](./README.md) | 想对外介绍这个项目 |

---

**交接人**：At-210（GitHub: At210Co60）
**联系方式**：见 GitHub 仓库 Issues
