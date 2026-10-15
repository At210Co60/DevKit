import { describe, expect, it } from 'vitest'

import {
  JSON_INDENT_STYLES,
  JSON_LARGE_INPUT_BYTES,
  JSON_MODES,
  JSON_SAMPLE,
  countTopLevelKeys,
  extractLineText,
  isBlankInput,
  locateJsonError,
  locateJsonErrorOffset,
  measureInput,
  runJson,
} from '../core'
import { parseJson } from '@/utils/json-error'

/** 取 outcome 的文本，失败就让测试直接炸在断言上 */
function textOf(outcome: ReturnType<typeof runJson>): string {
  if (outcome.kind !== 'ok') throw new Error(`expected ok, got ${outcome.kind}`)
  return outcome.text
}

describe('isBlankInput', () => {
  it('空白字符与换行都算空', () => {
    expect(isBlankInput('')).toBe(true)
    expect(isBlankInput('   \n\t ')).toBe(true)
    expect(isBlankInput('{}')).toBe(false)
  })
})

describe('measureInput / 大输入保护', () => {
  it('中文按 UTF-8 字节计，字节数大于字符数', () => {
    const size = measureInput('中'.repeat(10))
    expect(size.chars).toBe(10)
    expect(size.bytes).toBe(30)
    expect(size.tooLarge).toBe(false)
  })

  it('超过阈值时 tooLarge 为 true', () => {
    const big = `"${'a'.repeat(JSON_LARGE_INPUT_BYTES)}"`
    expect(measureInput(big).tooLarge).toBe(true)
    expect(measureInput(big).bytes).toBeGreaterThan(JSON_LARGE_INPUT_BYTES)
  })
})

describe('runJson', () => {
  it('空输入不报错也不解析', () => {
    expect(runJson('   ', 'format').kind).toBe('blank')
  })

  it('超大输入直接短路，不进解析', () => {
    const big = `{ "a": "${'x'.repeat(JSON_LARGE_INPUT_BYTES)}" }`
    const outcome = runJson(big, 'format')
    expect(outcome.kind).toBe('oversized')
    if (outcome.kind === 'oversized') expect(outcome.bytes).toBeGreaterThan(JSON_LARGE_INPUT_BYTES)
  })

  it('三种缩进风格都能美化，且保留 key 顺序', () => {
    const source = '{"b":1,"a":2,"c":[1,2,3]}'
    for (const style of JSON_INDENT_STYLES) {
      const outcome = runJson(source, 'format', style)
      const text = textOf(outcome)
      expect(text.indexOf('"b"')).toBeLessThan(text.indexOf('"a"'))
      expect(text.split('\n').length).toBeGreaterThan(1)
    }
    expect(textOf(runJson(source, 'format', '2')).split('\n')[1]).toMatch(/^ {2}"b"/)
    expect(textOf(runJson(source, 'format', '4')).split('\n')[1]).toMatch(/^ {4}"b"/)
    expect(textOf(runJson(source, 'format', 'tab')).split('\n')[1]).toMatch(/^\t"b"/)
  })

  it('压缩后不含换行与多余空格', () => {
    expect(textOf(runJson('{\n  "a" : [ 1 , 2 ]\n}', 'minify'))).toBe('{"a":[1,2]}')
  })

  it('按 key 排序：对象键升序，数组保持原顺序', () => {
    const source = '{"b":{"z":1,"a":2},"a":[{"y":1,"x":2}]}'
    const sorted = textOf(runJson(source, 'sort', '2'))
    const keys = Object.keys(JSON.parse(sorted) as Record<string, unknown>)
    expect(keys).toEqual(['a', 'b'])
    const inner = (JSON.parse(sorted) as { a: Record<string, unknown>[] }).a
    expect(Object.keys(inner[0])).toEqual(['x', 'y'])
    const bInner = (JSON.parse(sorted) as { b: Record<string, unknown> }).b
    expect(Object.keys(bInner)).toEqual(['a', 'z'])
  })

  it('中文 key 与中文值不被转义成 \\u 序列', () => {
    const source = '{"姓名":"码匠","标签":["正经","玩梗"]}'
    const formatted = textOf(runJson(source, 'format', '2'))
    expect(formatted).toContain('"姓名": "码匠"')
    expect(formatted).toContain('"玩梗"')
    expect(formatted).not.toContain('\\u')
  })

  it('中文 key 排序稳定且可回解析', () => {
    const source = '{"北京":1,"上海":2,"广州":3}'
    const sorted = textOf(runJson(source, 'sort', '2'))
    const keys = Object.keys(JSON.parse(sorted) as Record<string, unknown>)
    expect(keys).toEqual([...keys].sort())
    expect(keys).toHaveLength(3)
  })

  it('语法错误返回带行列的信息', () => {
    const outcome = runJson('{\n  "a": 1,\n  "b": ,\n}', 'format')
    expect(outcome.kind).toBe('error')
    if (outcome.kind !== 'error') return
    expect(outcome.info.line).toBe(3)
    expect(outcome.info.column).toBeGreaterThanOrEqual(1)
    expect(outcome.info.message).toBeTruthy()
  })

  it('单行错误也能定位（不依赖引擎是否报行号）', () => {
    const outcome = runJson('{"a":1,}', 'minify')
    expect(outcome.kind).toBe('error')
    if (outcome.kind !== 'error') return
    expect(outcome.info.line).toBe(1)
  })

  it('非法输入（裸文本）走 error 而不是抛异常', () => {
    const outcome = runJson('这不是 JSON', 'format')
    expect(outcome.kind).toBe('error')
    if (outcome.kind !== 'error') return
    expect(typeof outcome.info.message).toBe('string')
  })

  it('每个声明的模式都能跑通', () => {
    for (const mode of JSON_MODES) {
      expect(runJson(JSON_SAMPLE, mode, '2').kind).toBe('ok')
    }
  })
})

describe('extractLineText', () => {
  const source = 'first\nsecond\nthird'

  it('按 1-based 行号取原文', () => {
    expect(extractLineText(source, 1)).toBe('first')
    expect(extractLineText(source, 3)).toBe('third')
  })

  it('越界与非正行号返回空串', () => {
    expect(extractLineText(source, 0)).toBe('')
    expect(extractLineText(source, 99)).toBe('')
  })

  it('超长行截断', () => {
    const long = 'x'.repeat(500)
    expect(extractLineText(long, 1)).toHaveLength(121)
  })
})

describe('countTopLevelKeys', () => {
  it('统计顶层键数量', () => {
    expect(countTopLevelKeys('{"a":1,"b":2}')).toBe(2)
  })

  it('数组、根标量与非法 JSON 返回 null', () => {
    expect(countTopLevelKeys('[1,2]')).toBeNull()
    expect(countTopLevelKeys('"text"')).toBeNull()
    expect(countTopLevelKeys('{oops}')).toBeNull()
  })
})

describe('JSON_SAMPLE', () => {
  it('示例本身是合法 JSON，且能往返美化', () => {
    expect(JSON.parse(JSON_SAMPLE)).toBeTypeOf('object')
    expect(textOf(runJson(JSON_SAMPLE, 'minify'))).toBe(JSON.stringify(JSON.parse(JSON_SAMPLE)))
  })
})

describe('locateJsonErrorOffset / 错误定位兜底', () => {
  const locate = (source: string) => {
    const offset = locateJsonErrorOffset(source)
    return offset === null ? null : extractLineText(source, source.slice(0, offset).split('\n').length)
  }

  it('合法 JSON 返回 null', () => {
    for (const source of ['{}', '[]', '{"a":1}', '[1,2,3]', '"中文"', 'null', 'true', '{"a":{"b":[1,{"c":null}]}}']) {
      expect(locateJsonErrorOffset(source), source).toBeNull()
    }
    expect(locateJsonErrorOffset('')).toBeNull()
    expect(locateJsonErrorOffset(JSON_SAMPLE)).toBeNull()
  })

  it('缺少值：指向出问题的那一行', () => {
    expect(locate('{\n  "a": 1,\n  "b": ,\n}')).toBe('  "b": ,')
  })

  it('尾逗号：指向逗号本身', () => {
    expect(locateJsonErrorOffset('{"a":1,}')).toBe(6)
    expect(locateJsonErrorOffset('[1,2,]')).toBe(4)
  })

  it('缺冒号 / 多余逗号 / 少一个右括号', () => {
    expect(locateJsonErrorOffset('{"a" 1}')).toBe(5)
    expect(locateJsonErrorOffset('{"a":1 "b":2}')).toBe(7)
    expect(locateJsonErrorOffset('{"a":1')).toBe(0)
    expect(locateJsonErrorOffset('[1,2')).toBe(0)
  })

  it('字符串未闭合指向开引号', () => {
    expect(locateJsonErrorOffset('{"a":"abc')).toBe(5)
  })

  it('根值之后还有内容时指向多余内容', () => {
    expect(locateJsonErrorOffset('{} garbage')).toBe(3)
  })

  it('单引号等非法写法不会死循环，返回一个位置', () => {
    const offset = locateJsonErrorOffset("{'a':1}")
    expect(offset).not.toBeNull()
    expect(offset as number).toBeGreaterThanOrEqual(0)
  })

  it('与引擎给的偏移量在同一行内', () => {
    const source = '{\n  "a": 1,\n  "b": ,\n}'
    const engine = locateJsonErrorOffset(source)
    const parsed = parseJson(source)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    const located = locateJsonError(source, parsed.error)
    expect(located).not.toBeNull()
    expect(located?.line).toBe(3)
    expect(located?.column).toBeGreaterThanOrEqual(1)
    expect(engine).not.toBeNull()
  })
})

describe('locateJsonError', () => {
  it('引擎有 position 时以引擎为准', () => {
    const source = '{"a":1,}'
    const parsed = parseJson(source)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    const located = locateJsonError(source, parsed.error)
    expect(located?.line).toBe(1)
    expect(located?.column).toBeGreaterThanOrEqual(1)
  })

  it('引擎无 position 时用本地扫描器补上行列', () => {
    const source = '{\n  "a": 1,\n  "b": ,\n}'
    const located = locateJsonError(source, { message: 'boom', position: null, line: null, column: null })
    expect(located).toEqual({ position: 19, line: 3, column: 8 })
  })

  it('两者都拿不到位置时返回 null，界面不编造位置', () => {
    expect(locateJsonError('', { message: 'boom', position: null, line: null, column: null })).toBeNull()
  })
})
