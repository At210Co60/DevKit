import { describe, expect, it } from 'vitest'

import {
  decodeBytes,
  detectEncoding,
  hasReplacementChar,
  isSupportedEncoding,
  isValidUtf8,
  repairUtf8AsLatin1,
} from '../charset'
import { textToBytes } from '../bytes'

/** gbk 等历史编码依赖运行环境的 ICU 支持，不支持时跳过而不是伪装通过 */
const hasGbk = isSupportedEncoding('gbk')

describe('UTF-8 合法性', () => {
  it('合法 UTF-8 字节', () => {
    expect(isValidUtf8(textToBytes('中文 abc 🐛'))).toBe(true)
  })

  it('非法 UTF-8 字节', () => {
    expect(isValidUtf8(new Uint8Array([0xc3, 0x28]))).toBe(false)
  })

  it('纯 ASCII 恒为合法', () => {
    expect(isValidUtf8(textToBytes('plain ascii'))).toBe(true)
  })
})

describe('decodeBytes', () => {
  it('默认按 UTF-8', () => {
    expect(decodeBytes(textToBytes('你好'))).toBe('你好')
  })

  it('可指定编码', () => {
    expect(decodeBytes(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]), 'gbk')).toBe('中文')
  })

  it('不支持的编码会抛错', () => {
    expect(() => decodeBytes(new Uint8Array([1]), '不存在的编码')).toThrow()
  })
})

describe('detectEncoding', () => {
  it('纯 ASCII 判为 utf-8', () => {
    expect(detectEncoding(textToBytes('hello'))).toBe('utf-8')
  })

  it('含中文的合法 UTF-8 判为 utf-8', () => {
    expect(detectEncoding(textToBytes('你好'))).toBe('utf-8')
  })

  it('空字节判为 utf-8', () => {
    expect(detectEncoding(new Uint8Array(0))).toBe('utf-8')
  })

  it.skipIf(!hasGbk)('GBK 字节判为 gbk', () => {
    expect(detectEncoding(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]))).toBe('gbk')
  })
})

describe('hasReplacementChar', () => {
  it('含 U+FFFD 时为真', () => {
    expect(hasReplacementChar('a\uFFFDb')).toBe(true)
  })

  it('正常文本为假', () => {
    expect(hasReplacementChar('正常文本')).toBe(false)
  })
})

describe('repairUtf8AsLatin1', () => {
  it('修复 UTF-8 被误读成 Latin-1 的经典乱码', () => {
    // '你好' 的 UTF-8 字节被当作 Latin-1 解读后的结果
    const mojibake = bytesToLatin1(textToBytes('你好'))
    expect(repairUtf8AsLatin1(mojibake)).toBe('你好')
  })

  it('正常文本不该被改，返回 null', () => {
    expect(repairUtf8AsLatin1('plain ascii')).toBeNull()
    expect(repairUtf8AsLatin1('正常中文')).toBeNull()
  })

  it('含替换字符的救不回来，返回 null', () => {
    expect(repairUtf8AsLatin1('a\uFFFDb')).toBeNull()
  })
})

/** 测试辅助：把 UTF-8 字节按 Latin-1 映射成字符串（即制造 mojibake） */
function bytesToLatin1(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('')
}
