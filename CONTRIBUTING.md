# 给贡献者的指南

## 加一个新工具

这是本项目最常做的事，目标是**只动工具自己的目录 + 注册表一行**。

### 1. 建目录

```
src/tools/<id>/
├── index.ts          导出 ToolDefinition（唯一出口）
├── core.ts           纯函数：所有业务逻辑
├── use<Id>Tool.ts    组合式状态：编排
├── <Id>Tool.vue      只渲染
└── __tests__/
    └── core.test.ts  必须有
```

### 2. 写 core.ts

**硬性要求**：零 Vue、零 DOM、零副作用、零网络。全部输入输出走函数的参数与返回值。

```ts
// ✅ 正确
export function doSomething(input: string): Result<string> { ... }

// ❌ 错误：DOM 属于第 2 层的活
export function doSomething(input: string): string {
  const el = document.getElementById('out')
  el.textContent = ...
}
```

异常一律用抛错或返回 `{ ok: false, error }`，不要返回 `null` 让调用方猜。

唯一的例外是**必须走 Web Crypto 的模块**（`crypto.ts`），允许写 `async`，但仍禁止副作用——不能碰 DOM、不能发网络请求。

### 3. 写 index.ts

```ts
import { defineTool } from '../define'

export const myTool = defineTool({
  id: 'my',                    // URL 片段：/tools/my
  name: '我的工具',
  tagline: '一句话说明',
  icon: '🔧',
  category: 'text',            // encode | text | devops | security
  keywords: ['别名1', 'alias', '关键词'],
  status: 'wip',               // wip | beta | stable
  order: 90,                   // 越小越靠前
  component: () => import('./MyTool.vue'),   // 必须懒加载
})
```

`status` / `order` / `keywords` 省略也没问题，`defineTool` 会补默认值。

**`component` 必须写成懒加载**。每个工具独立 chunk 是硬要求——codec 工具比别的大一个量级，不能拖累其他工具的首屏。

### 4. 注册

在 `src/tools/registry.ts` 的数组里加一行，导进来。**到此为止**——路由、侧栏、首页卡片会自动出现。

### 5. 写测试

`__tests__/core.test.ts` 必须覆盖三类用例：

1. **正常路径** —— 典型输入 + 边界输入（空串、超长、纯空格）
2. **错误路径** —— 非法输入要报什么错
3. **中文与特殊字符** —— 这是工具集最容易翻车的地方

覆盖率只统计 `core.ts` / `crypto.ts` / `sniffer.ts` / `utils`，阈值 80%。**不要为了凑覆盖率去测 `.vue`**，组件薄到只有渲染，测了是自欺欺人。

### 6. 跑检查

```bash
npm run check
```

必须全绿才能提交。

---

## 组件约定

优先复用，别在工具里重写：

| 组件 | 用途 |
|---|---|
| `ToolShell` | 页面外壳：标题、tagline、常驻提示条（安全声明用 `notice`） |
| `ToolPanel` | 左右双栏容器，窄屏自动堆叠 |
| `ActionBar` | 操作按钮条，用 `ActionItem[]` 数据描述 |
| `ResultBox` | 输出区，自带复制按钮，内建空/错/正常三态 |
| `CodeEditor` | CodeMirror 封装。**业务代码禁止直接 import `codemirror`** |

样式一律用 `main.css` 里的原子类和 `tokens.css` 里的 CSS 变量，**不要写死颜色**——深色模式靠变量自动生效。

---

## 文案约定

这是本项目的特色，也是最容易写坏的地方。

1. **`.vue` 文件里禁止写吐槽文案**。一切从 `@/content` 取：
   ```ts
   import { quips, ui } from '@/content'
   quips.json.empty      // '你倒是贴点东西进来啊'
   ui.common.clear       // '清空'
   ```
2. **每条文案都成对**：`pick(['玩梗版', '正经版'])`。加新文案时两版都要写。
3. **安全相关的文案不许开玩笑**。哈希不可逆、无密钥不能解密这类内容，越严肃越可信。玩梗只出现在轻松场景。
4. 玩梗贴在真实体验上，不碰具体人群，不做人身攻击。

---

## 质量红线

以下几条不是风格偏好，是不可让步的约束：

1. **禁止自研加密算法**。一律用 Web Crypto API。宁可标注「不支持」，也不引入不安全的纯 JS 实现。
2. **禁止假装万能**。哈希是单向函数，DES 浏览器原生不支持，PKCS#1 私钥第一版不支持——这些都要在界面上明确说明原因。
3. **禁止声称「万能解密」**。没有密钥就是解不开，任何声称能做到的工具都有问题。
4. **纯逻辑层禁用 `any`**，ESLint 会拦。
5. **`cron-parser` 锁死 4.9.x**。5.x 是破坏性变更（API 从函数改为 class），升级要单独立一个版本做。

---

## 提交前自检

- [ ] `npm run check` 全绿
- [ ] 新工具有 `__tests__/core.test.ts` 且覆盖错误路径
- [ ] 没有在 `.vue` 里写中文吐槽
- [ ] `component` 是懒加载
- [ ] 只改了「工具自己的目录 + registry 一行」，没碰框架文件
- [ ] 新增文案成对写了玩梗版与正经版
