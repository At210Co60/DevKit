import { describe, expect, it } from 'vitest'

import { bytesToBase64, encodeBase64 } from '@/utils/base64'
import { bytesToHex, textToBytes } from '@/utils/bytes'

import { detectHash, detectJwt, isOpenSslPayload, looksLikeMorse, sniff, sniffAll, type SniffedKind } from '../sniffer'

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRldktpdCJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const MD5 = 'd41d8cd98f00b204e9800998ecf8427e'
const SHA1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
const SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const SHA512 = bytesToHex(new Uint8Array(64).fill(0xab))

function kinds(input: string): SniffedKind[] {
  return sniffAll(input).map((m) => m.kind)
}

describe('sniff / JWT', () => {
  it('认出 JWT，并解出 header 与 payload', () => {
    const parts = detectJwt(JWT)
    expect(parts).not.toBeNull()
    expect(parts!.header.alg).toBe('HS256')
    expect(parts!.payload.sub).toBe('1234567890')
  })

  it('JWT 优先于 base64 / hex', () => {
    expect(kinds(JWT)[0]).toBe('jwt')
    expect(sniff(JWT)!.label).toBe('JWT')
  })

  it('三段但 header 不含 alg 时不判 JWT', () => {
    // { "a": 1 } 编码成 base64url，再随便拼两段
    const fake = `eyJhIjoxfQ.eyJiIjoyfQ.zzzz`
    expect(detectJwt(fake)).toBeNull()
  })

  it('两段的不算 JWT', () => {
    expect(detectJwt('aaa.bbb')).toBeNull()
  })
})

describe('sniff / 哈希（必须不可逆）', () => {
  it.each([
    [MD5, 'md5'],
    [SHA1, 'sha1'],
    [SHA256, 'sha256'],
    [SHA512, 'sha512'],
  ])('%s → %s，且标记为不可逆', (hex, kind) => {
    expect(detectHash(hex)).toBe(kind)
    const match = sniff(hex)!
    expect(match.kind).toBe(kind)
    expect(match.irreversible).toBe(true)
    expect(match.requiresKey).toBe(false)
  })

  it('哈希必须排在 hex 前面（hex 字符集是 base64 的子集）', () => {
    expect(kinds(MD5)).toContain('md5')
    expect(kinds(MD5)).not.toContain('hex')
    expect(kinds(MD5)).not.toContain('base64')
  })

  it('长度不对的十六进制不算哈希', () => {
    expect(detectHash('abcd1234')).toBeNull()
    expect(sniff('abcd1234')!.kind).toBe('hex')
  })

  it('大写哈希同样识别', () => {
    expect(detectHash(MD5.toUpperCase())).toBe('md5')
  })
})

describe('sniff / Base64 家族', () => {
  it('标准 Base64（含填充）', () => {
    const b64 = encodeBase64('hello world')
    expect(sniff(b64)!.kind).toBe('base64')
  })

  it('Base64URL（- 与 _）', () => {
    const b64url = encodeBase64('??>>??~~').replace(/\+/g, '-').replace(/\//g, '_')
    expect(sniff(b64url)!.kind).toBe('base64url')
  })

  it('纯小写短 Base64 也能认出（utils 的 isBase64 会漏，靠软判定补齐）', () => {
    expect(sniff('aW5kZXguY29t')!.kind).toBe('base64')
  })

  it('OpenSSL 加密信封：Salted__ 开头', () => {
    // "Salted__" + 8 字节盐 + 若干密文
    const bytes = new Uint8Array([0x53, 0x61, 0x6c, 0x74, 0x65, 0x64, 0x5f, 0x5f, 1, 2, 3, 4, 5, 6, 7, 8])
    const b64 = bytesToBase64(bytes)
    expect(isOpenSslPayload(b64)).toBe(true)
    const match = sniff(b64)!
    expect(match.kind).toBe('openssl')
    expect(match.requiresKey).toBe(true)
  })

  it('RSA 密文：Base64 且长度 ≥ 256，标记需要密钥', () => {
    const b64 = btoa('A'.repeat(192))
    expect(b64.length).toBe(256)
    const match = sniff(b64)!
    expect(match.kind).toBe('rsa')
    expect(match.requiresKey).toBe(true)
  })
})

describe('sniff / 其他类型', () => {
  it('Hex：纯十六进制且偶数长度', () => {
    const match = sniff('48 65 6c 6c 6f')!
    expect(match.kind).toBe('hex')
    expect(match.irreversible).toBe(false)
  })

  it('Binary：只含 0/1 且 8 的倍数', () => {
    expect(sniff('01001000 01101001')!.kind).toBe('binary')
  })

  it('URL 编码', () => {
    expect(sniff('%E4%BD%A0%E5%A5%BD')!.kind).toBe('url-encoded')
  })

  it('Unicode 转义', () => {
    expect(sniff('\\u4e2d\\u6587')!.kind).toBe('unicode-escape')
    expect(sniff('\\u{1F600}')!.kind).toBe('unicode-escape')
  })

  it('HTML 实体', () => {
    expect(sniff('&lt;div&gt;&amp;nbsp;')!.kind).toBe('html-entity')
  })

  it('Morse 码', () => {
    expect(sniff('.... . .-.. .-.. ---')!.kind).toBe('morse')
    expect(looksLikeMorse('.... . / .-.. .-..')).toBe(true)
  })

  it('纯分隔线不算 Morse（防误判）', () => {
    expect(looksLikeMorse('--- ---')).toBe(false)
    expect(looksLikeMorse('.... ....')).toBe(false)
    expect(looksLikeMorse('..')).toBe(false)
  })

  it('中文不算 Morse', () => {
    expect(looksLikeMorse('你好世界')).toBe(false)
  })
})

describe('sniff / 边界', () => {
  it('空输入返回 null', () => {
    expect(sniff('')).toBeNull()
    expect(sniff('   ')).toBeNull()
    expect(sniffAll('')).toEqual([])
  })

  it('普通中文一窍不通 —— 不硬凑类型', () => {
    expect(sniff('这是一段普通的中文，没有任何编码痕迹')).toBeNull()
  })

  it('每条判定都必须给出理由', () => {
    for (const input of [JWT, MD5, encodeBase64('hello world'), '48 65 6c', '%20', '&amp;', '... -...']) {
      for (const match of sniffAll(input)) {
        expect(match.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it('非哈希的十六进制不应被标成不可逆', () => {
    expect(sniff('deadbeef')!.irreversible).toBe(false)
  })

  it('bytesToHex/textToBytes 基线没有被改动', () => {
    expect(bytesToHex(textToBytes('A'))).toBe('41')
  })
})
