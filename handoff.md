# DevKit — 项目功能说明 (handoff)

> 本文档面向**还没动工或正在接手 DevKit** 的同学，把"这个项目能干什么、6 个工具各自做什么、哪些已做哪些未做"说清楚。

> ⚠️ **架构请先读 `ARCHITECTURE.md`**（2026-10-15 定稿）。
> 本文档描述的是 v0.1.0 脚手架状态，其中 §4.1「路由表」和 §6「项目结构」描述的手写路由与目录划分**已被工具注册表机制取代**，其余工具功能规划部分仍然有效。

---

## 1. 项目是什么

**DevKit = 极简程序员在线小工具集合**。不需要登录、不依赖网络、所有计算在客户端完成。

定位和现有工具（如 bejson、在线 base64、crontab.guru）的区别：**极简、本地优先、6 个高频工具一站式**。

---

## 2. 6 个起步工具

| # | 工具 | 路径 | 一句话功能 |
|---|---|---|---|
| 1 | JSON 格式化 | `/tools/json` | 美化 / 压缩 JSON,自动定位错误 |
| 2 | Base64 编解码 | `/tools/base64` | 文本 ↔ Base64,中文友好 + URL-safe |
| 3 | URL 编解码 | `/tools/url` | encodeURI / decodeURIComponent + URL 解析 |
| 4 | Cron 表达式 | `/tools/cron` | 五段式解析 + 接下来 5 次运行时间 |
| 5 | 时间戳转换 | `/tools/timestamp` | Unix 秒/毫秒 ↔ YYYY-MM-DD HH:mm:ss |
| 6 | 文本 Diff | `/tools/diff` | 左右两栏逐行对比 + 字符级标红标绿 |

---

## 3. 每个工具的详细功能

### 3.1 JSON 格式化（`/tools/json`）

**能干什么**
- 把压缩的 JSON 字符串 → 美化（4 空格缩进,换行）
- 把美化后的 JSON → 压缩（去掉空白）
- 输入非合法 JSON → 显示错误位置（行号 + 错误信息）
- 一键清空 / 复制结果到剪贴板
- 一键加载示例（典型 JSON 对象）
- CodeMirror 高亮 + 行号显示

**实现思路**
- 用 `JSON.parse()` + 自定义缩进函数（或 `JSON.stringify(obj, null, 4)`）
- 错误定位：catch 后用正则匹配错误信息里的位置（如 `at position 42`）或者用 `acorn` / `jsonc-parser` 拿到行号
- CodeMirror 用 `@codemirror/lang-json` 提供 JSON 语法高亮

---

### 3.2 Base64 编解码（`/tools/base64`）

**能干什么**
- 文本 → Base64（输入纯文本,输出 Base64 编码）
- Base64 → 文本（输入编码,输出原文）
- **中文 UTF-8 友好**：用 `TextEncoder / TextDecoder` 解决原生 `btoa / atob` 不支持中文的坑
- 支持 **URL-safe Base64**（替换 `+` → `-`、`/` → `_`）
- 支持**文件拖拽** → 转成 Base64 DataURL（`data:image/png;base64,...`）
- 一键复制结果

**实现思路**
- 文本 → Base64：`btoa(String.fromCharCode(...new TextEncoder().encode(str)))`
- Base64 → 文本：`new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)))`
- 文件 → Base64：`FileReader.readAsDataURL(file)`

---

### 3.3 URL 编解码（`/tools/url`）

**能干什么**
- `encodeURIComponent` / `decodeURIComponent` 双向
- 自动识别输入是编码还是未编码（解码后是否合法）
- **URL 解析面板**：把 URL 拆成 protocol / host / pathname / query / hash
- **Query 参数解析**：把 `?a=1&b=2` 解析成 `[{key:'a', value:'1'}]`
- 一键复制结果

**实现思路**
- `URL` 构造函数 + `URLSearchParams`（浏览器原生 API,不需要第三方库）
- 自动识别：尝试 decode 一次,能 decode 且不抛错就当已编码

---

### 3.4 Cron 表达式（`/tools/cron`）

**能干什么**
- 五段式 Cron 输入（`* * * * *`）
- 六段式也支持（带年,`cron-parser` 默认开 5 段,需配置）
- **实时解析**：每改一个字符自动重新解析
- **接下来 5 次运行时间预览**：列表展示,带星期几
- **人类可读解释**：每个字段含义（如 `0 0 * * *` = 每天 0 点）
- **合法性校验**：不合法显示错误信息
- 常用模板快捷输入：`@daily`、`@hourly`、`@weekly` 等

**实现思路**
- 用 `cron-parser` 库（已装在 README）
- `parser.parseExpression('0 0 * * *').next().toDate()` 拿下一次运行
- 循环 5 次展示接下来 5 次

---

### 3.5 时间戳转换（`/tools/timestamp`）

**能干什么**
- **Unix 秒 / 毫秒 ↔ YYYY-MM-DD HH:mm:ss** 双向
- 自动识别输入是秒（10 位）还是毫秒（13 位）
- **当前时间戳一键取**：点击按钮自动填入当前时间（秒和毫秒各一份）
- **时区支持**：默认本地、Asia/Shanghai、UTC 切换
- **显示星期几**：转换结果里附 `周一 / 周二 / ...`

**实现思路**
- `new Date(timestamp)` 拿 Date 对象
- `date.getFullYear() / getMonth() / ...` 拼字符串
- 时区：用 `toLocaleString('zh-CN', { timeZone })`

---

### 3.6 文本 Diff（`/tools/diff`）

**能干什么**
- 左右两栏输入文本
- 中间/下方显示对比结果
- **新增行标绿** / **删除行标红** / **相同行灰色**
- **字符级内部对比**：同一行内的增删字符再细分标色
- **同步滚动**：滚动一边另一边跟着滚
- 一键清空 / 加载示例

**实现思路**
- 用 `diff` 库（已装在 README）
- `Diff.diffLines(text1, text2)` 拿行级 diff
- `Diff.diffChars(part1, part2)` 拿字符级 diff
- CodeMirror 用于左侧右侧编辑器

---

## 4. 全局功能（不是单个工具的）

### 4.1 路由表

| 路径 | 页面 | 标题 |
|---|---|---|
| `/` | 首页 | 6 工具卡片 2×3 |
| `/tools/json` | JSON 工具 | JSON 格式化 |
| `/tools/base64` | Base64 工具 | Base64 编解码 |
| `/tools/url` | URL 工具 | URL 编解码 |
| `/tools/cron` | Cron 工具 | Cron 表达式 |
| `/tools/timestamp` | 时间戳工具 | 时间戳转换 |
| `/tools/diff` | Diff 工具 | 文本 Diff |

路由懒加载：每个工具页面是独立文件,首次访问才加载（已经用 `() => import(...)` 实现）。

### 4.2 布局

- **顶部 Header**：左侧 Logo（⌬） + 标题（DevKit） + 副标题（极简程序员在线工具集），右侧 GitHub 链接
- **左侧 Sidebar**：首页 + 6 个工具菜单,active 项蓝色高亮
- **主内容区**：`router-view` 渲染当前工具页

### 4.3 响应式

- 桌面（>720px）：左侧菜单固定侧栏
- 窄屏（≤720px）：侧栏变成顶部水平滚动条
- 工具页面左右两栏：≤880px 时改为上下堆叠

### 4.4 主题色

CSS 变量集中在 `src/styles/main.css`：
- `--primary`: `#2563eb`（蓝）
- 改一个变量 = 全站同步换肤

---

## 5. 技术栈

| 库 | 版本 | 作用 |
|---|---|---|
| Vue | ^3.5.42 | 前端框架 |
| Vue Router | ^4.6.4 | 路由 |
| Pinia | ^3.0.0 | 状态管理（脚手架已集成,实际工具里目前未用,后续可加） |
| CodeMirror 6 | ^6.0.1 | 代码编辑器（JSON / Diff 用） |
| @codemirror/lang-json | ^6.0.1 | JSON 语法高亮 |
| @codemirror/theme-one-dark | ^6.1.2 | 深色主题 |
| cron-parser | ^4.9.0 | Cron 表达式解析 |
| diff | ^5.2.0 | 文本对比 |
| Vite | ^8.3.0 | 构建 |
| TypeScript | ~6.0.2 | 类型 |
| vue-tsc | ^3.3.11 | 类型检查 |

**没用 Pinia**：当前所有工具状态是页面级 ref。如果后续要做"全局历史记录 / 跨工具共享示例数据"再考虑引入。

---

## 6. 项目结构（已创建部分）

```
devkit/
├── public/                       # 静态资源（空）
├── src/
│   ├── components/
│   │   └── ToolPlaceholder.vue  # 工具页统一外壳（每个工具套这个）
│   ├── layouts/
│   │   └── BasicLayout.vue      # 顶部 + 侧栏 + 内容
│   ├── router/
│   │   └── index.ts             # 路由表 + 守卫（设标题）
│   ├── styles/
│   │   └── main.css             # 全局样式 + CSS 变量
│   ├── views/
│   │   ├── home/index.vue       # 首页：6 工具卡片网格
│   │   └── tools/              # 6 个工具页面（当前都是占位）
│   │       ├── JsonView.vue
│   │       ├── Base64View.vue
│   │       ├── UrlView.vue
│   │       ├── CronView.vue
│   │       ├── TimestampView.vue
│   │       └── DiffView.vue
│   ├── App.vue                  # 根组件（只渲染 router-view）
│   └── main.ts                  # 入口（注册 router + pinia）
├── env.d.ts                     # vite 客户端类型
├── index.html                   # HTML 入口
├── package.json                 # 依赖 + 脚本
├── tsconfig.json / .app.json / .node.json  # TS 配置
├── vite.config.ts               # Vite 配置（端口 8090）
├── .gitignore                   # 忽略 node_modules / dist 等
```

---

## 7. 已完成 / 未完成清单

### 已完成（脚手架级别）

- ✅ 项目目录 + package.json + 依赖装好（85 packages）
- ✅ Vite + TypeScript + Vue + Router + Pinia 集成
- ✅ 全局样式 + CSS 变量 + 滚动条美化
- ✅ BasicLayout 布局（顶部 + 侧栏 + 内容 + 响应式）
- ✅ 首页（6 工具卡片 2×3 + 介绍区）
- ✅ 6 个工具页面占位（统一用 `ToolPlaceholder` 组件,含"即将实现"功能列表）
- ✅ 路由懒加载（每个工具页是独立文件）
- ✅ `npm run build` 通过（59 模块,无错误）

### 未完成（每个工具的实际功能）

每个工具目前都套在 `ToolPlaceholder` 占位组件里,只显示标题/简介/左右两个空白 textarea + "即将实现"清单。

**JSON**：未实现
**Base64**：未实现
**URL**：未实现
**Cron**：未实现
**时间戳**：未实现
**Diff**：未实现

每个工具的实现细节见上面 §3。

---

## 8. 扩展方向（后续可以加的工具）

按学习价值和实用性排序：

| 工具 | 路径 | 价值 |
|---|---|---|
| 正则测试 | `/tools/regex` | 在线测试正则 + 匹配高亮 |
| JWT 解码 | `/tools/jwt` | header / payload 一键看,不用 jwt.io |
| UUID 生成 | `/tools/uuid` | v1 / v4 / v7 一键生成 |
| Markdown 预览 | `/tools/markdown` | 左右双栏 + 渲染 |
| 颜色转换 | `/tools/color` | HEX ↔ RGB ↔ HSL |
| 二维码生成 | `/tools/qrcode` | 文本 → 二维码图片 |
| Hash 计算 | `/tools/hash` | MD5 / SHA-256（Web Crypto API） |

---

## 9. 部署

**DevKit 是纯静态 SPA**,部署极简单：
- **Vercel / Netlify**：连 GitHub 仓库,自动构建部署
- **GitHub Pages**：`npm run build` → 推 `dist/` 到 `gh-pages` 分支
- **自建 Nginx**：`dist/` 放到服务器,配置 `try_files $uri $uri/ /index.html`

**端口**：dev 用 8090（避开 web-project 的 8080,可同时跑两个项目）。

---

## 10. 本地运行

```bash
# 进入项目
cd C:\Users\15271\Desktop\devkit

# 启动 dev server
npm run dev
# → http://localhost:8090

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

---

## 11. 注意事项

- **脚手架已搭好但不完整**：6 个工具都还是占位,**功能层面没有任何一行实际逻辑**。接手时第一件事是逐个工具实现
- **CodeMirror / diff / cron-parser 依赖已装但未使用**：包在 package.json 但代码里还没 import,需要时直接 import 即可
- **Pinia 已集成但未使用**：main.ts 里注册了,但没有 store 文件,如果不需要可以暂时忽略
- **没建 Git 仓库**：是否初始化 git + 推 GitHub 由接手人决定（README 里有 GitHub 链接但仓库还不存在）

---

**文档版本**：v1.0  
**最后更新**：2026-10-15  
**对应项目状态**：脚手架已建 / 6 工具全部占位 / 功能未实现