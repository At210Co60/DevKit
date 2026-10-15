import { describe, expect, it } from 'vitest'

import {
  binaryToBytes,
  bytesToBinary,
  bytesToHex,
  bytesToOctal,
  bytesToText,
  bytesToTextStrict,
  formatBytes,
  hexToBytes,
  isBinary,
  isHex,
  octalToBytes,
  textToBytes,
} from '../bytes'

describe('text ↔ bytes', () => {
  it('ASCII 往返', () => {
    expect(bytesToText(textToBytes('hello'))).toBe('hello')
  })

  it('中文 UTF-8 往返', () => {
    const text = '你好，码匠 DevKit ⌬'
    expect(bytesToText(textToBytes(text))).toBe(text)
  })

  it('emoji 代理对往返', () => {
    const text = '🐛✨🎉'
    expect(bytesToText(textToBytes(text))).toBe(text)
  })

  it('空串往返', () => {
    expect(textToBytes('').length).toBe(0)
    expect(bytesToText(new Uint8Array(0))).toBe('')
  })

  it('严格解码遇到非法字节序列会抛错，宽松解码不会', () => {
    const invalid = new Uint8Array([0xff, 0xfe, 0xfd])
    expect(() => bytesToTextStrict(invalid)).toThrow()
    expect(bytesToText(invalid)).toContain('\uFFFD')
  })
})

describe('hex', () => {
  it('往返', () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0xff, 0xa5])
    expect(bytesToHex(bytes)).toBe('000fffa5')
    expect(hexToBytes('000fffa5')).toEqual(bytes)
  })

  it('支持分隔符：空格 / 冒号 / 逗号 / 连字符', () => {
    expect(hexToBytes('de:ad:be:ef')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    expect(hexToBytes('de ad be ef')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    expect(hexToBytes('de,ad,be,ef')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    expect(hexToBytes('de-ad-be-ef')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('大写 hex 也能解析', () => {
    expect(hexToBytes('DEADBEEF')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('奇数长度报错', () => {
    expect(() => hexToBytes('abc')).toThrow(/偶数/)
  })

  it('非十六进制字符报错', () => {
    expect(() => hexToBytes('zz')).toThrow(/非十六进制/)
  })
})

describe('binary', () => {
  it('往返', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0xff])
    expect(bytesToBinary(bytes)).toBe('00000000 00000001 11111111')
    expect(binaryToBytes('00000000 00000001 11111111')).toEqual(bytes)
  })

  it('不是 8 的倍数报错', () => {
    expect(() => binaryToBytes('101')).toThrow(/8 的倍数/)
  })

  it('非二进制字符报错', () => {
    expect(() => binaryToBytes('0000000x')).toThrow(/非二进制/)
  })
})

describe('octal', () => {
  it('往返', () => {
    const bytes = new Uint8Array([0o101, 0o377]) // 65, 255
    expect(bytesToOctal(bytes)).toBe('101 377')
    expect(octalToBytes('101 377')).toEqual(bytes)
  })

  it('长度不是 3 的倍数必须报错，不能静默丢字节', () => {
    // 回归测试：修复前这里会少返回一个字节且不报错
    expect(() => octalToBytes('10137')).toThrow(/3 的倍数/)
    expect(() => octalToBytes('1013')).toThrow(/3 的倍数/)
  })

  it('单字节最大值 0377 可解析，超过则报错', () => {
    expect(octalToBytes('377')).toEqual(new Uint8Array([255]))
    expect(() => octalToBytes('400')).toThrow(/超出/)
  })

  it('非八进制字符报错', () => {
    expect(() => octalToBytes('8')).toThrow(/非八进制/)
  })
})

describe('判定', () => {
  it('isHex', () => {
    expect(isHex('deadbeef')).toBe(true)
    expect(isHex('DEADBEEF')).toBe(true)
    expect(isHex('deadbeef'.split('').join(' '))).toBe(true)
    expect(isHex('abc')).toBe(false) // 奇数长度
    expect(isHex('xyz')).toBe(false)
    expect(isHex('')).toBe(false)
  })

  it('isBinary', () => {
    expect(isBinary('10101010')).toBe(true)
    expect(isBinary('1010 1010')).toBe(true)
    expect(isBinary('101')).toBe(false)
    expect(isBinary('')).toBe(false)
  })
})

describe('formatBytes', () => {
  it('按量级切换单位', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB')
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB')
  })
})
