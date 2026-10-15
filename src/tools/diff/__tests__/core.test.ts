import { describe, expect, it } from 'vitest'

import {
  DIFF_SAMPLE_LEFT,
  DIFF_SAMPLE_RIGHT,
  LARGE_TEXT_LIMIT,
  buildDiff,
  formatUnifiedText,
  splitLines,
  statsOf,
  toUnifiedLines,
  type DiffCell,
} from '../core'

/** 取某一行的左/右文本，测试里读起来比下标链直观 */
const leftText = (row: { left: DiffCell | null }): string | null => row.left?.text ?? null
const rightText = (row: { right: DiffCell | null }): string | null => row.right?.text ?? null

describe('splitLines', () => {
  it('空串是 0 行', () => {
    expect(splitLines('')).toEqual([])
  })

  it('末尾换行不产生多余空行', () => {
    expect(splitLines('a\nb\n')).toEqual(['a', 'b'])
    expect(splitLines('a\nb')).toEqual(['a', 'b'])
  })

  it('保留中间的空行', () => {
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b'])
  })
})

describe('buildDiff —— 完全相同', () => {
  it('没有增删改', () => {
    const result = buildDiff('a\nb\n', 'a\nb\n')
    expect(result.stats).toMatchObject({ added: 0, removed: 0, modified: 0, identical: true })
    expect(result.rows.every((row) => row.type === 'context')).toBe(true)
  })

  it('两侧都空时没有任何行', () => {
    const result = buildDiff('', '')
    expect(result.rows).toHaveLength(0)
    expect(result.stats.total).toBe(0)
  })
})

describe('buildDiff —— 新增与删除', () => {
  it('整行替换算「修改」而不是一增一删', () => {
    const result = buildDiff('a\nb\n', 'a\nc\n')
    expect(result.rows.map((row) => row.type)).toEqual(['context', 'modified'])
    expect(result.stats).toMatchObject({ added: 0, removed: 0, modified: 1 })
  })

  it('真正多出来的行算新增，左侧留空', () => {
    const result = buildDiff('a\nb\n', 'a\nb\nc\n')
    const added = result.rows.filter((row) => row.type === 'added')
    expect(added).toHaveLength(1)
    expect(leftText(added[0]!)).toBeNull()
    expect(rightText(added[0]!)).toBe('c')
    expect(added[0]?.newNumber).toBe(3)
    expect(added[0]?.oldNumber).toBeNull()
  })

  it('左侧多出来的行算删除，右侧留空', () => {
    const result = buildDiff('a\nb\n', 'a\n')
    const removed = result.rows.filter((row) => row.type === 'removed')
    expect(removed).toHaveLength(1)
    expect(leftText(removed[0]!)).toBe('b')
    expect(rightText(removed[0]!)).toBeNull()
    expect(removed[0]?.oldNumber).toBe(2)
  })

  it('行号分别连续编号', () => {
    const result = buildDiff('a\nb\nc\n', 'a\nb2\nc\nd\n')
    expect(result.rows.map((row) => row.oldNumber)).toEqual([1, 2, 3, null])
    expect(result.rows.map((row) => row.newNumber)).toEqual([1, 2, 3, 4])
  })

  it('左侧空文本时全部算新增', () => {
    const result = buildDiff('', 'a\nb\n')
    expect(result.stats.added).toBe(2)
    expect(result.stats.removed).toBe(0)
  })
})

describe('buildDiff —— 修改行与字符级', () => {
  it('位置相同但内容不同算修改，并给出字符级片段', () => {
    const result = buildDiff('const timeout = 30\n', 'const timeout = 90\n')
    const modified = result.rows.filter((row) => row.type === 'modified')
    expect(modified).toHaveLength(1)
    expect(leftText(modified[0]!)).toBe('const timeout = 30')
    expect(rightText(modified[0]!)).toBe('const timeout = 90')

    const leftSegments = modified[0]!.left!.segments
    const removedSegments = leftSegments.filter((segment) => segment.type === 'removed')
    expect(removedSegments.map((segment) => segment.text)).toEqual(['3'])

    const rightSegments = modified[0]!.right!.segments
    expect(rightSegments.filter((segment) => segment.type === 'added').map((segment) => segment.text)).toEqual(['9'])
  })

  it('左右片段拼起来都能还原整行', () => {
    const row = buildDiff('hello world\n', 'hello brave world\n').rows.find((item) => item.type === 'modified')!
    expect(row.left!.segments.map((segment) => segment.text).join('')).toBe('hello world')
    expect(row.right!.segments.map((segment) => segment.text).join('')).toBe('hello brave world')
  })

  it('关掉字符级时整行作为一段', () => {
    const row = buildDiff('abc\n', 'abd\n', { inlineChars: false }).rows[0]!
    expect(row.left!.segments).toEqual([{ type: 'removed', text: 'abc' }])
    expect(row.right!.segments).toEqual([{ type: 'added', text: 'abd' }])
  })

  it('删除多于新增时，多出来的算纯删除', () => {
    const result = buildDiff('a\nb\nc\n', 'x\n')
    const removed = result.rows.filter((row) => row.type === 'removed')
    expect(removed).toHaveLength(2)
    expect(removed.every((row) => rightText(row) === null)).toBe(true)
  })

  it('新增多于删除时，多出来的算纯新增', () => {
    const result = buildDiff('a\n', 'x\ny\nz\n')
    const added = result.rows.filter((row) => row.type === 'added')
    expect(added).toHaveLength(2)
    expect(added.every((row) => leftText(row) === null)).toBe(true)
  })
})

describe('buildDiff —— 选项', () => {
  it('忽略大小写：仅大小写不同视为没变', () => {
    expect(buildDiff('Hello\n', 'hello\n', { ignoreCase: true }).stats.identical).toBe(true)
    expect(buildDiff('Hello\n', 'hello\n').stats.identical).toBe(false)
  })

  it('忽略空白：行首尾空格不影响判断', () => {
    expect(buildDiff('  foo  \n', 'foo\n', { ignoreWhitespace: true }).stats.identical).toBe(true)
    expect(buildDiff('  foo  \n', 'foo\n').stats.identical).toBe(false)
  })

  it('忽略空白只作用于行首尾，中间空格仍然算差异', () => {
    expect(buildDiff('a b\n', 'a  b\n', { ignoreWhitespace: true }).stats.identical).toBe(false)
  })

  it('两个选项可以叠加', () => {
    expect(buildDiff('  Foo  \n', 'foo\n', { ignoreWhitespace: true, ignoreCase: true }).stats.identical).toBe(true)
  })

  it('空行与缺失行不等价', () => {
    const result = buildDiff('a\n\nb\n', 'a\nb\n')
    expect(result.stats.removed).toBe(1)
  })
})

describe('buildDiff —— 统计与提醒', () => {
  it('统计增删改与总数', () => {
    // a→a、b→B（修改）、c→d（修改）、新增 e
    const result = buildDiff('a\nb\nc\n', 'a\nB\nd\ne\n')
    expect(result.stats.modified).toBe(2)
    expect(result.stats.added).toBe(1)
    expect(result.stats.removed).toBe(0)
    expect(result.stats.context).toBe(1)
    expect(result.stats.total).toBe(4)
  })

  it('超过 200KB 才提醒', () => {
    expect(buildDiff('a', 'b').warnings).toEqual([])
    const big = 'x'.repeat(LARGE_TEXT_LIMIT + 1)
    const result = buildDiff(big, 'y')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.code).toBe('too-large')
    expect(result.warnings[0]?.bytes).toBeGreaterThan(LARGE_TEXT_LIMIT)
  })

  it('返回两侧的文本规模', () => {
    const result = buildDiff('a\nb\n', 'a\n')
    // countTextStats 按 \n 切分，末尾换行会多出一个空段
    expect(result.leftStats.lines).toBe(3)
    expect(result.rightStats.lines).toBe(2)
    expect(result.leftStats.bytes).toBe(4)
  })

  it('中文字符按 UTF-8 字节算体量', () => {
    const result = buildDiff('中文\n', '中文\n')
    expect(result.leftStats.cjk).toBe(2)
    expect(result.leftStats.bytes).toBe(7)
  })
})

describe('统一视图', () => {
  it('修改行拆成 - 与 + 两行', () => {
    const lines = toUnifiedLines(buildDiff('a\nb\n', 'a\nB\n').rows)
    expect(lines.map((line) => line.prefix)).toEqual([' ', '-', '+'])
    expect(lines[1]?.text).toBe('b')
    expect(lines[2]?.text).toBe('B')
    expect(lines[2]?.newNumber).toBe(2)
    expect(lines[1]?.newNumber).toBeNull()
  })

  it('纯文本输出保留前缀与行号', () => {
    const text = formatUnifiedText(buildDiff('a\nb\n', 'a\nb\nc\n').rows)
    expect(text).toBe('     1 | a\n     2 | b\n+    3 | c')
  })

  it('修改行输出为先 - 后 +', () => {
    const text = formatUnifiedText(buildDiff('a\nb\n', 'a\nB\n').rows)
    expect(text.split('\n').slice(1)).toEqual(['-    2 | b', '+    2 | B'])
  })

  it('两侧相同时输出全部是空格前缀', () => {
    const text = formatUnifiedText(buildDiff('a\n', 'a\n').rows)
    expect(text.split('\n').every((line) => line.startsWith('  '))).toBe(true)
  })
})

describe('statsOf', () => {
  it('空行集一律视为相同', () => {
    expect(statsOf([]).identical).toBe(true)
  })

  it('有变化时 identical 为 false', () => {
    expect(statsOf(buildDiff('a\n', 'b\n').rows).identical).toBe(false)
  })
})

describe('示例数据', () => {
  it('两侧都有内容且确实存在差异', () => {
    const result = buildDiff(DIFF_SAMPLE_LEFT, DIFF_SAMPLE_RIGHT)
    expect(result.leftStats.lines).toBeGreaterThan(3)
    expect(result.stats.identical).toBe(false)
    expect(result.stats.added + result.stats.modified).toBeGreaterThan(0)
  })

  it('示例里的每行都能原样还原', () => {
    const result = buildDiff(DIFF_SAMPLE_LEFT, DIFF_SAMPLE_RIGHT)
    const left = result.rows.flatMap((row) => (row.left ? [row.left.text] : []))
    expect(left).toEqual(splitLines(DIFF_SAMPLE_LEFT))
  })
})
