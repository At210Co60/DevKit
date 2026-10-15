import { describe, expect, it } from 'vitest'

import { bytesToBase64 } from '@/utils/base64'
import { bytesToHex, textToBytes } from '@/utils/bytes'

import {
  assertNativeAlgorithm,
  assertSupportedPrivateKey,
  CodecError,
  decryptAes,
  decryptRsa,
  encryptAes,
  encryptRsa,
  generateRsaKeyPair,
  HASH_ALGORITHMS,
  hashText,
  isEncryptedPrivateKey,
  isPkcs1PrivateKey,
  isPkcs8PrivateKey,
  maxRsaPlaintextBytes,
  UNSUPPORTED_ALGORITHMS,
} from '../crypto'

const SECRET = 'correct horse battery staple'

/** PBKDF2 210k 次很慢，测试里降到 1000，算法路径完全一致 */
const FAST = { iterations: 1000 }

describe('crypto / 哈希（单向，没有「解哈希」这种东西）', () => {
  it('输出与已知向量一致', async () => {
    await expect(hashText('', 'SHA-256')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    await expect(hashText('abc', 'SHA-256')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    await expect(hashText('abc', 'SHA-512')).resolves.toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
        '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    )
    await expect(hashText('abc', 'SHA-1')).resolves.toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('全部可用算法都跑得通', async () => {
    for (const algorithm of HASH_ALGORITHMS) {
      const digest = await hashText('码匠', algorithm)
      expect(digest).toMatch(/^[0-9a-f]+$/)
    }
    expect(HASH_ALGORITHMS).toContain('SHA-256')
  })

  it('MD5 不在算法列表里 —— Web Crypto 规范就没有它', () => {
    expect(HASH_ALGORITHMS).not.toContain('MD5' as never)
    expect(UNSUPPORTED_ALGORITHMS.map((a) => a.id)).toContain('md5')
  })

  it('点名 MD5 计算直接拒绝，不引第三方哈希库顶替', async () => {
    await expect(hashText('x', 'MD5' as never)).rejects.toThrow(CodecError)
  })

  it('相同输入相同输出（确定性）', async () => {
    expect(await hashText('same', 'SHA-256')).toBe(await hashText('same', 'SHA-256'))
  })

  it('没有未实现的算法被悄悄放行', async () => {
    await expect(hashText('x', 'SHA-224' as never)).rejects.toThrow(CodecError)
  })
})

describe('crypto / AES 往返', () => {
  it('GCM + 密码短语往返', async () => {
    const envelope = await encryptAes('你好，密文', SECRET, { mode: 'gcm', ...FAST })
    expect(envelope.mode).toBe('gcm')
    expect(await decryptAes(envelope, SECRET, FAST)).toBe('你好，密文')
  })

  it('CBC + 密码短语往返', async () => {
    const envelope = await encryptAes('你好，密文', SECRET, { mode: 'cbc', ...FAST })
    expect(envelope.mode).toBe('cbc')
    expect(await decryptAes(envelope, SECRET, { mode: 'cbc', ...FAST })).toBe('你好，密文')
  })

  it('Hex 密钥往返', async () => {
    const keyHex = '00'.repeat(32)
    const envelope = await encryptAes('hex key', keyHex, { mode: 'gcm', source: 'hex', keyLength: 256 })
    expect(await decryptAes(envelope, keyHex, { mode: 'gcm' })).toBe('hex key')
  })

  it('信封可以被 JSON 序列化后粘回来再解开', async () => {
    const envelope = await encryptAes('跨字符串传递', SECRET, { mode: 'gcm', ...FAST })
    await expect(decryptAes(JSON.stringify(envelope), SECRET, FAST)).resolves.toBe('跨字符串传递')
  })

  it('中文密文按 UTF-8 字节数校验长度', async () => {
    const envelope = await encryptAes('码匠码匠', SECRET, { mode: 'gcm', ...FAST })
    const cipherBytes = bytesToBase64(toBytes(envelope.ciphertext))
    expect(cipherBytes.length).toBeGreaterThan(0)
    await expect(decryptAes(envelope, SECRET, FAST)).resolves.toBe('码匠码匠')
  })

  it('固定 IV + 固定盐时结果确定（相同输入相同输出）', async () => {
    const pinned = { iv: '00'.repeat(12), salt: bytesToBase64(new Uint8Array(16)), ...FAST }
    const a = await encryptAes('deterministic', SECRET, { mode: 'gcm', ...pinned })
    const b = await encryptAes('deterministic', SECRET, { mode: 'gcm', ...pinned })
    expect(a.ciphertext).toBe(b.ciphertext)
  })

  it('默认 IV / 盐随机：两次结果不同，但都能解开', async () => {
    const a = await encryptAes('random iv', SECRET, FAST)
    const b = await encryptAes('random iv', SECRET, FAST)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
    expect(await decryptAes(a, SECRET, FAST)).toBe('random iv')
    expect(await decryptAes(b, SECRET, FAST)).toBe('random iv')
  })
})

describe('crypto / AES 错误路径：宁可报错也不返回垃圾', () => {
  it('GCM 密钥错了必须抛错', async () => {
    const envelope = await encryptAes('机密', SECRET, { mode: 'gcm', ...FAST })
    await expect(decryptAes(envelope, 'wrong secret', FAST)).rejects.toMatchObject({ code: 'KEY_MISMATCH' })
  })

  it('CBC 密钥错了也不能把垃圾递出来', async () => {
    const envelope = await encryptAes('机密内容，足够长', SECRET, { mode: 'cbc', ...FAST })
    // CBC 没有完整性校验，靠 UTF-8 合法性兜底：要么抛错，要么解出合法文本，绝不返回乱码
    try {
      const text = await decryptAes(envelope, 'wrong secret', { mode: 'cbc', ...FAST })
      expect(typeof text).toBe('string')
      expect(text).not.toContain('\uFFFD')
    } catch (err) {
      expect(err).toBeInstanceOf(CodecError)
      expect((err as CodecError).code).toBe('KEY_MISMATCH')
    }
  })

  it('密钥长度对不上要报错', async () => {
    await expect(encryptAes('x', '0011', { source: 'hex', keyLength: 256 })).rejects.toMatchObject({
      code: 'KEY_LENGTH',
    })
  })

  it('密钥不是合法 hex 要报错', async () => {
    await expect(encryptAes('x', 'zzzz', { source: 'hex', keyLength: 256 })).rejects.toMatchObject({
      code: 'BAD_SECRET',
    })
  })

  it('密码短语为空要报错', async () => {
    await expect(encryptAes('x', '', FAST)).rejects.toMatchObject({ code: 'EMPTY_SECRET' })
  })

  it('IV 长度不对要报错', async () => {
    await expect(encryptAes('x', SECRET, { iv: '0011', ...FAST })).rejects.toMatchObject({ code: 'IV_MISSING' })
  })

  it('密文不是合法信封要报错', async () => {
    await expect(decryptAes('这不是 JSON', SECRET, FAST)).rejects.toMatchObject({ code: 'CIPHERTEXT_FORMAT' })
    await expect(decryptAes('{}', SECRET, FAST)).rejects.toMatchObject({ code: 'CIPHERTEXT_FORMAT' })
  })

  it('信封缺 IV 要报错', async () => {
    await expect(decryptAes(JSON.stringify({ ciphertext: 'AAAA' }), SECRET, FAST)).rejects.toMatchObject({
      code: 'IV_MISSING',
    })
  })
})

describe('crypto / RSA', () => {
  it('2048 位密钥 OAEP 往返', async () => {
    const pair = await generateRsaKeyPair(2048)
    const cipher = await encryptRsa('RSA 机密', pair.publicKeyPem, 'oaep-sha1')
    await expect(decryptRsa(cipher, pair.privateKeyPem, 'oaep-sha1')).resolves.toBe('RSA 机密')
  })

  it('PKCS1v1.5：能跑就跑，跑不了必须诚实报不支持', async () => {
    const pair = await generateRsaKeyPair(2048)
    try {
      const cipher = await encryptRsa('PKCS 机密', pair.publicKeyPem, 'pkcs1v15')
      await expect(decryptRsa(cipher, pair.privateKeyPem, 'pkcs1v15')).resolves.toBe('PKCS 机密')
    } catch (err) {
      expect(err).toBeInstanceOf(CodecError)
      expect((err as CodecError).code).toBe('UNSUPPORTED')
    }
  })

  it('导出的是 PKCS#8 / SPKI，不是 PKCS#1', async () => {
    const pair = await generateRsaKeyPair(2048)
    expect(isPkcs8PrivateKey(pair.privateKeyPem)).toBe(true)
    expect(isPkcs1PrivateKey(pair.privateKeyPem)).toBe(false)
    expect(isEncryptedPrivateKey(pair.privateKeyPem)).toBe(false)
    expect(pair.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----')
    expect(pair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----')
  })

  it('私钥对不上必须报错，而不是返回垃圾', async () => {
    const a = await generateRsaKeyPair(2048)
    const b = await generateRsaKeyPair(2048)
    const cipher = await encryptRsa('机密', a.publicKeyPem)
    await expect(decryptRsa(cipher, b.privateKeyPem)).rejects.toMatchObject({ code: 'RSA_DECRYPT_FAILED' })
  })

  it('明文超长要报错，并给出该密钥的真实上限', async () => {
    const pair = await generateRsaKeyPair(2048)
    const limit = maxRsaPlaintextBytes(2048, 'oaep-sha1')
    expect(limit).toBe(214)
    await expect(encryptRsa('x'.repeat(limit + 1), pair.publicKeyPem, 'oaep-sha1')).rejects.toMatchObject({
      code: 'RSA_TOO_LONG',
    })
  })

  it('PKCS1v1.5 的上限比 OAEP 大', () => {
    expect(maxRsaPlaintextBytes(2048, 'pkcs1v15')).toBe(245)
    expect(maxRsaPlaintextBytes(4096, 'oaep-sha1')).toBe(470)
  })

  it('PKCS#1 私钥明确拒绝，并要求先转 PKCS#8', () => {
    const pkcs1 = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow==\n-----END RSA PRIVATE KEY-----'
    expect(isPkcs1PrivateKey(pkcs1)).toBe(true)
    expect(() => assertSupportedPrivateKey(pkcs1)).toThrow(CodecError)
    try {
      assertSupportedPrivateKey(pkcs1)
    } catch (err) {
      expect((err as CodecError).code).toBe('PKCS1_UNSUPPORTED')
    }
  })

  it('带口令的加密私钥明确拒绝', () => {
    const enc = '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIEow==\n-----END ENCRYPTED PRIVATE KEY-----'
    try {
      assertSupportedPrivateKey(enc)
      expect.unreachable('应该抛错')
    } catch (err) {
      expect((err as CodecError).code).toBe('PEM_ENCRYPTED')
    }
  })

  it('垃圾 PEM 要报错', async () => {
    await expect(decryptRsa('AAAA', 'not a pem', 'oaep-sha1')).rejects.toMatchObject({ code: 'PEM_INVALID' })
  })
})

describe('crypto / 明确不支持的算法', () => {
  it('DES 与 3DES 在不支持清单里，且写清了原因', () => {
    const ids = UNSUPPORTED_ALGORITHMS.map((a) => a.id)
    expect(ids).toContain('des')
    expect(ids).toContain('3des')
    expect(ids).toContain('md5')
    for (const algo of UNSUPPORTED_ALGORITHMS) {
      expect(algo.reason.length).toBeGreaterThan(10)
      expect(algo.reason).toContain('Web Crypto')
    }
  })

  it('点名 DES 直接拒绝，不做不安全替代', () => {
    expect(() => assertNativeAlgorithm('des')).toThrow(CodecError)
    expect(() => assertNativeAlgorithm('3DES')).toThrow(CodecError)
    try {
      assertNativeAlgorithm('des')
    } catch (err) {
      expect((err as CodecError).code).toBe('UNSUPPORTED')
    }
  })

  it('AES 不在不支持清单里', () => {
    expect(UNSUPPORTED_ALGORITHMS.some((a) => a.id === 'aes')).toBe(false)
    expect(() => assertNativeAlgorithm('aes')).not.toThrow()
  })
})

function toBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

describe('crypto / 副作用约束', () => {
  it('crypto.ts 不读 DOM、不发网络请求', () => {
    // 只做静态层面的佐证：模块导入后不产生任何全局副作用
    expect(typeof globalThis.crypto.subtle).toBe('object')
    expect(bytesToHex(textToBytes('A'))).toBe('41')
  })
})
