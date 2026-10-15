import { describe, expect, it } from 'vitest'

import { formatJson, minifyJson, offsetToLineCol, parseJson, sortJsonKeys } from '../json-error'

describe('offsetToLineCol', () => {
  const src = 'line1\nline2\nline3'

  it('首字符是 1 行 1 列', () => {
    expect(offsetToLineCol(src, 0)).toEqual({ line: 1, column: 1 })
  })

  it('行内偏移', () => {
    expect(offsetToLineCol(src, 2)).toEqual({ line: 1, column: 3 })
  })

  it('换行后的第一列是 1', () => {
    expect(offsetToLineCol(src, 6)).toEqual({ line: 2, column: 1 })
  })

  it('越界被夹紧而不是抛错', () => {
    // src 共 17 字符，最后一个 \n 在索引 11，故 17 - 11 = 6
    expect(offsetToLineCol(src, 9999)).toEqual({ line: 3, column: 6 })
    expect(offsetToLineCol(src, -5)).toEqual({ line: 1, column: 1 })
  })
})

describe('parseJson', () => {
  it('合法对象', () => {
    const r = parseJson<{ a: number }>('{"a":1}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.a).toBe(1)
  })

  it('中文 key 与值', () => {
    const r = parseJson<{ 名字: string }>('{"名字":"码匠"}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.名字).toBe('码匠')
  })

  it('保持 key 顺序', () => {
    const r = parseJson('{"z":1,"a":2}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(Object.keys(r.value as object)).toEqual(['z', 'a'])
  })

  it('非法 JSON 返回结构化错误而不是抛异常', () => {
    const r = parseJson('{"a":}')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.message).toBeTruthy()
      expect(r.error.message).not.toContain('at position')
    }
  })

  it('错误位置能换算成行列', () => {
    const src = '{\n  "a": 1,\n  "b": oops\n}'
    const r = parseJson(src)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.position).not.toBeNull()
      expect(r.error.line).toBe(3)
      expect(r.error.column).not.toBeNull()
    }
  })

  it('空串是非法 JSON', () => {
    expect(parseJson('').ok).toBe(false)
  })
})

describe('formatJson', () => {
  it('2 空格缩进', () => {
    const r = formatJson('{"a":1,"b":2}', '2')
    expect(r.ok && r.value).toBe('{\n  "a": 1,\n  "b": 2\n}')
  })

  it('4 空格缩进（默认）', () => {
    const r = formatJson('{"a":1}')
    expect(r.ok && r.value).toBe('{\n    "a": 1\n}')
  })

  it('Tab 缩进', () => {
    const r = formatJson('{"a":1}', 'tab')
    expect(r.ok && r.value).toBe('{\n\t"a": 1\n}')
  })

  it('嵌套结构', () => {
    const r = formatJson('{"a":{"b":[1,2]}}', '2')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toContain('"b"')
  })

  it('非法输入时透传错误', () => {
    const r = formatJson('{bad}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toBeTruthy()
  })
})

describe('minifyJson', () => {
  it('去掉所有空白', () => {
    const r = minifyJson('{\n  "a": 1,\n  "b": [1, 2]\n}')
    expect(r.ok && r.value).toBe('{"a":1,"b":[1,2]}')
  })

  it('中文字符不被转义', () => {
    const r = minifyJson('{ "名字": "码匠" }')
    expect(r.ok && r.value).toBe('{"名字":"码匠"}')
  })
})

describe('sortJsonKeys', () => {
  it('递归排序 key', () => {
    const r = sortJsonKeys('{"z":1,"a":{"y":2,"b":3},"m":4}', '2')
    expect(r.ok).toBe(true)
    if (r.ok) {
      const parsed = JSON.parse(r.value) as Record<string, unknown>
      expect(Object.keys(parsed)).toEqual(['a', 'm', 'z'])
      expect(Object.keys(parsed.a as object)).toEqual(['b', 'y'])
    }
  })

  it('数组顺序保持不变', () => {
    const r = sortJsonKeys('{"list":[3,1,2]}', '2')
    expect(r.ok).toBe(true)
    if (r.ok) expect((JSON.parse(r.value) as { list: number[] }).list).toEqual([3, 1, 2])
  })

  it('非法输入时透传错误', () => {
    expect(sortJsonKeys('[unclosed').ok).toBe(false)
  })
})
