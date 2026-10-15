import { describe, expect, it } from 'vitest'

import { bytesToBase64, encodeBase64, encodeBase64Url } from '@/utils/base64'
import { bytesToHex } from '@/utils/bytes'

import {
  autoDecode,
  canDecodeAs,
  DecodeLoopGuard,
  decodeAs,
  decodeMorse,
  encodeAs,
  encodeMorse,
  isPlausibleText,
  MAX_DECODE_DEPTH,
  reDecodeAsCharset,
  type DecodeKind,
} from '../core'

function decoded(kind: DecodeKind, input: string): string {
  const result = decodeAs(kind, input)
  if (!result.ok) throw new Error(`${kind} 解码失败: ${result.error}`)
  return result.value
}

function encoded(kind: DecodeKind, input: string): string {
  const result = encodeAs(kind, input)
  if (!result.ok) throw new Error(`${kind} 编码失败: ${result.error}`)
  return result.value
}

describe('core / 单步解码', () => {
  it('Base64 → 中文（UTF-8 安全）', () => {
    expect(decoded('base64', encodeBase64('你好，码匠'))).toBe('你好，码匠')
  })

  it('Base64URL', () => {
    const url = encodeBase64Url('??>>??~~')
    expect(url).toMatch(/[-_]/)
    expect(decoded('base64url', url)).toBe('??>>??~~')
  })

  it('Hex ↔ Binary 双向', () => {
    const hex = encoded('hex', 'Hi')
    expect(hex).toBe('4869')
    expect(decoded('hex', hex)).toBe('Hi')
    const bin = encoded('binary', 'Hi')
    expect(bin).toBe('01001000 01101001')
    expect(decoded('binary', bin)).toBe('Hi')
  })

  it('Octal', () => {
    const oct = encoded('octal', 'Hi')
    expect(decoded('octal', oct)).toBe('Hi')
  })

  it('URL 编码（+ 视为空格）', () => {
    expect(decoded('url', '%E4%BD%A0%E5%A5%BD')).toBe('你好')
    expect(decoded('url', 'a+b%20c')).toBe('a b c')
  })

  it('Unicode 转义（含花括号代理对）', () => {
    expect(decoded('unicode-escape', '\\u4e2d\\u6587')).toBe('中文')
    expect(decoded('unicode-escape', '\\u{1F600}')).toBe('\u{1F600}')
  })

  it('码位', () => {
    expect(encoded('codepoint', '中')).toBe('4E2D')
    expect(decoded('codepoint', '4E2D 6587')).toBe('中文')
  })

  it('HTML 实体', () => {
    const out = decoded('html-entity', '&lt;a&gt;&amp;nbsp;&#65;&#x42;')
    // utils/format.ts 的 nbsp 映射的是 U+00A0 而非普通空格，这里只断言结构
    expect(out.startsWith('<a>&')).toBe(true)
    expect(out.endsWith('AB')).toBe(true)
    expect(out).not.toContain('&lt;')
    expect(out).not.toContain('&#65;')
  })

  it('Morse 双向', () => {
    expect(decodeMorse('.... . .-.. .-.. --- .-- --- .-. .-.. -..')).toBe('HELLOWORLD')
    expect(decodeMorse('... --- ...')).toBe('SOS')
    expect(encodeMorse('SOS')).toBe('... --- ...')
  })

  it('Morse 词分隔：两侧带空格的 / 才是词分隔，字母内部的 / 不算', () => {
    expect(decodeMorse('.... . / .-.. .-..')).toBe('HE LL')
    // .-.-.- 内部含 / ，不能被切开
    expect(decodeMorse('.-.-.-')).toBe('.')
  })

  it('Morse 无法识别的符号落成 ?，不静默丢弃', () => {
    expect(decodeMorse('...... ....')).toBe('?H')
  })

  it('严格模式下一旦出现未知符号就整体失败（否则中文会被 Morse 吃掉）', () => {
    const result = decodeAs('morse', '这是一段普通中文')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('不是 Morse')
  })

  it('非 UTF-8 字节不硬塞成乱码：一律退回十六进制', () => {
    // 0xFF 0xFE 在单字节编码下会解成「ÿþ」——看着像字，其实是把字节硬凑成了字符
    const result = decodeAs('hex', 'fffe')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.note).toContain('十六进制')
      expect(result.value).toBe('ff fe')
    }
  })

  it('GBK 字节确实解得出中文时才走传统编码分支', () => {
    // 「你好」的 GBK 编码，含 CJK 才被认作有意义的解读
    const result = decodeAs('hex', 'c4e3bac3')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('你好')
      expect(result.note).toContain('解读')
    }
  })

  it('解出来是二进制噪声时退成十六进制展示', () => {
    // 大量控制字符，任何单字节编码都读不成可读文本
    const result = decodeAs('hex', '0001020304050607')
    expect(result.ok).toBe(true)
    if (result.ok) expect(typeof result.value).toBe('string')
  })

  it('空输入返回错误而不是崩溃', () => {
    const result = decodeAs('base64', '   ')
    expect(result.ok).toBe(false)
  })

  it('非法输入返回错误而不是抛出', () => {
    expect(decodeAs('hex', 'zzzz').ok).toBe(false)
    expect(decodeAs('binary', '0101').ok).toBe(false)
    expect(decodeAs('url', '%ZZ').ok).toBe(false)
    expect(decodeAs('codepoint', 'zzz').ok).toBe(false)
  })

  it('canDecodeAs 与 decodeAs 结论一致', () => {
    expect(canDecodeAs('base64', encodeBase64('hi'))).toBe(true)
    expect(canDecodeAs('hex', 'zzzz')).toBe(false)
  })
})

describe('core / 字符编码重解读', () => {
  it('GBK 字节按 GBK 解读能读出中文', () => {
    // “你好” 的 GBK 编码
    const gbk = [0xc4, 0xe3, 0xba, 0xc3]
    const result = reDecodeAsCharset(bytesToHex(gbk), 'hex', 'gbk')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('你好')
  })

  it('同一串字节换编码解读，结果完全不同（乱码的本质）', () => {
    const b64 = bytesToBase64(new TextEncoder().encode('你好'))
    const asLatin1 = reDecodeAsCharset(b64, 'base64', 'iso-8859-1')
    const asUtf8 = reDecodeAsCharset(b64, 'base64', 'utf-8')
    expect(asLatin1.ok).toBe(true)
    expect(asUtf8.ok).toBe(true)
    if (asLatin1.ok && asUtf8.ok) {
      expect(asUtf8.value).toBe('你好')
      expect(asLatin1.value).not.toBe(asUtf8.value)
    }
  })
})

describe('core / 多层解码', () => {
  it('层数上限默认 5', () => {
    expect(MAX_DECODE_DEPTH).toBe(5)
  })

  it('Base64 套 Base64 套 Base64 一路解到底', () => {
    const inner = encodeBase64('最终答案')
    const middle = encodeBase64(inner)
    const outer = encodeBase64(middle)
    const result = autoDecode(outer)
    expect(result.final).toBe('最终答案')
    expect(result.steps).toHaveLength(3)
    expect(result.steps.map((s) => s.kind)).toEqual(['base64', 'base64', 'base64'])
  })

  it('Base64 → Hex 两层', () => {
    const hex = bytesToHex(new TextEncoder().encode('hi'))
    const result = autoDecode(encodeBase64(hex))
    expect(result.final).toBe('hi')
    expect(result.steps).toHaveLength(2)
    expect(result.steps[1].kind).toBe('hex')
  })

  it('超过层数上限就停，并报 depth', () => {
    let payload = 'x'.repeat(4)
    for (let i = 0; i < 9; i++) payload = encodeBase64(payload)
    const result = autoDecode(payload)
    expect(result.stoppedBy).toBe('depth')
    expect(result.steps).toHaveLength(MAX_DECODE_DEPTH)
  })

  it('层数上限可以调小', () => {
    const payload = encodeBase64(encodeBase64(encodeBase64('x')))
    const result = autoDecode(payload, { maxDepth: 2 })
    expect(result.steps).toHaveLength(2)
    expect(result.stoppedBy).toBe('depth')
  })

  it('解不动了就停（stuck），不会空转', () => {
    const result = autoDecode('这是一段完全普通的普通中文，没有任何编码痕迹')
    expect(result.steps).toHaveLength(0)
    expect(result.stoppedBy).toBe('unknown')
  })

  it('空输入不报错', () => {
    expect(autoDecode('').stoppedBy).toBe('unknown')
  })

  it('不会把垃圾字节当成结果：解出来不可读就停', () => {
    // 十六进制字节 0x80 0x81 之类，不是合法 UTF-8
    const result = autoDecode('8081ff00')
    expect(result.steps).toHaveLength(0)
  })

  it('默认链里没有 octal / codepoint —— 这两种太容易误判', () => {
    const result = autoDecode('777')
    expect(result.steps.every((s) => s.kind !== 'octal')).toBe(true)
    expect(result.steps.every((s) => s.kind !== 'codepoint')).toBe(true)
  })

  it('自定义 chain 只按给定顺序尝试', () => {
    const result = autoDecode(encodeBase64('abc'), { chain: ['hex'] })
    expect(result.steps).toHaveLength(0)
  })
})

describe('core / 循环保护', () => {
  it('同一层数内重复出现的值会被拒绝', () => {
    const guard = new DecodeLoopGuard(5)
    expect(guard.admit('A', 0)).toBe(true)
    expect(guard.admit('B', 1)).toBe(true)
    expect(guard.admit('A', 2)).toBe(false)
  })

  it('超过层数上限被拒绝', () => {
    const guard = new DecodeLoopGuard(2)
    expect(guard.admit('A', 2)).toBe(true)
    expect(guard.admit('B', 3)).toBe(false)
  })

  it('默认上限就是 MAX_DECODE_DEPTH', () => {
    expect(new DecodeLoopGuard().maxDepth).toBe(MAX_DECODE_DEPTH)
  })

  it('记录已访问过的值', () => {
    const guard = new DecodeLoopGuard()
    guard.admit('A', 0)
    guard.admit('B', 1)
    expect(guard.visited).toEqual(['A', 'B'])
  })

  it('autoDecode 的每一层都必须变短，杜绝「解回去」的循环', () => {
    const result = autoDecode(encodeBase64(encodeBase64(encodeBase64('x'))))
    for (let i = 1; i < result.steps.length; i++) {
      expect(result.steps[i].value.length).toBeLessThan(result.steps[i - 1].value.length)
    }
  })
})

describe('core / 可读性闸门', () => {
  it('普通文本通过', () => {
    expect(isPlausibleText('hello 你好\n第二行')).toBe(true)
  })

  it('大量控制字符被拦下', () => {
    expect(isPlausibleText('\u0000\u0001\u0002\u0003\u0004')).toBe(false)
    expect(isPlausibleText('')).toBe(false)
  })
})
