import { describe, expect, it } from 'vitest'

import {
  countTextStats,
  decodeHtmlEntities,
  encodeHtmlEntities,
  hasHtmlEntity,
  toFixedNumber,
  truncate,
} from '../format'

describe('countTextStats', () => {
  it('空串全为 0（lines 尤其）', () => {
    const s = countTextStats('')
    expect(s.chars).toBe(0)
    expect(s.lines).toBe(0)
    expect(s.words).toBe(0)
    expect(s.bytes).toBe(0)
  })

  it('多行文本', () => {
    const s = countTextStats('hello world\nfoo bar')
    expect(s.lines).toBe(2)
    expect(s.words).toBe(4)
    expect(s.chars).toBe(19)
    expect(s.charsNoSpace).toBe(16)
  })

  it('统计中文字符', () => {
    expect(countTextStats('你好世界').cjk).toBe(4)
    expect(countTextStats('你好abc世界').cjk).toBe(4)
  })

  it('中文字节数大于字符数', () => {
    expect(countTextStats('中').bytes).toBe(3)
    expect(countTextStats('a').bytes).toBe(1)
  })

  it('最长行长度', () => {
    expect(countTextStats('ab\nabcdef\nab').maxLineLength).toBe(6)
  })
})

describe('toFixedNumber', () => {
  it('加千分位', () => {
    expect(toFixedNumber(1234567)).toBe('1,234,567')
    expect(toFixedNumber(0)).toBe('0')
  })
})

describe('truncate', () => {
  it('不超长时原样返回', () => {
    expect(truncate('abc', 5)).toBe('abc')
    expect(truncate('abcde', 5)).toBe('abcde')
  })

  it('超长时截断并加省略号', () => {
    expect(truncate('abcdefgh', 3)).toBe('abc…')
    expect(truncate('abcdefgh', 3, '...')).toBe('abc...')
  })

  it('空串', () => {
    expect(truncate('', 5)).toBe('')
  })
})

describe('HTML 实体', () => {
  it('解码常见实体', () => {
    expect(decodeHtmlEntities('&lt;a&gt;&amp;&quot;')).toBe('<a>&"')
    expect(decodeHtmlEntities('&#65;&#x42;')).toBe('AB')
  })

  it('解码保持中文', () => {
    expect(decodeHtmlEntities('&#20013;&#25991;')).toBe('中文')
  })

  it('未知实体原样保留', () => {
    expect(decodeHtmlEntities('&unknownentity;')).toBe('&unknownentity;')
    expect(decodeHtmlEntities('no entity')).toBe('no entity')
  })

  it('编码后能再解码回来', () => {
    const text = `<a href="x">A & B 'C'</a>`
    expect(decodeHtmlEntities(encodeHtmlEntities(text))).toBe(text)
  })

  it('中括号不被无谓转义', () => {
    expect(encodeHtmlEntities('中文[1]')).toBe('中文[1]')
  })

  it('hasHtmlEntity 判定', () => {
    expect(hasHtmlEntity('a &amp; b')).toBe(true)
    expect(hasHtmlEntity('&#x1F41B;')).toBe(true)
    expect(hasHtmlEntity('a & b')).toBe(false)
  })
})
