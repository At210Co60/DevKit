import { describe, expect, it } from 'vitest'

import { quips } from '@/content'

import {
  buildDataUrl,
  convert,
  decodeText,
  decodeToBytes,
  describeSize,
  encodeText,
  guessExtension,
  invertMode,
  isDataUrl,
  isEncodeMode,
  normalizeBase64,
  parseDataUrl,
  planDownload,
  stripDataUrlPrefix,
} from '../core'

/**
 * core 层是唯一能自动证明正确的一层，所以这里盯三件事：
 * 1. 中文 UTF-8 往返（Base64 工具最容易翻车的地方）
 * 2. 非法输入必须给结构化错误，不许抛未捕获异常
 * 3. DataURL / 下载方案的边界
 */

/** 三个 ASCII 标点，其中一个编出来带 '+' / '/'，正好卡住标准与 URL-safe 字母表的差异 */
const TRIPLE = String.fromCharCode(0x3f, 0x3f, 0x3e)
const TRIPLE_B64 = 'Pz8+'
const TRIPLE_B64_URL = 'Pz8-'

describe('encodeText —— UTF-8 中文', () => {
  it('编码中文正确（btoa 的 Latin-1 坑）', () => {
    const result = encodeText('你好')
    expect(result.ok).toBe(true)
    expect(result.ok && result.value).toBe('5L2g5aW9')
  })

  it('中英混排也能编对', () => {
    const result = encodeText('Hello, 世界')
    expect(result.ok && result.value).toBe('SGVsbG8sIOS4lueVjA==')
  })

  it('byteLength 按 UTF-8 字节算，不按字符数算', () => {
    const result = encodeText('你好')
    // 2 个中文字符 = 6 字节，而不是 2
    expect(result.ok && result.byteLength).toBe(6)
  })

  it('换行与空格会被原样编码，不被吃掉', () => {
    const result = encodeText('a\nb')
    expect(result.ok && result.value).toBe('YQpi')
    expect(result.ok && result.byteLength).toBe(3)
  })
})

describe('decodeText —— 中文往返', () => {
  it('中文往返无损', () => {
    const source = '你好，码匠 —— UTF-8 中文往返测试'
    const encoded = encodeText(source)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return

    const decoded = decodeText(encoded.value)
    expect(decoded.ok).toBe(true)
    expect(decoded.ok && decoded.value).toBe(source)
  })

  it('emoji（代理对）往返无损', () => {
    const source = '🛠️ 工具箱'
    const encoded = encodeText(source)
    if (!encoded.ok) throw new Error('encode failed')

    const decoded = decodeText(encoded.value)
    expect(decoded.ok && decoded.value).toBe(source)
  })

  it('content 里的示例与其 Base64 严格对应', () => {
    const decoded = decodeText(quips.base64.sampleEncoded)
    expect(decoded.ok && decoded.value).toBe(quips.base64.sampleText)
  })

  it('省略末尾 = 也能解（很多来源都这么干）', () => {
    const result = decodeText('SGVsbG8')
    expect(result.ok && result.value).toBe('Hello')
  })

  it('允许换行与空格混在 Base64 里', () => {
    const result = decodeText('SGVs\n bG8=')
    expect(result.ok && result.value).toBe('Hello')
  })
})

describe('URL-safe', () => {
  it('编码后不含 + / ', () => {
    const result = encodeText(TRIPLE, true)
    expect(result.ok && result.value).toBe(TRIPLE_B64_URL)
    expect(result.ok && result.value.includes('+')).toBe(false)
    expect(result.ok && result.value.includes('/')).toBe(false)
  })

  it('URL-safe 往返无损（解码时两张字母表等价）', () => {
    const source = `${TRIPLE}中文`
    const encoded = encodeText(source, true)
    if (!encoded.ok) throw new Error('encode failed')

    const decoded = decodeText(encoded.value)
    expect(decoded.ok && decoded.value).toBe(source)
  })

  it('标准模式保持 + / 原样', () => {
    const result = encodeText(TRIPLE)
    expect(result.ok && result.value).toBe(TRIPLE_B64)
  })
})

describe('convert —— 按模式分发', () => {
  it('encode 模式原样处理明文输入', () => {
    const result = convert('你好', 'encode')
    expect(result.ok && result.value).toBe('5L2g5aW9')
  })

  it('decodeUrl 模式能解 URL-safe 输入', () => {
    const result = convert(TRIPLE_B64_URL, 'decodeUrl')
    expect(result.ok && result.value).toBe(TRIPLE)
  })

  it('decode 模式会剥掉 DataURL 前缀', () => {
    const result = convert('data:text/plain;base64,SGVsbG8=', 'decode')
    expect(result.ok && result.value).toBe('Hello')
  })

  it('解码模式下空输入返回 empty，不抛异常', () => {
    for (const mode of ['decode', 'decodeUrl'] as const) {
      const result = convert('', mode)
      expect(result.ok).toBe(false)
      expect(!result.ok && result.code).toBe('empty')
    }
  })

  it('编码模式下空输入是合法结果：空串编出空串', () => {
    for (const mode of ['encode', 'encodeUrl'] as const) {
      const result = convert('', mode)
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe('')
      expect(result.ok && result.byteLength).toBe(0)
    }
  })
})

describe('非法输入 —— 结构化错误', () => {
  it('含中文字符的伪 Base64 报 invalidChar 并指出字符', () => {
    const result = decodeText('这不是Base64')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.code).toBe('invalidChar')
    expect(!result.ok && result.detail).toContain('这')
  })

  it('非法符号报 invalidChar', () => {
    const result = decodeText('SGVsbG8*')
    expect(!result.ok && result.code).toBe('invalidChar')
  })

  it('= 出现在中间报 invalidChar', () => {
    const result = decodeText('SG=sbG8')
    expect(!result.ok && result.code).toBe('invalidChar')
  })

  it('长度 %4 余 1 报 badLength', () => {
    const result = decodeText('SGVsbG8AB')
    expect(!result.ok && result.code).toBe('badLength')
  })

  it('二进制载荷报 notUtf8，而不是给一屏乱码', () => {
    // PNG magic：合法 Base64，但不是合法 UTF-8
    const result = decodeText('iVBORw==')
    expect(!result.ok && result.code).toBe('notUtf8')
  })

  it('空白输入在字节层也算 empty', () => {
    const result = decodeToBytes('   ')
    expect(!result.ok && result.code).toBe('empty')
  })
})

describe('DataURL', () => {
  const png = 'data:image/png;base64,iVBORw=='

  it('识别与剥前缀', () => {
    expect(isDataUrl(png)).toBe(true)
    expect(isDataUrl('SGVsbG8=')).toBe(false)
    expect(stripDataUrlPrefix(png)).toBe('iVBORw==')
    expect(normalizeBase64(`  ${png}\n`)).toBe('iVBORw==')
  })

  it('拆出 MIME 与原始字节', () => {
    const result = parseDataUrl(png)
    expect(result.ok).toBe(true)
    expect(result.ok && result.value.mime).toBe('image/png')
    expect(result.ok && Array.from(result.value.bytes)).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('非 DataURL 返回 invalidDataUrl', () => {
    const result = parseDataUrl('SGVsbG8=')
    expect(!result.ok && result.code).toBe('invalidDataUrl')
  })

  it('字节 → DataURL → 字节 往返一致', () => {
    const bytes = new Uint8Array([1, 2, 3, 250])
    const back = parseDataUrl(buildDataUrl(bytes, 'application/octet-stream'))
    expect(back.ok && Array.from(back.value.bytes)).toEqual(Array.from(bytes))
  })
})

describe('planDownload —— 下载方案（不算 Blob，只算方案）', () => {
  it('DataURL 按原 MIME 还原成原文件', () => {
    const result = planDownload('data:image/png;base64,iVBORw==')
    expect(result.ok).toBe(true)
    expect(result.ok && result.value.mime).toBe('image/png')
    expect(result.ok && result.value.filename.endsWith('.png')).toBe(true)
  })

  it('能解成文本就给 .txt', () => {
    const result = planDownload('5L2g5aW9')
    expect(result.ok && result.value.filename.endsWith('.txt')).toBe(true)
    expect(result.ok && result.value.mime).toContain('text/plain')
  })

  it('二进制内容给 .bin，不猜错类型', () => {
    const result = planDownload('iVBORw==')
    expect(result.ok && result.value.filename.endsWith('.bin')).toBe(true)
    expect(result.ok && result.value.mime).toBe('application/octet-stream')
  })

  it('空输入返回 empty', () => {
    const result = planDownload('  ')
    expect(!result.ok && result.code).toBe('empty')
  })

  it('非法输入不抛异常', () => {
    const result = planDownload('这不是')
    expect(result.ok).toBe(false)
  })
})

describe('辅助函数', () => {
  it('MIME → 扩展名，未知给 .bin，大小写不敏感', () => {
    expect(guessExtension('image/png')).toBe('.png')
    expect(guessExtension('IMAGE/PNG')).toBe('.png')
    expect(guessExtension('text/html; charset=utf-8')).toBe('.html')
    expect(guessExtension('application/x-unknown')).toBe('.bin')
  })

  it('体积描述小于 1KB 不啰嗦', () => {
    expect(describeSize(0)).toBe('0 B')
    expect(describeSize(512)).toBe('512 B')
    expect(describeSize(2048)).toBe('2048 B · 2.0 KB')
  })

  it('模式判断与互逆', () => {
    expect(isEncodeMode('encode')).toBe(true)
    expect(isEncodeMode('decode')).toBe(false)
    expect(invertMode('encode')).toBe('decode')
    expect(invertMode('encodeUrl')).toBe('decodeUrl')
    expect(invertMode(invertMode('decodeUrl'))).toBe('decodeUrl')
  })
})
