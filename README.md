# DevKit / 码匠

> **正经功能，欠揍文案。**

一个**纯本地**的程序员小工具集合。所有计算在浏览器里完成——零上传、零追踪、无需账号。

[![CI](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Vue](https://img.shields.io/badge/Vue-3.5-42b883)]()
[![TS](https://img.shields.io/badge/TypeScript-6-3178c6)]()
[![Vite](https://img.shields.io/badge/Vite-8-646cff)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 目录

- [项目解析](#项目解析)
- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [隐私与安全边界](#隐私与安全边界)
- [质量保障](#质量保障)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [加工具的流程](#加工具的流程)
- [版本路线](#版本路线)
- [文档索引](#文档索引)

---

## 项目解析

### 这个项目解决什么问题

程序员每天都在做同一类事：把一段看不懂的东西变成看得懂的东西。JSON 排版不对、Base64 里的中文变成乱码、Cron 表达式不知道下次什么时候跑、时间戳忘了是秒还是毫秒……

现有的在线工具站有两个通病：

1. **要联网** —— 粘贴的内容发到别人的服务器上。处理 JWT、密文、内部 URL 时这本身就是风险。
2. **体验割裂** —— 每个工具一个网站，来回跳、样式各异、不知道结果能不能信。

DevKit 的定位是反过来的：**功能上完全可信，人格上持续玩梗**。

### 为什么"可信"是可验证的

这不是口号，是工程约束：

| 承诺 | 兑现方式 |
|---|---|
| 逻辑正确 | 425 个单元测试，覆盖全部工具的纯逻辑层；cron 工具 statements 覆盖率 96.9% |
| 出错可定位 | JSON 错误定位到行列，Base64 非法字符定位到具体位置，URL 百分号编码错误给出下标 |
| 不假装万能 | 哈希是单向函数就说不可逆；DES/MD5/PKCS#1 不支持就说明原因，绝不假装能解 |
| 算错了会报错 | 错误密钥必须抛错，不允许返回一段"看起来像明文"的垃圾 |

### 为什么"玩梗"不会砸掉可信度

有一条硬规矩：**安全相关的文案不许开玩笑**。

- 识别出 MD5 时不说"破解你的哈希"，说「这是哈希，单向函数。我要是能把它反解回原文，那我建议你换个行业。」
- 识别出 Base64 时点破「它没锁门，只是换了件衣服——本质是编码，不是加密。」
- 没有密钥时明说「算法我认得，但没有钥匙，我只能看着它。」

玩梗只出现在轻松场景（输入为空、加载示例、复制成功），越严肃的地方越正经。这个分寸是产品能同时保住个性和信任的原因。

### 恶搞可以一键关掉

分享给同事时，构建前设一个环境变量，全站退回纯专业 UI：

```bash
VITE_DEVKIT_TONE=off npm run build
```

实现方式是把每条文案都写成对：业务代码只写 `pick(['玩梗版', '正经版'])`，语气开关决定取哪一个。**不需要改任何组件**。

---

## 核心功能

7 个工具，全部三端可用（桌面 / 移动 / 离线），零登录。

### 1. JSON 格式化 `/tools/json`

美化、压缩、按 key 排序（数组保持原序），三种缩进风格。

**招牌功能是错误定位**：输入坏 JSON 时精确到「第 N 行 第 M 列」，并回显出错的整行原文。

> 招牌功能是错误定位：输入坏 JSON 时精确到「第 N 行 第 M 列」，并回显出错的整行原文。

**实现原理**：V8 的报错格式分两种——长输入给 `at position 42 (line 3 column 5)`，短输入则改成 `Unexpected token '}', "{"a":}" is not valid JSON` **且不给位置**。而短 JSON 恰恰是最常见输入，所以直接用引擎的 position 会让招牌功能在主场景失效。项目为此实现了显式栈的 JSON 扫描器兜底：用状态机而非递归（深层嵌套的坏 JSON 不能把调用栈打爆），且只回答「第一个让解析无法继续的位置」。引擎有位置时以引擎为准，没有才用扫描器，两边都没有则返回 `null`——**宁可少说，不给编造的行列**。

- 大文件保护：超过 500KB（按 UTF-8 字节算）直接短路，不进 `JSON.parse`
- 判空 → 判体积 → 解析，顺序不能反，否则一份 10MB 的坏 JSON 会先把页面卡死，再谈报错

### 2. 时间戳转换 `/tools/timestamp`

秒/毫秒双向转换，**自动识别位数**（10 位按秒、13 位按毫秒），8 个时区切换。

**实现原理**：不用第三方日期库。位数识别按量级判断；时区换算用「两步法」——先用 UTC 猜一个时刻，用目标时区格式化后读回墙上时间，再用这个墙上时间反解纪元毫秒，第二遍结果对夏令时切换当天也成立。相对时间是自实现的 7 档分级（秒/分/时/天/月/年/刚刚），支持过去与未来两个方向。

- 相对时间（3 分钟前 / 2 天后）
- ISO 8601、RFC 3339 输出
- 夏令时边界用两步法处理，墙上时间 ↔ 纪元毫秒可逆
- 非法时区名退回系统时区，不抛错
- 示例数据能被自身解析器吃下（有回归测试保证）

### 3. Base64 编解码 `/tools/base64`

**UTF-8 中文友好**——原生 `btoa` 遇到中文直接抛 `InvalidCharacterError`。

**实现原理**：先用 `TextEncoder` 把文本编成 UTF-8 字节，再分块（0x8000 字节）用 `String.fromCharCode(...chunk)` 拼成 binary 串交给 `btoa`。分块是必须的——直接展开整个数组在大文本上会栈溢出。解码方向用 `atob` 拿回 binary，再逐字节喂给 `TextDecoder`。

- URL-safe 变体（`+` → `-`，`/` → `_`）
- 文件拖拽 → DataURL；反向 Base64 → 文件下载
- 二进制负载下载为 `.bin` 而不是伪装成 `.txt`（用启发式判断「像不像文本」）
- 非法字符定位到具体是哪个字符

### 4. URL 编解码 `/tools/url`

双向编解码 + URL 结构拆解 + **Query 参数双向生成**（表格编辑 → 拼回 URL）。

**实现原理**：用浏览器原生 `URL` 与 `URLSearchParams` 解析结构。但**逐层编码不走 `new URL()`**——它会规范化原始输入，把已经合法的部分也改掉。改为手工拆分 protocol / host / path / query / hash 五个层，只对用户勾选的层做转义，保证未选中的层字节级不变。用 `encodeOnce` 检测已有的 `%XX`，避免二次编码。

- 逐层编码（只编码 query / 只编码 path / 只编码 hash），未选中的层字节级不变
- 不会对已有的 `%XX` 二次编码
- IDN → punycode、端口提取
- parse → build → parse 稳定性测试

### 5. Cron 表达式 `/tools/cron`

- **人类可读解释**：`0 9 * * 1-5` → 「每周一至周五 09:00」
- 接下来 5 次运行时间，带星期几与相对时间
- 完整字段校验（别名大小写 / `L` / `#` / 步长 / 区间）
- 常见模板一键输入
- 诚实的「做不到」清单：`@annually` / `@midnight` / `@reboot` / `@every 1h` 明确标注不支持

**实现原理**：**不自造 cron 语义**。运行时间交给 `cron-parser` 的 `parseExpression`，项目只做两件事——校验字段（因为库的报错信息对用户不友好）与生成人类可读解释。字段校验用状态机逐段扫，识别步长、区间、别名、`L`、`#`；描述生成则把每个字段翻译成中文短语再按优先级组合（月/日/星期/年）。

> 两个踩坑记录：
> 1. `cron-parser` 4.9 **会就地修改传入的 `options` 对象**——`parseNthDay` 把 `#` 的结果写回 `options.nthDayOfWeek`。复用同一个 options 字面量会让之后每一次解析都被静默污染，表现为莫名的 `loop limit exceeded`。项目每次调用都新建 options，并加了回归测试锁死。
> 2. 实测确认 4.9 **原生支持六段式（首段秒）**，不需要自己剥秒段；它不支持的是 `@annually` / `@midnight` / `@reboot` / `@every 1h` 这几个别名。`?`、`L`、`5#3` 是支持的，会给提醒但不当错误。

### 6. 文本 Diff `/tools/diff`

行级三色 + **字符级内部对比** + 同步滚动。

**实现原理**：行级差异用 `diff` 库的 `diffLines`，修改行内部再跑一次 `diffChars` 做字符级定位。**同步滚动**的关键是左右两栏渲染的是**同一份行数组**，所以第 N 行在两边必然同行——按比例同步 `scrollTop` 即可，不需要做行号映射。

防循环用了两道：程序化赋值前置 `syncing` 标志位，且**下一帧才解锁**（因为赋值触发的 `scroll` 事件是异步派发的，同帧解锁会抖）；再加一道 `requestAnimationFrame` 合并，保证同一帧内不会被自己的事件再触发一次。

- 整行替换识别为 `modified` 而不是"一增一删"
- 忽略空白 / 忽略大小写，两个选项可叠加
- 统一视图模式（`+`/`-` 前缀流式输出）
- 200KB 阈值保护

### 7. 解码 / 解密工作台 `/tools/codec`

**全套里唯一有安全边界的工具**，也是最复杂的。

粘贴一段看不懂的东西 → 自动嗅探类型 → 列出可行路径 → 点一下出结果。

**自动嗅探**支持 12 类：JWT、二进制、Hex、哈希（SHA-1/256/384/512）、Base64URL、OpenSSL `Salted__`、RSA 密文、Base64、URL 编码、Unicode 转义、HTML 实体、Morse。

> 嗅探顺序刻意偏离直觉：**Hex 必须排在 Base64 之前**——十六进制字符集是 Base64 的子集，任何 hex 串语法上都是合法 Base64，按直觉顺序 MD5 永远会被判成 base64，哈希分支形同虚设。纯 `0/1` 优先判二进制同理。

**多层解码**最多 5 层，四道防垃圾闸门：
1. 重复检测（`Set`）
2. 结果必须像样文本（控制字符 < 5%）
3. **必须严格变短**——编码只会增长，不变短就是识别错了
4. Morse 严格模式遇到未知符号整体失败（宽松版会把普通中文吃成 `?` 当成合法结果）

第 3 条和第 4 条都是实测踩出来的：不加变短检查时，`ÿþ` 这种两字节垃圾会被当成合法解码结果；不加 Morse 严格模式时，普通中文会被吃成 `?` 并当成成功。

**加解密**（只用 Web Crypto API，**禁止自研密码学**）：

| 能力 | 状态 |
|---|---|
| AES-CBC / AES-GCM 往返 | ✅ 支持（密码短语走 PBKDF2 派生，或直接给 Hex 密钥） |
| RSA 解密（PKCS#8） | ✅ 支持 OAEP |
| RSA 密钥对生成 | ✅ 支持 2048 / 3072 / 4096 |
| 哈希计算 SHA-1/256/384/512 | ✅ 支持 |
| MD5 | ❌ Web Crypto 规范里就没有，Node 与浏览器一致 |
| DES / 3DES | ❌ Web Crypto 未实现；纯 JS 实现有侧信道风险且 3DES 已被 NIST 弃用 |
| PKCS#1 私钥（`BEGIN RSA PRIVATE KEY`） | ❌ 只吃 PKCS#8，界面主动提示转换命令 |
| 加密私钥（`BEGIN ENCRYPTED PRIVATE KEY`） | ❌ 无法被 Web Crypto 导入 |

---

## 技术栈

### 选型总表

| 层 | 选型 | 版本 | 为什么是它 |
|---|---|---|---|
| 框架 | **Vue** | ^3.5 | 工具页面是高交互密度表单，组合式 API 的逻辑复用收益最大 |
| 语言 | **TypeScript** | ~6.0 | 工具集本质是字符串处理，类型是最主要防线 |
| 构建 | **Vite** | ^8.3 | 冷启动快，产物拆包可控 |
| 路由 | **Vue Router** | ^4.6 | 一个通用容器 + 参数即可，不需要每工具一条路由 |
| 状态 | **Pinia** | ^3.0 | **只用于跨工具**（主题、偏好）；单工具状态一律 `ref` |
| 编辑器 | **CodeMirror 6** | ^6.0 | 行号 + 语法高亮需求；模块化远轻于 Monaco |
| Cron | **cron-parser** | **锁定 4.9.x** | 成熟稳定；5.x 是破坏性变更（API 从函数改为 class） |
| Diff | **diff** | ^5.2 | 字符级 diff 成熟稳定 |
| 测试 | **Vitest** | ^5.0 | 与 Vite 同源，零配置；Node 24 的 Web Crypto 可直接用，无需 mock |
| Lint | **ESLint 10** | flat config | Vue 官方推荐 |
| 格式 | **Prettier** | ^3.x | 与 ESLint 分工：Prettier 管格式，ESLint 管质量 |
| 样式 | **原生 CSS + CSS 变量** | — | 见下方取舍 |

### 关键取舍：不引入 UI 组件库

**不用 Element Plus / Naive UI / Ant Design Vue。**

| 维度 | 引入组件库 | 手写 CSS（本项目） |
|---|---|---|
| 双栏编辑器布局 | 需大量 `:deep` 覆写，改造成本高 | 直接写，20 行搞定 |
| 体积 | +80~300KB | +0 |
| 主题定制 | 处处对抗组件库设计语言 | 完全自由 |
| 维护成本 | 组件库大版本升级可能 break | 零依赖风险 |

工具站的 UI 高度定制（左右分栏、粘性操作条、同步滚动），组件库 80% 的能力用不上，只会在剩下 20% 的地方增加阻力。代价是表单控件要手写，用 `components/` 沉淀 6 个原子组件兜住。

### 产物拆包

构建产物证实了懒加载策略有效：

```
公共 chunk      54 KB (gzip 22 KB)
CodeEditor     413 KB (gzip 134 KB)   ← CodeMirror，按需加载
CronTool       102 KB (gzip  33 KB)   ← cron-parser，按需加载
CodecTool       30 KB (gzip  11 KB)
DiffTool        14 KB (gzip 5.7 KB)
...其余每个工具 7~11 KB，各自独立 chunk
```

**重依赖完全隔离**——打开 JSON 工具不会下载 CodeMirror 和 cron-parser。

---

## 架构设计

### 支点：工具注册表

最初加第 7 个工具要改三个文件（路由表、侧栏、首页卡片），漏一处就是半成品。改成单一注册表后，四处消费同一个清单：

```
              tools/registry.ts（唯一清单）
                        │
    ┌───────────┬───────┴────────┬──────────────┐
    ▼           ▼                ▼              ▼
router.ts   BasicLayout      HomeView      搜索 / 命令面板
 生成路由     生成侧栏          生成卡片
```

**加工具 = 新建 `src/tools/<id>/` 一个文件夹 + 注册表加一行**，框架文件一行不动。

### 强制三层分离

```
core.ts        纯函数，零 Vue 零 DOM 零副作用 → 可单测，未来可搬到 CLI / Worker
useXxxTool.ts  响应式编排，只调 core 不算业务
XxxTool.vue    只渲染，不含业务分支
```

两条硬约定：**禁止自研加密算法**（一律 Web Crypto，不可支持就标注不支持）；**允许异步但禁止副作用**（相同输入必须相同输出，测试环境可直接调用）。

### 恶搞隔离带

所有文案集中在 `src/content/`，业务组件禁止写吐槽文案：

```
src/content/
├── pick.ts          语气总闸：pick(['梗', '正经'])
├── strings.ts       全站正经文案
├── quips.ts         恶搞文案（每条成对）
├── easter-eggs.ts   彩蛋定义表
└── meta.ts          站点元信息
```

新增彩蛋 = 数组加一行，不改任何组件。

### 更多

完整的架构决策、目录结构、维护难度评估与版本策略见 **[ARCHITECTURE.md](./ARCHITECTURE.md)**。

---

## 隐私与安全边界

| 项目 | 承诺 |
|---|---|
| 计算位置 | 100% 在浏览器内完成 |
| 网络请求 | 除加载静态资源外，**零** |
| 数据留存 | 历史记录只写 localStorage，可一键清除 |
| 追踪 | 无埋点、无分析脚本、无第三方 |
| 账号 | 不需要 |

`codec` 工具会诱导用户粘贴真实密文和令牌，正因如此它才必须本地计算。

**密钥绝不写进 localStorage**（密钥输入框用 `type="password"`，仅存在于组件内存）。

---

## 质量保障

```
npm run check     # lint + typecheck + test + build 聚合
```

| 关卡 | 工具 | 门槛 |
|---|---|---|
| 静态检查 | ESLint 10 | 0 error 0 warning |
| 类型检查 | vue-tsc | strict 模式，exit 0 |
| 单元测试 | Vitest 5 | **425 例全绿** |
| 覆盖率 | v8 | 只统计纯逻辑层，lines/functions ≥ 80% |
| 构建 | Vite | 必须成功 |

**测试范围是有意划定的**：`core.ts` / `crypto.ts` / `sniffer.ts` / `utils` 必测；`.vue` **不测**——组件薄到只有渲染，测了是自欺欺人。

---

## 快速开始

```bash
git clone https://github.com/<you>/devkit.git
cd devkit
npm install
npm run dev          # http://localhost:8090
```

### 环境要求

Node ≥ 20（开发环境实测 v24.15.0）、npm ≥ 10。

### 常用命令

```bash
npm run dev            # 开发服务器（端口 8090）
npm run check          # 全量检查：lint + typecheck + test + build
npm run lint           # ESLint
npm run format         # Prettier 格式化
npm run test           # 单元测试
npm run test:coverage  # 覆盖率报告
npm run build          # 生产构建
npm run preview        # 预览构建产物
```

### 玩梗开关

```bash
# PowerShell
$env:VITE_DEVKIT_TONE="off"; npm run build

# 或复制 .env.example 为 .env 后修改
```

---

## 项目结构

```
devkit/
├── index.html                    # HTML 入口（含深色模式防闪烁脚本）
├── package.json                  # 依赖与脚本（check = 聚合命令）
├── vite.config.ts                # 构建配置（@ 别名、端口 8090）
├── vitest.config.ts              # 测试配置（覆盖率只统计纯逻辑层）
├── eslint.config.ts              # Lint（关闭与 Prettier 冲突的规则）
├── tsconfig*.json                # TS 配置（拆三份）
│
├── README.md                     # 本文件
├── ARCHITECTURE.md               # 架构决策 / 技术选型 / 风险登记 / 版本路线
├── CONTRIBUTING.md               # 加工具 SOP / 质量红线 / 提交前自检
├── docs/
│   └── FILE-STRUCTURE.md         # ★ 逐文件职责说明（96 个文件全列）
│
└── src/
    ├── main.ts                   # 入口：只做装配，零业务
    ├── App.vue                   # 根组件：最薄，只渲染 RouterView
    │
    ├── app/
    │   └── router.ts             # 由注册表驱动的路由表
    │
    ├── tools/                    # ★ 工具区（加工具只动这里）
    │   ├── shared.ts             # ToolDefinition 契约
    │   ├── define.ts             # 补 status/order/keywords 默认值
    │   ├── registry.ts           # ★ 全站唯一工具清单
    │   │
    │   ├── json/                 # ┐
    │   ├── base64/               # │
    │   ├── url/                  # │
    │   ├── timestamp/            # ├ 每个工具都是三层结构：
    │   ├── cron/                 # │   core.ts       纯函数，可单测
    │   ├── diff/                 # │   useXxxTool.ts 响应式编排
    │   └── codec/                # ┘   XxxTool.vue   只渲染
    │                              #     index.ts      ToolDefinition
    │                              #     __tests__/    core 单测
    │
    ├── components/               # 6 个复用原子组件
    │   ├── ToolShell.vue         #   页面外壳（含常驻提示条）
    │   ├── ToolPanel.vue         #   左右双栏，窄屏自动堆叠
    │   ├── ActionBar.vue         #   操作按钮条
    │   ├── ResultBox.vue         #   输出区（空/错/正常三态 + 复制）
    │   ├── CodeEditor.vue        #   CodeMirror 封装（全站唯一接触点）
    │   ├── EasterEggHost.vue     #   彩蛋宿主
    │   └── types.ts              #   ActionItem 等共享类型
    │
    ├── composables/
    │   ├── useClipboard.ts       #   复制 + 两级降级
    │   ├── useDebounced.ts       #   输入防抖
    │   ├── useEasterEgg.ts       #   彩蛋触发引擎
    │   └── useToolHistory.ts     #   最近使用（只写 localStorage）
    │
    ├── content/                  # ★ 文案层（恶搞隔离带）
    │   ├── pick.ts               #   语气总闸 pick(['梗','正经'])
    │   ├── strings.ts            #   正经文案
    │   ├── quips.ts              #   恶搞文案（7 工具，每条成对）
    │   ├── easter-eggs.ts        #   彩蛋定义表
    │   ├── meta.ts               #   站点元信息
    │   └── index.ts              #   统一出口
    │
    ├── layouts/
    │   └── BasicLayout.vue       # 侧栏菜单由注册表派生
    ├── views/
    │   ├── HomeView.vue          # 卡片网格 + 搜索
    │   ├── ToolsView.vue         # 通用容器：查注册表 → 懒加载
    │   └── NotFoundView.vue      # 404（兼彩蛋落点）
    ├── stores/
    │   └── prefs.ts              # Pinia：仅跨工具状态（主题）
    ├── styles/
    │   ├── tokens.css            # 设计 token（换肤只改这里）
    │   ├── reset.css             # 重置 + 可访问性
    │   └── main.css              # 导入上面 + 全站原子类
    │
    └── utils/                    # 纯函数：零业务、零 Vue
        ├── bytes.ts              #   字节 ↔ 文本/hex/二进制/八进制
        ├── base64.ts             #   UTF-8 安全 Base64 + URL-safe
        ├── encoding.ts           #   Unicode 转义、码位
        ├── charset.ts            #   编码检测与乱码修复
        ├── format.ts             #   文本统计、HTML 实体
        └── json-error.ts         #   安全解析 + 错误定位 + JSON 扫描器
```

> 📁 **逐文件的职责、大小、设计理由**见 [docs/FILE-STRUCTURE.md](./docs/FILE-STRUCTURE.md)

---

## 加工具的流程

```bash
# 1. 建目录并写 core.ts（纯函数，必须有单测）
src/tools/<id>/{index,core,use<Id>Tool,<Id>Tool}.vue

# 2. 在 src/tools/registry.ts 数组加一行
# 3. npm run check
```

路由、侧栏、首页卡片会自动出现。完整规范见 **[CONTRIBUTING.md](./CONTRIBUTING.md)**。

---

## 版本路线

| 版本 | 主题 | 状态 |
|---|---|---|
| v0.2.0 | 立骨架：注册表机制 + 7 个工具 + 425 测试 | ✅ 当前 |
| v0.3.0 | 补短板：最近使用、全局搜索、快捷键体系、深色主题 | 计划 |
| v0.4.0 | 离线：PWA，断网全功能可用 | 计划 |
| v0.5.0 | 扩编：正则测试 / JWT / UUID / Hash / 颜色转换等 | 计划 |
| v1.0.0 | 定版：彩蛋系统 + CI + 语义化版本 + CHANGELOG | 计划 |

---

## 文档索引

| 文档 | 内容 |
|---|---|
| [README.md](./README.md) | 项目解析、功能清单、技术栈、隐私承诺（**你在这里**） |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架构决策、目录设计依据、维护难度评估、版本路线、风险登记 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 加工具 SOP、三层分离规范、质量红线、提交前自检清单 |
| [docs/FILE-STRUCTURE.md](./docs/FILE-STRUCTURE.md) | **逐文件**职责、大小、设计理由（96 个文件全列） |

---

## License

[MIT](./LICENSE)
