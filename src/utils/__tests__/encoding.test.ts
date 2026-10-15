import { describe, expect, it } from 'vitest'

import {
  codePointsToText,
  decodeUnicodeEscape,
  encodeUnicodeEscape,
  hasUnicodeEscape,
  textToCodePoints,
} from '../encoding'

describe('Unicode 转义', () => {
  it('中文往返', () => {
    const text = '中文字符'
    expect(decodeUnicodeEscape(encodeUnicodeEscape(text))).toBe(text)
  })

  it('纯 ASCII 不被转义', () => {
    expect(encodeUnicodeEscape('abc123')).toBe('abc123')
  })

  it('中英混合', () => {
    const text = 'DevKit 码匠 v0.2'
    expect(decodeUnicodeEscape(encodeUnicodeEscape(text))).toBe(text)
  })

  it('超过 BMP 的字符用 \\u{...}，不能被 \\uXXXX 截断', () => {
    // 回归测试：码位 1F41B 若写成 \u1f41b，解码会得到 '\u1f41' + 'b'
    const text = '🐛'
    const escaped = encodeUnicodeEscape(text)
    expect(escaped).toBe('\\u{1F41B}')
    expect(decodeUnicodeEscape(escaped)).toBe('🐛')
  })

  it('emoji 与中文混排往返', () => {
    const text = '码匠 🐛 ✨ v1'
    expect(decodeUnicodeEscape(encodeUnicodeEscape(text))).toBe(text)
  })

  it('能解别人写的 \\uXXXX', () => {
    expect(decodeUnicodeEscape('\\u4e2d\\u6587')).toBe('中文')
  })

  it('能解别人写的 \\u{...}', () => {
    expect(decodeUnicodeEscape('\\u{4E2D}\\u{6587}')).toBe('中文')
  })

  it('混合两种写法', () => {
    expect(decodeUnicodeEscape('a\\u4e2d\\u{6587}🐛')).toBe('a中文🐛')
  })
})

describe('码位', () => {
  it('文本 → 码位', () => {
    expect(textToCodePoints('A中')).toBe('0041 4E2D')
  })

  it('码位 → 文本往返', () => {
    expect(codePointsToText('0041 4E2D 6587')).toBe('A中文')
  })

  it('支持 0x 前缀与无空格输入', () => {
    expect(codePointsToText('0x41,0x4E2D')).toBe('A中')
  })

  it('空输入返回空串', () => {
    expect(codePointsToText('   ')).toBe('')
  })

  it('超范围码位报错', () => {
    expect(() => codePointsToText('110000')).toThrow(/非法/)
    expect(() => codePointsToText('FFFFFFF')).toThrow(/非法/)
  })
})

describe('判定', () => {
  it('识别 \\uXXXX', () => {
    expect(hasUnicodeEscape('\\u4e2d')).toBe(true)
  })

  it('识别 \\u{...}', () => {
    expect(hasUnicodeEscape('\\u{1F41B}')).toBe(true)
  })

  it('普通文本不误判', () => {
    expect(hasUnicodeEscape('普通中文')).toBe(false)
    expect(hasUnicodeEscape('')).toBe(false)
  })
})
