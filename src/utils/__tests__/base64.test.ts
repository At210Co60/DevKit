import { describe, expect, it } from 'vitest'

import {
  base64ToBytes,
  bytesToBase64,
  decodeBase64,
  decodeBase64Url,
  encodeBase64,
  encodeBase64Url,
  isBase64,
  isBase64Url,
  normalizePadding,
} from '../base64'

describe('Base64 往返', () => {
  it('ASCII', () => {
    expect(encodeBase64('hello world')).toBe('aGVsbG8gd29ybGQ=')
    expect(decodeBase64('aGVsbG8gd29ybGQ=')).toBe('hello world')
  })

  it('中文 —— 这是原生 btoa 会直接抛错的地方', () => {
    const text = '你好，世界'
    const encoded = encodeBase64(text)
    expect(encoded).toBe('5L2g5aW977yM5LiW55WM')
    expect(decodeBase64(encoded)).toBe(text)
  })

  it('emoji（4 字节序列）', () => {
    const text = '🐛 虫子'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('空串', () => {
    expect(encodeBase64('')).toBe('')
    expect(decodeBase64('')).toBe('')
  })

  it('大文本不会栈溢出（分块逻辑）', () => {
    const big = 'a'.repeat(300_000) + '中文结尾'
    expect(decodeBase64(encodeBase64(big))).toBe(big)
  })
})

describe('URL-safe Base64', () => {
  it('替换 + 与 / 且不产生 = 之外的特殊字符', () => {
    // 构造一定会产生 + 和 / 的输入
    const raw = encodeBase64('ûÿ¾>>>')
    const urlSafe = encodeBase64Url('ûÿ¾>>>')
    expect(urlSafe).not.toContain('+')
    expect(urlSafe).not.toContain('/')
    expect(decodeBase64Url(urlSafe)).toBe('ûÿ¾>>>')
    expect(raw.length).toBe(urlSafe.length)
  })

  it('URL-safe 能解标准 base64url 输入', () => {
    expect(decodeBase64Url('5L2g5aW977yM')).toBe('你好，')
  })
})

describe('normalizePadding', () => {
  it('补齐缺失的 =', () => {
    expect(normalizePadding('aGVsbG8')).toBe('aGVsbG8=')
    expect(normalizePadding('aGVsbG8=')).toBe('aGVsbG8=')
  })

  it('余数为 1 是非法的，必须报错', () => {
    // 长度 % 4 === 1 在任何编码下都不可能出现
    expect(() => normalizePadding('abcde')).toThrow(/非法/)
  })

  it('忽略空白', () => {
    expect(normalizePadding(' aGVs bG8 ')).toBe('aGVsbG8=')
  })
})

describe('判定', () => {
  it('isBase64', () => {
    expect(isBase64('aGVsbG8gd29ybGQ=')).toBe(true)
    expect(isBase64('TWFu')).toBe(true) // RFC 4648 里的 "Man"，确实是合法 Base64
    expect(isBase64('!!!!')).toBe(false)
    expect(isBase64('abc')).toBe(false) // 长度不足 4
    expect(isBase64('')).toBe(false)
  })

  it('isBase64Url 需要出现 - 或 _，否则与标准 Base64 无法区分', () => {
    // 用自身编码生成，避免手算 base64url 时算错
    const urlSafe = encodeBase64Url('ûÿ¾>>>')
    expect(urlSafe).toMatch(/[-_]/)
    expect(isBase64Url(urlSafe)).toBe(true)
    // JWT 的 header 恰好不含 -/_，此时与标准 Base64 无异，不应判为 url-safe
    expect(isBase64Url('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(false)
    expect(isBase64Url('aGVsbG8')).toBe(false)
  })
})

describe('bytes 桥接', () => {
  it('bytesToBase64 / base64ToBytes 与文本版一致', () => {
    const bytes = new Uint8Array([1, 2, 3, 250])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it('base64ToBytes 能吃 URL-safe 输入', () => {
    expect(base64ToBytes('-_-_')).toEqual(new Uint8Array([251, 255, 191]))
  })
})
