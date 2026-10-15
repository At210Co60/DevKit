/**
 * 全站 UI 文案（正经版）—— 不参与玩梗，任何语气下都保持一致
 * 玩梗内容一律在 quips.ts
 */

export const ui = {
  common: {
    copy: '复制',
    copied: '已复制到剪贴板',
    copyFailed: '复制失败，请手动选择文本复制',
    clear: '清空',
    loadSample: '加载示例',
    swap: '交换左右',
    run: '执行',
    reset: '重置',
    download: '下载',
    upload: '上传',
    encoding: '编码',
    decoding: '解码',
    encrypt: '加密',
    decrypt: '解密',
    input: '输入',
    output: '输出',
    keyword: '密钥',
    working: '处理中…',
    options: '选项',
    noResultHint: '暂无结果',
  },
  home: {
    toolCount: (n: number) => `${n} 个工具`,
    allTools: '全部工具',
    searchPlaceholder: '搜索工具，支持别名，例如 b64、jwt、时间戳',
    emptyResult: '没找到匹配的工具',
    privacyTitle: '本地优先',
    privacyDesc: '所有计算在你的浏览器内完成，不发送到任何服务器。我们不采集、不追踪、不需要账号。',
  },
  nav: {
    home: '首页',
    tools: '工具箱',
    toggleSidebar: '切换侧栏',
    backHome: '返回首页',
  },
  notFound: {
    title: '页面不存在',
    desc: '你要找的工具可能还没造出来，或者地址敲错了。',
    action: '回首页看看',
  },
  /** 敏感操作区的隐私承诺 —— 这是功能承诺，不是免责声明 */
  privacy: {
    localOnly: '所有计算在你的浏览器内完成，数据不会离开这台设备。',
    safeToPaste: '可以放心粘贴真实数据。',
  },
  /** URL 工具的结构面板与 Query 编辑器（中性标签，不参与玩梗） */
  url: {
    structure: 'URL 结构',
    structureHint: '面板显示的是规范化后的结果：中文域名会被转成 punycode，路径与参数会被百分号编码。',
    queryTitle: 'Query 参数',
    queryHint: '直接改表格即可，改完可以写回输入框。',
    addRow: '加一行',
    removeRow: '删除',
    applyQuery: '写回输入框',
    emptyRow: '没有可编辑的参数',
    autoDetect: '智能识别',
  },
  /** Cron 工具的分区标题 */
  cron: {
    presets: '常用模板',
    summary: '整体含义',
    fields: '字段含义',
    warnings: '注意事项',
    upcoming: (count: number) => `接下来 ${count} 次运行`,
    timezone: '时区',
    limitations: '已知限制',
  },
  /** 文本 Diff 的选项与统计 */
  diff: {
    left: '原始文本',
    right: '对比文本',
    result: '对比结果',
    options: '选项',
    ignoreWhitespace: '忽略空白',
    ignoreCase: '忽略大小写',
    copyResult: '复制差异',
    identical: '两段完全一致',
    truncated: (max: number) => `差异行数超过 ${max} 行，仅展示前 ${max} 行`,
    added: '新增',
    removed: '删除',
    changed: '修改',
    unchanged: '相同',
  },
} as const
