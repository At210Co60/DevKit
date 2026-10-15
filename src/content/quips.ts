import { pick } from './pick'

/**
 * 恶搞文案库 —— 玩梗与正经成对出现
 *
 * 写作原则：
 * 1. 梗要贴在真实体验上，不要油腻、不碰具体人群
 * 2. 安全相关的文案**不许开玩笑**（如哈希不可逆、无密钥不能解密），越严肃越可信
 * 3. 每条都写好正经版兜底
 */

export const quips = {
  /** 全站通用 */
  global: {
    copied: pick(['复制了，手感不错', '已复制到剪贴板']),
    copyFailed: pick(['复制失败，你的浏览器在闹脾气', '复制失败，请手动选择文本复制']),
    cleared: pick(['清空了，干净', '已清空']),
    loaded: pick(['示例已就位，随便改', '已加载示例']),
    noResult: pick(['啥也没算出来', '无结果']),
  },

  json: {
    empty: pick(['你倒是贴点东西进来啊', '请输入 JSON 内容']),
    formatted: pick(['整形完毕，这段 JSON 现在体面多了', '格式化完成']),
    minified: pick(['压缩完成，塞回笼子里了', '压缩完成']),
    error: pick(['这 JSON 自己都承认它坏了', 'JSON 解析失败']),
    sample: pick(['来点标准 JSON 尝尝', '加载示例']),

    /* ── 功能标签：两种语气一致，不参与玩梗切换 ── */
    labelFormat: pick(['美化', '美化']),
    labelMinify: pick(['压缩', '压缩']),
    labelSort: pick(['排序', '排序']),
    labelIndent: pick(['缩进', '缩进']),
    indentTwo: pick(['2 空格', '2 空格']),
    indentFour: pick(['4 空格', '4 空格']),
    indentTab: pick(['Tab', 'Tab']),

    /* ── 状态与提示 ── */
    sorted: pick(['键名排好队了', '按 key 排序完成']),
    tooLarge: pick(['这一坨太胖了，先切一半再试', '内容过大，已跳过解析与渲染']),
    sizeText: (text: string) => pick([`输入体积 ${text}`, `输入体积 ${text}`]),
    lineCol: (line: number, column: number) => pick([`第 ${line} 行 第 ${column} 列`, `第 ${line} 行 第 ${column} 列`]),
  },

  base64: {
    empty: pick(['保险箱空着，扔点东西进去', '请输入内容']),
    encoded: pick(['已装箱', '编码完成']),
    decoded: pick(['开箱，字正腔圆', '解码完成']),
    error: pick(['这串 Base64 少了零件', 'Base64 解码失败']),
    fileOk: pick(['文件已塞进 DataURL', '文件转换完成']),
    notText: pick([
      '解出来不是人话，八成是图片或压缩包 —— 想拿回文件就用下面的下载',
      '解码结果不是合法的 UTF-8 文本，多半是二进制数据',
    ]),
    fileTooLarge: pick(['这文件太胖，浏览器一个人搬不动', '文件过大，已超出本地处理上限']),
    fileReadFailed: pick(['文件读不出来，多半被系统权限拦了', '文件读取失败']),
    downloaded: pick(['文件递到你手上了', '已开始下载']),
    isNotEncryption: pick([
      'Base64 是编码不是加密：它没锁门，只是换了件衣服。',
      'Base64 属于编码而非加密，无需密钥即可还原，请勿用它保护敏感数据。',
    ]),

    /* ── 以下为界面标签与示例数据：不随玩梗语气变化，故不走 pick() ── */
    title: 'Base64 编解码',
    tagline: 'UTF-8 中文友好 · 标准 / URL-safe 双向转换 · 文件转 DataURL',
    dropHint: '把文件拖到这里，转成 DataURL',
    dropActive: '松手，收下了',
    sampleText: '你好，码匠 🛠️ —— UTF-8 中文往返测试：你好，世界！',
    sampleEncoded:
      '5L2g5aW977yM56CB5YygIPCfm6DvuI8g4oCU4oCUIFVURi04IOS4reaWh+W+gOi/lOa1i+ivle+8muS9oOWlve+8jOS4lueVjO+8gQ==',
  },

  url: {
    empty: pick(['URL 拿来，别客气', '请输入 URL']),
    parsed: pick(['拆开了，协议、域名、路径、参数各归各位', '解析完成']),
    encoded: pick(['百分号已就位', '编码完成']),
    decoded: pick(['百分号卸下了', '解码完成']),
    error: pick(['这 URL 自己都看不懂自己', 'URL 解析失败']),
    detectedEncoded: pick(['这段八成已经编码过了', '检测到输入已编码']),
    detectedPlain: pick(['这已经是明文，没什么好解的', '输入看起来已经是原文']),
    invalidPercent: pick(['有段 % 没跟上两位十六进制，它不认', '存在非法的百分号转义序列']),
    inferred: pick(['输入没写协议，已按 https:// 解析', '输入未包含协议，已按 https:// 解析']),
    applyGenerated: pick(['拼好的 URL 已放回输入框', '已将拼接结果填回输入框']),

    /* ── 以下为界面标签与示例数据：不随玩梗语气变化，故不走 pick() ── */
    title: 'URL 编解码',
    tagline: '百分号编解码 · 结构拆解 · Query 参数可视化编辑',
    fields: {
      protocol: '协议',
      host: '主机与端口',
      hostname: '主机名',
      port: '端口',
      pathname: '路径',
      query: '查询串',
      hash: '片段',
    },
    keyPlaceholder: '参数名',
    valuePlaceholder: '参数值',
    addParam: '添加参数',
    removeParam: '删除该参数',
    sampleUrl: 'https://例子.测试/文档/第一 页?q=中文 关键词&tag=编码&page=1#第 2 节',
    sampleEncoded:
      'https%3A%2F%2F%E4%BE%8B%E5%AD%90.%E6%B5%8B%E8%AF%95%2F%E6%96%87%E6%A1%A3%2F%E7%AC%AC%E4%B8%80%20%E9%A1%B5%3Fq%3D%E4%B8%AD%E6%96%87%20%E5%85%B3%E9%94%AE%E8%AF%8D%26tag%3D%E7%BC%96%E7%A0%81%26page%3D1%23%E7%AC%AC%202%20%E8%8A%82',
  },

  cron: {
    empty: pick(['填个表达式，比如 0 0 * * *', '请输入 Cron 表达式']),
    valid: pick(['下次跑起来是…', '解析成功']),
    error: pick(['这表达式还没出生就不合法', 'Cron 表达式不合法']),
    explained: pick(['翻译成人话了', '字段含义']),

    sample: pick(['来点经典配置试试', '已加载示例']),
    noRun: pick(['这日子永远不会来，先别往 crontab 里贴', '未找到匹配时间']),
    limitations: pick(['有些 cron 它就是做不到，别为难它', 'cron-parser 表达不了的部分']),
    timeZone: pick(['时区错了，后面全错', '请选择一个有效时区']),
  },

  timestamp: {
    empty: pick(['给个数，秒或毫秒都行', '请输入时间戳或日期']),
    converted: pick(['时间是个好东西，就是不等你', '转换完成']),
    error: pick(['这个数字不是时间戳，别硬撑', '无效的时间戳']),
    now: pick(['此刻，就这一秒', '当前时间']),

    /* ── 输出项标签：两种语气一致 ── */
    labelSeconds: pick(['秒级时间戳', '秒级时间戳']),
    labelMillis: pick(['毫秒级时间戳', '毫秒级时间戳']),
    labelDateTime: pick(['日期时间', '日期时间']),
    labelIso: pick(['ISO 8601', 'ISO 8601']),
    labelWeekday: pick(['星期', '星期']),
    labelRelative: pick(['相对时间', '相对时间']),
    labelUnit: pick(['识别为', '识别为']),

    /* ── 单位与时区 ── */
    unitSeconds: pick(['秒', '秒']),
    unitMillis: pick(['毫秒', '毫秒']),
    unitDate: pick(['日期', '日期']),
    zoneLocal: pick(['本地时区', '本地时区']),
    zoneHint: pick(['按当前时区解读这段日期', '日期按所选时区解读']),
    formatHint: pick(['填秒、毫秒都行，或者写 2024-05-20 13:45:30', '支持秒/毫秒时间戳，或 YYYY-MM-DD HH:mm:ss 日期']),

    /* ── 相对时间 ── */
    relJustNow: pick(['刚刚', '刚刚']),
    relFuture: pick(['就在眼前', '马上']),
    relSecond: (amount: number, future: boolean) =>
      pick([future ? `${amount} 秒后` : `${amount} 秒前`, future ? `${amount} 秒后` : `${amount} 秒前`]),
    relMinute: (amount: number, future: boolean) =>
      pick([future ? `${amount} 分钟后` : `${amount} 分钟前`, future ? `${amount} 分钟后` : `${amount} 分钟前`]),
    relHour: (amount: number, future: boolean) =>
      pick([future ? `${amount} 小时后` : `${amount} 小时前`, future ? `${amount} 小时后` : `${amount} 小时前`]),
    relDay: (amount: number, future: boolean) =>
      pick([future ? `${amount} 天后` : `${amount} 天前`, future ? `${amount} 天后` : `${amount} 天前`]),
    relMonth: (amount: number, future: boolean) =>
      pick([future ? `${amount} 个月后` : `${amount} 个月前`, future ? `${amount} 个月后` : `${amount} 个月前`]),
    relYear: (amount: number, future: boolean) =>
      pick([future ? `${amount} 年后` : `${amount} 年前`, future ? `${amount} 年后` : `${amount} 年前`]),

    /* ── 错误细分 ── */
    errNotTimestamp: pick(['这串既不是数字，也不是个日期', '无法识别为时间戳或日期']),
    errInvalidDate: pick(['日期写得不成立，日历不认', '日期无效，请检查年 / 月 / 日 / 时 / 分 / 秒']),
    errOutOfRange: pick(['这数字超出了时间能表示的范围', '时间戳超出可表示范围']),
  },

  diff: {
    empty: pick(['左右都空着，diff 出个寂寞', '请输入要对比的内容']),
    same: pick(['一模一样，白忙一场', '两段内容完全相同']),
    differ: pick(['红绿对撞', '发现差异']),
    stats: pick(['改了多少，一目了然', '统计完成']),

    sample: pick(['左右都给你备好一段，剩下交给你', '已加载示例']),
    swapped: pick(['左右换了个个儿', '已交换左右内容']),
    tooLarge: pick(['文本快赶上本工具的内存预算了，再大就卡给你看', '内容较大（超过 200 KB），对比可能较慢']),
  },

  codec: {
    empty: pick(['扔点看不懂的东西进来，我瞅瞅', '请输入要分析的内容']),

    /* ── 以下安全类文案必须严肃，玩梗会砸掉产品可信度 ── */

    hashWarn: pick([
      '这是哈希，单向函数。我要是能把它反解回原文，那我建议你换个行业。',
      '这是哈希摘要，数学上不可逆，无法还原为原文。',
    ]),
    base64Warn: pick([
      '这是 Base64。它没锁门，只是换了件衣服——本质是编码，不是加密。',
      '这是 Base64 编码（而非加密），无需密钥即可还原。',
    ]),
    noKey: pick([
      '算法我认得，但没有钥匙，我只能看着它。',
      '缺少密钥，无法解密。密钥的正确来源只有两处：你自己的密码，或服务端给你的。',
    ]),
    notFound: pick(['这玩意儿我没见过。老实交代它是什么。', '未能识别该数据类型，请手动选择处理方式。']),
    /** 防止用户被「在线解密工具」骗了 */
    warning: pick([
      '没有谁能凭空解开一段密文。凡是声称「万能解密」的，要么有后门，要么在收集你的密钥。',
      '本工具不使用任何后端服务，所有运算在浏览器内完成。无法凭空还原的密文，同样在这里无法还原。',
    ]),
    /** 识别成功后的点评，可爱但不误导 */
    sniffed: (name: string) => pick([`闻出来了，这是 ${name}`, `识别为 ${name}`]),
    triedAll: pick(['能试的都试了，这是我最后的倔强', '已尝试全部可行的解码方式']),
    depthLimit: pick(['再解下去就该变成天书了，停。', '已达到最大解码层数。']),

    /* ── 以下是本次新增：只允许新增，不改上面任何一条 ── */

    /** 每个结果旁的本地计算标注 —— 这是功能承诺，不是修辞 */
    localOnlyTag: pick(['浏览器本地算的，一个请求都没发', '在浏览器本地完成，无网络请求']),
    /** 哈希：说清「能做什么」，避免用户以为工具没干活 */
    hashCanDo: pick(['能做的是拿它比对、去重、验一致性。', '可做：哈希比对与一致性校验。']),
    /** 密钥处理说明，贴在密钥输入框旁边 */
    secretHint: pick([
      '密钥只活在当前这个标签页的内存里，刷新就没了，也不写进本地存储。',
      '密钥仅存在于当前页面内存，不写入 localStorage。',
    ]),
    /** 识别到 OpenSSL 密文 */
    opensslDetected: pick([
      'OpenSSL 的加密数据（Salted__）。它是真加密，没有密码就是一串废字节。',
      '识别为 OpenSSL 加密数据（Salted__）。',
    ]),
    /** 手动选择处理方式 */
    chooseKind: pick(['要不你直接告诉我它是什么？', '请手动选择处理方式。']),
    /** 字符编码重解读的引导 */
    charsetPick: pick([
      '中文乱码基本都栽在编码对不上，换个编码把原始字节重读一遍试试。',
      '中文乱码通常是编码不匹配，请选择编码重新解读字节。',
    ]),
    /** RSA 密钥对已生成 */
    keyGenerated: pick(['密钥对生成了，只在内存里待着。', 'RSA 密钥对已生成（仅存在于当前页面内存）。']),

    /* ── 以下几条是「明确不支持」的声明，必须严肃 ── */

    unsupportedTitle: pick([
      '下面这些是本工具明确做不到的事，写在这儿比让你猜强。',
      '以下能力本工具明确不支持，原因如下。',
    ]),
    desUnsupported: pick([
      'DES / 3DES 不支持：浏览器原生 Web Crypto 只实现 AES / RSA / HMAC / SHA 系列，没有 DES。本工具不用不安全的纯 JS 实现顶替。',
      'DES / 3DES 不支持：Web Crypto 未实现该算法，且不接受不安全的纯 JS 替代实现。',
    ]),
    pkcs1Unsupported: pick([
      '这是 PKCS#1 老私钥（BEGIN RSA PRIVATE KEY），第一版不支持：Web Crypto 只吃 PKCS#8。先转一下再回来，openssl pkcs8 -topk8 -nocrypt -in old.pem -out new.pem',
      'PKCS#1 私钥暂不支持：Web Crypto 仅支持 PKCS#8，请先转换格式。',
    ]),
    pemEncryptedUnsupported: pick([
      '带口令的加密私钥（BEGIN ENCRYPTED PRIVATE KEY）不支持：Web Crypto 无法导入这种包装，请先解密成明文 PKCS#8。',
      '不支持带口令加密的私钥，请先转换为明文 PKCS#8。',
    ]),
    opensslUnsupported: pick([
      'OpenSSL 的 Salted__ 密文这一版只识别、不解密：解它得复刻 OpenSSL 专有的 EVP_BytesToKey 派生，硬做容易做错，我宁可先不做。',
      'OpenSSL Salted__ 密文暂仅支持识别，不提供解密。',
    ]),

    /** crypto.ts 抛 code，这里映射成人话。安全相关的文案不许抖机灵 */
    errors: {
      noWebCrypto: pick([
        '这个环境没有 Web Crypto，安全地做不了加密运算。',
        '当前环境不支持 Web Crypto，无法执行加密运算。',
      ]),
      keyMismatch: pick([
        '密钥不对，或者密文被改过。GCM 会明确报错；CBC 没有完整性校验，只能靠结果是否为合法 UTF-8 来判断。',
        '解密失败：密钥不匹配或密文已损坏。',
      ]),
      ivMissing: pick(['密文里没有 IV，无法解密。AES 需要 IV 才能解密。', '缺少 IV 参数，无法解密。']),
      badSecret: pick(['密钥填的不是合法十六进制。', '密钥不是合法的十六进制字符串。']),
      keyLength: pick(['密钥长度对不上：AES 只接受 128 / 192 / 256 位。', '密钥长度无效，AES 仅支持 128/192/256 位。']),
      emptySecret: pick(['还没填密钥。没有密钥我只能看着它。', '请先输入密钥。']),
      ciphertextFormat: pick(['密文不是合法的 Base64 或内容为空。', '密文格式无效。']),
      pemInvalid: pick(['这段 PEM 读不出来，检查一下头尾和 Base64 是否完整。', 'PEM 格式无效。']),
      rsaTooLong: pick(['明文太长，超出了这块 RSA 密钥能装下的长度。', '明文长度超出 RSA 密钥容量。']),
      rsaDecryptFailed: pick([
        'RSA 解密失败：私钥对不上，或密文不是用它加的。',
        'RSA 解密失败：私钥不匹配或密文无效。',
      ]),
      unsupported: pick(['这个算法浏览器原生不支持，本工具不做不安全替代。', '该算法不受支持（Web Crypto 未实现）。']),
      unknown: pick(['出了点意外，细节在下面。', '操作失败，详情见下。']),
    },
  },
} as const
