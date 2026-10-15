import { describe, expect, it } from 'vitest'

import { quips } from '@/content'

import {
  buildQuery,
  buildUrl,
  decodeInput,
  detectEncoding,
  encodeInput,
  encodeOnce,
  escapeHash,
  escapePath,
  escapeSearch,
  hasTargets,
  joinLayers,
  parseQuery,
  parseUrl,
  splitLayers,
  type EncodeTargets,
} from '../core'

/**
 * core 层盯四件事：
 * 1. 分层编解码不能被 URL 构造函数的规范化吃掉（这是本工具最容易做错的地方）
 * 2. 转义要幂等友好：已经合法的 %XX 不能被二次编码
 * 3. 非法百分号转义要报错并指出位置
 * 4. Query 参数解析与反向拼接必须对称
 */

const ALL: EncodeTargets = { pathname: true, search: true, hash: true }
const NONE: EncodeTargets = { pathname: false, search: false, hash: false }

describe('转义原语', () => {
  it('encodeOnce 不做双重编码', () => {
    expect(encodeOnce('a%20b')).toBe('a%20b')
    expect(encodeOnce('中文')).toBe('%E4%B8%AD%E6%96%87')
  })

  it('路径保留 / 作分隔符', () => {
    expect(escapePath('/文档/第一 页')).toBe('/%E6%96%87%E6%A1%A3/%E7%AC%AC%E4%B8%80%20%E9%A1%B5')
  })

  it('查询串保留 ? & = 的结构含义', () => {
    expect(escapeSearch('?q=中文 关键词&tag=编码')).toBe(
      '?q=%E4%B8%AD%E6%96%87%20%E5%85%B3%E9%94%AE%E8%AF%8D&tag=%E7%BC%96%E7%A0%81',
    )
  })

  it('查询串的值里带 = 时不被劈开', () => {
    expect(escapeSearch('?token=a=b=c')).toBe('?token=a%3Db%3Dc')
  })

  it('片段保留 = （锚点里常见键值对）', () => {
    expect(escapeHash('#a=1')).toBe('#a=1')
    expect(escapeHash('#第 2 节')).toBe('#%E7%AC%AC%202%20%E8%8A%82')
  })

  it('空层不产生多余字符', () => {
    expect(escapeSearch('')).toBe('')
    expect(escapeHash('')).toBe('')
  })
})

describe('分层切分', () => {
  it('切出协议 / 路径 / 查询 / 片段', () => {
    const result = splitLayers('https://a.com/p?x=1#y')
    expect(result.ok).toBe(true)
    expect(result.ok && result.value).toEqual({
      authority: 'https://a.com',
      pathname: '/p',
      search: '?x=1',
      hash: '#y',
    })
  })

  it('joinLayers 能拼回去', () => {
    const url = 'https://a.com/p?x=1#y'
    const layers = splitLayers(url)
    if (!layers.ok) throw new Error('split failed')
    expect(joinLayers(layers.value)).toBe(url)
  })

  it('空输入返回 empty', () => {
    const result = splitLayers('   ')
    expect(!result.ok && result.code).toBe('empty')
  })

  it('hasTargets 判断有没有勾选层级', () => {
    expect(hasTargets(NONE)).toBe(false)
    expect(hasTargets(ALL)).toBe(true)
  })
})

describe('encodeInput', () => {
  it('不勾层级时整串按纯文本转义', () => {
    const result = encodeInput('中文 & more', NONE)
    expect(result.ok && result.value).toBe('%E4%B8%AD%E6%96%87%20%26%20more')
  })

  it('只勾查询串时，路径与片段原样保留（不能被 URL 规范化偷改）', () => {
    const result = encodeInput('/文档/第一 页?q=中文 关键词#第 2 节', { pathname: false, search: true, hash: false })
    expect(result.ok && result.value).toBe('/文档/第一 页?q=%E4%B8%AD%E6%96%87%20%E5%85%B3%E9%94%AE%E8%AF%8D#第 2 节')
  })

  it('只勾路径时 / 仍是分隔符', () => {
    const result = encodeInput('/a b/c?q=中文#d e', { pathname: true, search: false, hash: false })
    expect(result.ok && result.value).toBe('/a%20b/c?q=中文#d e')
  })

  it('只勾片段时', () => {
    const result = encodeInput('/a?q=1#第 2 节', { pathname: false, search: false, hash: true })
    expect(result.ok && result.value).toBe('/a?q=1#%E7%AC%AC%202%20%E8%8A%82')
  })

  it('空输入返回 empty', () => {
    const result = encodeInput('  ', ALL)
    expect(!result.ok && result.code).toBe('empty')
  })
})

describe('decodeInput', () => {
  it('不勾层级时整串解码', () => {
    const result = decodeInput('%E4%B8%AD%E6%96%87%20%26%20more', NONE)
    expect(result.ok && result.value).toBe('中文 & more')
  })

  it('按层解码：值里的转义分隔符不会跑错层', () => {
    const result = decodeInput('/%E6%96%87?q=1%262#%E7%AC%AC', ALL)
    expect(result.ok && result.value).toBe('/文?q=1&2#第')
  })

  it('只解路径时，查询串保持编码状态', () => {
    const result = decodeInput('/%E6%96%87?q=%E4%B8%AD', { pathname: true, search: false, hash: false })
    expect(result.ok && result.value).toBe('/文?q=%E4%B8%AD')
  })

  it('非法百分号转义报 invalidPercent 并指出位置', () => {
    const result = decodeInput('a%zzb', NONE)
    expect(!result.ok && result.code).toBe('invalidPercent')
    expect(!result.ok && result.detail).toContain('index 1')
  })

  it('截断的三字节转义也报错，不抛异常', () => {
    const result = decodeInput('%E4%B8', ALL)
    expect(!result.ok && result.code).toBe('invalidPercent')
  })

  it('编码 → 解码 往返无损（含中文与空格）', () => {
    const source = '/文档/第一 页?q=中文 关键词&tag=编码&page=1#第 2 节'
    const encoded = encodeInput(source, ALL)
    if (!encoded.ok) throw new Error('encode failed')

    const decoded = decodeInput(encoded.value, ALL)
    expect(decoded.ok && decoded.value).toBe(source)
  })
})

describe('parseUrl —— 结构拆解', () => {
  it('拆出各层，并给出 punycode 主机名与端口', () => {
    const result = parseUrl('https://user:pw@例子.测试:8443/路径?q=1#h')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.protocol).toBe('https:')
    expect(result.value.host).toBe('xn--fsqu00a.xn--0zwm56d:8443')
    expect(result.value.hostname).toBe('xn--fsqu00a.xn--0zwm56d')
    expect(result.value.port).toBe('8443')
    expect(result.value.pathname).toBe('/%E8%B7%AF%E5%BE%84')
    expect(result.value.search).toBe('?q=1')
    expect(result.value.hash).toBe('#h')
    expect(result.value.inferredProtocol).toBe(false)
  })

  it('缺协议时补 https:// 并标记', () => {
    const result = parseUrl('example.com/a?b=1')
    expect(result.ok).toBe(true)
    expect(result.ok && result.value.inferredProtocol).toBe(true)
    expect(result.ok && result.value.host).toBe('example.com')
  })

  it('协议写坏时不给硬补', () => {
    const result = parseUrl('http://')
    expect(!result.ok && result.code).toBe('invalidUrl')
  })

  it('裸查询串不是主机，报 invalidUrl', () => {
    const result = parseUrl('a=1&b=2')
    expect(!result.ok && result.code).toBe('invalidUrl')
  })

  it('一句自然语言报 invalidUrl', () => {
    const result = parseUrl('not a url at all')
    expect(!result.ok && result.code).toBe('invalidUrl')
  })

  it('空输入返回 empty', () => {
    const result = parseUrl('  ')
    expect(!result.ok && result.code).toBe('empty')
  })
})

describe('Query 参数', () => {
  it('解析成 key/value 行', () => {
    expect(parseQuery('?a=1&b=2')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ])
  })

  it('值里的百分号与加号都会被解开', () => {
    expect(parseQuery('?q=%E4%B8%AD%E6%96%87&s=a+b')).toEqual([
      { key: 'q', value: '中文' },
      { key: 's', value: 'a b' },
    ])
  })

  it('重复 key 保留成多行，不去重', () => {
    expect(parseQuery('?a=1&a=2')).toEqual([
      { key: 'a', value: '1' },
      { key: 'a', value: '2' },
    ])
  })

  it('没有查询串时返回空数组', () => {
    expect(parseQuery('')).toEqual([])
    expect(parseQuery('?')).toEqual([])
  })

  it('空 key 的行不进入结果', () => {
    expect(
      buildQuery([
        { key: '', value: 'orphan' },
        { key: 'a', value: '1' },
      ]),
    ).toBe('a=1')
  })

  it('escape = false 时原样输出', () => {
    expect(buildQuery([{ key: 'q', value: '中文 关键词' }], false)).toBe('q=中文 关键词')
    expect(buildQuery([{ key: 'q', value: '中文 关键词' }], true)).toBe(
      'q=%E4%B8%AD%E6%96%87%20%E5%85%B3%E9%94%AE%E8%AF%8D',
    )
  })

  it('解析 → 拼接 → 再解析，结果一致（空格统一编码成 %20，不与 + 混用）', () => {
    const rows = parseQuery('a=1&b=%E4%B8%AD%E6%96%87&c=a+b')
    expect(parseQuery(buildQuery(rows))).toEqual(rows)
  })
})

describe('buildUrl —— Query 反向拼接', () => {
  it('草稿拼成完整 URL', () => {
    const result = buildUrl(
      {
        protocol: 'https:',
        host: 'example.com',
        pathname: '/a b',
        rows: [{ key: 'q', value: '中文' }],
        hash: '第 2 节',
      },
      ALL,
    )
    expect(result.ok && result.value).toBe('https://example.com/a%20b?q=%E4%B8%AD%E6%96%87#%E7%AC%AC%202%20%E8%8A%82')
  })

  it('不转义时原样保留', () => {
    const result = buildUrl(
      { protocol: 'https:', host: 'example.com', pathname: '/a b', rows: [{ key: 'q', value: '中文' }], hash: '' },
      NONE,
    )
    expect(result.ok && result.value).toBe('https://example.com/a b?q=中文')
  })

  it('生成的 URL 必须能被解析，否则报 invalidUrl', () => {
    const result = buildUrl({ protocol: 'https:', host: 'exa mple.com', pathname: '/', rows: [], hash: '' }, NONE)
    expect(!result.ok && result.code).toBe('invalidUrl')
  })

  it('解析出来的 URL 再拼回去，结果与 href 一致', () => {
    const source = 'https://例子.测试/文档/第一 页?q=中文 关键词&tag=编码&page=1#第 2 节'
    const parsed = parseUrl(source)
    if (!parsed.ok) throw new Error('parse failed')

    const rebuilt = buildUrl(
      {
        protocol: parsed.value.protocol,
        host: parsed.value.host,
        pathname: parsed.value.pathname,
        rows: parseQuery(parsed.value.search),
        hash: parsed.value.hash.replace(/^#/, ''),
      },
      ALL,
    )
    expect(rebuilt.ok && rebuilt.value).toBe(parsed.value.href)
  })
})

describe('detectEncoding —— 已编码自动识别', () => {
  it('识别出已编码的百分号串', () => {
    const result = detectEncoding('a%20b%20%E4%B8%AD')
    expect(result.failed).toBe(false)
    expect(result.encoded).toBe(true)
    expect(result.decoded).toBe('a b 中')
  })

  it('明文 URL 不误判', () => {
    const result = detectEncoding('https://例子.测试/文档?q=中文')
    expect(result.encoded).toBe(false)
    expect(result.failed).toBe(false)
  })

  it('解码后反而更难读时不判为已编码', () => {
    const result = detectEncoding('100%25')
    expect(result.encoded).toBe(false)
    expect(result.failed).toBe(false)
  })

  it('非法转义标 failed，不抛异常', () => {
    const result = detectEncoding('%E4%B8')
    expect(result.failed).toBe(true)
    expect(result.encoded).toBe(false)
  })

  it('空输入不炸', () => {
    const result = detectEncoding('')
    expect(result).toEqual({ encoded: false, confidence: 0, decoded: '', failed: false })
  })
})

describe('content 示例自洽', () => {
  it('content 里的 URL 示例与它的百分号编码对应', () => {
    const encoded = encodeInput(quips.url.sampleUrl, NONE)
    expect(encoded.ok && encoded.value).toBe(quips.url.sampleEncoded)
  })
})
