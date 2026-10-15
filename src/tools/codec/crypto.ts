import { base64ToBytes, bytesToBase64, isBase64 } from '@/utils/base64'
import { bytesToHex, bytesToTextStrict, hexToBytes, textToBytes } from '@/utils/bytes'

/**
 * 加解密 —— 一律走浏览器原生 Web Crypto API
 *
 * ── 三条不可让步的红线 ──
 * 1. **不自研加密算法**。AES / RSA / PBKDF2 / SHA 全部调 `globalThis.crypto.subtle`，
 *    Node 24 与浏览器同源，测试无需 mock。
 * 2. **DES / 3DES 明确不支持**。Web Crypto 没实现，也不引入不安全的纯 JS 实现顶替，
 *    见 `UNSUPPORTED_ALGORITHMS`。
 * 3. **不用错的密钥返回垃圾数据**。GCM 直接报错；CBC 无完整性校验，
 *    因此解密后强制校验 UTF-8 合法性，非法即判定密钥错误。
 *
 * 副作用约束：不碰 DOM、不读 window、不发网络请求。随机数一律取自 `globalThis.crypto`。
 */

export type CodecErrorCode =
  | 'NO_WEBCRYPTO'
  | 'KEY_MISMATCH'
  | 'IV_MISSING'
  | 'BAD_SECRET'
  | 'EMPTY_SECRET'
  | 'KEY_LENGTH'
  | 'CIPHERTEXT_FORMAT'
  | 'PEM_INVALID'
  | 'PEM_ENCRYPTED'
  | 'PKCS1_UNSUPPORTED'
  | 'RSA_TOO_LONG'
  | 'RSA_DECRYPT_FAILED'
  | 'UNSUPPORTED'
  | 'UNKNOWN'

/** 错误用 code 抛，映射成中文文案是 UI 层的活（quips.codec.errors） */
export class CodecError extends Error {
  readonly code: CodecErrorCode
  readonly detail: string | undefined

  constructor(code: CodecErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'CodecError'
    this.code = code
    this.detail = detail
  }
}

/* ══════════════════ 明确不支持的算法 ══════════════════ */

export interface UnsupportedAlgorithm {
  id: string
  name: string
  /** 为什么不做 —— 必须是技术原因，不能是「懒得写」 */
  reason: string
}

/**
 * Web Crypto 没有、且本工具拒绝用不安全实现顶替的算法
 *
 * UI 直接渲染这张表，避免用户以为「工具没认出」=「换个姿势就能解」。
 */
export const UNSUPPORTED_ALGORITHMS: readonly UnsupportedAlgorithm[] = [
  {
    id: 'des',
    name: 'DES',
    reason:
      'Web Crypto（浏览器原生）只实现 AES / RSA / HMAC / SHA / PBKDF2，没有 DES。纯 JS 的 DES 实现既慢又有侧信道风险，本项目不引入。',
  },
  {
    id: '3des',
    name: '3DES / DES-EDE',
    reason:
      '同上，Web Crypto 未实现；而且 3DES 已被 NIST 弃用（Sweet32 攻击），即便自研实现也不该作为「能用的功能」摆在这里。',
  },
  {
    id: 'md5',
    name: 'MD5',
    reason:
      'Web Crypto 的 digest() 不提供 MD5（规范里就没有），Node 与浏览器一致。识别别人给的 MD5 摘要没问题，但要**算**出新的 MD5，本工具做不到，也不引第三方哈希库顶替。',
  },
]

/** 对不支持的算法名直接拒绝，而不是悄悄降级 */
export function assertNativeAlgorithm(name: string): void {
  const hit = UNSUPPORTED_ALGORITHMS.find((a) => a.id === name.toLowerCase())
  if (hit) throw new CodecError('UNSUPPORTED', `${hit.name}：${hit.reason}`)
}

/* ══════════════════ 底层适配 ══════════════════ */

function subtle(): SubtleCrypto {
  const c = globalThis.crypto
  if (!c || !c.subtle) throw new CodecError('NO_WEBCRYPTO', '当前环境缺少 Web Crypto')
  return c.subtle
}

/** 复制成独立 ArrayBuffer：既避开 SharedArrayBuffer 的类型分歧，也避免 subarray 的偏移量坑 */
function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  globalThis.crypto.getRandomValues(out)
  return out
}

/* ══════════════════ 哈希 ══════════════════ */

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

/**
 * 只列 Web Crypto 真的有的算法
 *
 * MD5 不在里面：Web Crypto 的 digest() 规范里就没有 MD5，
 * Node 与浏览器行为一致。它在 `UNSUPPORTED_ALGORITHMS` 里被明确标注原因。
 */
export const HASH_ALGORITHMS: readonly HashAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

/**
 * 计算摘要，返回小写十六进制
 *
 * 单向函数：**没有** `crackHash` 这种东西存在，core 层也不提供任何「还原哈希」的入口。
 */
export async function hashText(text: string, algorithm: HashAlgorithm = 'SHA-256'): Promise<string> {
  if (!HASH_ALGORITHMS.includes(algorithm))
    throw new CodecError('UNSUPPORTED', `Web Crypto 不支持摘要算法 ${algorithm}`)
  const digest = await subtle().digest(algorithm, toBufferSource(textToBytes(text)))
  return bytesToHex(new Uint8Array(digest))
}

/* ══════════════════ AES ══════════════════ */

export type AesMode = 'gcm' | 'cbc'
export type SecretSource = 'passphrase' | 'hex'
export type AesKeyLength = 128 | 192 | 256

export const AES_MODES: readonly AesMode[] = ['gcm', 'cbc']
export const AES_KEY_LENGTHS: readonly AesKeyLength[] = [128, 192, 256]

export const DEFAULT_PBKDF2_ITERATIONS = 210_000

export interface AesParams {
  mode?: AesMode
  /** 密钥来源：密码短语走 PBKDF2 派生，Hex 直接当原始密钥 */
  source?: SecretSource
  keyLength?: AesKeyLength
  iterations?: number
  /** 显式指定 IV（十六进制）。不传则加密时随机生成并写进信封 */
  iv?: string
  /** 显式指定 PBKDF2 盐（base64）。不传则加密时随机生成并写进信封 */
  salt?: string
}

/** 密文信封：IV 与盐随密文一起走，这是能解开别人的密文的唯一前提 */
export interface AesEnvelope {
  version: 1
  mode: AesMode
  source: SecretSource
  keyLength: AesKeyLength
  /** base64 */
  salt: string
  /** base64 */
  iv: string
  /** base64；GCM 的 authTag 已包含在内 */
  ciphertext: string
}

/**
 * Web Crypto 的 AES 算法名必须带模式
 *
 * 写 `{ name: 'AES' }` 会被判为未注册算法（Node 直接抛 NotSupportedError），
 * 必须是 'AES-CBC' / 'AES-GCM'。报错信息完全不提示这点，单独记一笔。
 */
function aesAlgorithm(mode: AesMode): 'AES-GCM' | 'AES-CBC' {
  return mode === 'gcm' ? 'AES-GCM' : 'AES-CBC'
}

function ivLengthOf(mode: AesMode): number {
  return mode === 'gcm' ? 12 : 16
}

export async function importAesKey(
  secret: string,
  source: SecretSource = 'passphrase',
  keyLength: AesKeyLength = 256,
  mode: AesMode = 'gcm',
  salt?: Uint8Array,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (!AES_KEY_LENGTHS.includes(keyLength)) throw new CodecError('KEY_LENGTH', `AES 不支持 ${keyLength} 位密钥`)
  const name = aesAlgorithm(mode)

  if (source === 'hex') {
    let bytes: Uint8Array
    try {
      bytes = hexToBytes(secret)
    } catch (err) {
      throw new CodecError('BAD_SECRET', err instanceof Error ? err.message : undefined)
    }
    if (bytes.length * 8 !== keyLength) {
      throw new CodecError('KEY_LENGTH', `十六进制密钥是 ${bytes.length * 8} 位，与所选的 ${keyLength} 位不符`)
    }
    return subtle().importKey('raw', toBufferSource(bytes), { name }, false, ['encrypt', 'decrypt'])
  }

  if (!secret) throw new CodecError('EMPTY_SECRET')
  const material = await subtle().importKey('raw', toBufferSource(textToBytes(secret)), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: toBufferSource(salt ?? new Uint8Array(16)), iterations, hash: 'SHA-256' },
    material,
    { name, length: keyLength },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptAes(plaintext: string, secret: string, params: AesParams = {}): Promise<AesEnvelope> {
  const mode = params.mode ?? 'gcm'
  const source = params.source ?? 'passphrase'
  const keyLength = params.keyLength ?? 256
  if (!AES_MODES.includes(mode)) throw new CodecError('UNSUPPORTED', `Web Crypto 不支持 AES-${mode}`)

  const salt = params.salt ? base64ToBytes(params.salt) : source === 'passphrase' ? randomBytes(16) : new Uint8Array(16)
  const iv = params.iv ? hexToBytes(params.iv) : randomBytes(ivLengthOf(mode))
  if (iv.length !== ivLengthOf(mode)) {
    throw new CodecError(
      'IV_MISSING',
      `AES-${mode.toUpperCase()} 需要 ${ivLengthOf(mode)} 字节 IV，收到 ${iv.length} 字节`,
    )
  }

  const key = await importAesKey(secret, source, keyLength, mode, salt, params.iterations)
  const cipher = new Uint8Array(
    await subtle().encrypt(
      { name: aesAlgorithm(mode), iv: toBufferSource(iv) },
      key,
      toBufferSource(textToBytes(plaintext)),
    ),
  )

  return {
    version: 1,
    mode,
    source,
    keyLength,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(cipher),
  }
}

export async function decryptAes(
  envelope: AesEnvelope | string,
  secret: string,
  params: AesParams = {},
): Promise<string> {
  const env = normalizeEnvelope(envelope, params)
  const salt = env.salt ? base64ToBytes(env.salt) : new Uint8Array(16)
  const iv = base64ToBytes(env.iv)
  if (iv.length !== ivLengthOf(env.mode)) {
    throw new CodecError('IV_MISSING', `AES-${env.mode.toUpperCase()} 需要 ${ivLengthOf(env.mode)} 字节 IV`)
  }
  let cipher: Uint8Array
  try {
    cipher = base64ToBytes(env.ciphertext)
  } catch {
    throw new CodecError('CIPHERTEXT_FORMAT')
  }
  if (cipher.length === 0) throw new CodecError('CIPHERTEXT_FORMAT')

  const key = await importAesKey(secret, env.source, env.keyLength, env.mode, salt, params.iterations)

  let plain: Uint8Array
  try {
    plain = new Uint8Array(
      await subtle().decrypt({ name: aesAlgorithm(env.mode), iv: toBufferSource(iv) }, key, toBufferSource(cipher)),
    )
  } catch {
    // GCM 会在这里因 authTag 校验失败而抛错 —— 这正是我们要的明确失败，而不是垃圾数据
    throw new CodecError('KEY_MISMATCH')
  }

  // CBC 没有完整性校验，只能靠「结果是不是合法 UTF-8」来识别错误密钥
  try {
    return bytesToTextStrict(plain)
  } catch {
    throw new CodecError('KEY_MISMATCH')
  }
}

function normalizeEnvelope(envelope: AesEnvelope | string, params: AesParams): AesEnvelope {
  const overrideIv = params.iv ? bytesToBase64(hexToBytes(params.iv)) : null
  if (typeof envelope !== 'string') {
    return { ...envelope, mode: params.mode ?? envelope.mode, iv: overrideIv ?? envelope.iv }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(envelope)
  } catch {
    throw new CodecError('CIPHERTEXT_FORMAT', '密文不是本工具的 JSON 信封，请确认是否粘贴完整')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new CodecError('CIPHERTEXT_FORMAT')
  const env = parsed as Partial<AesEnvelope>
  if (typeof env.ciphertext !== 'string' || !env.ciphertext) throw new CodecError('CIPHERTEXT_FORMAT')
  if (!overrideIv && (typeof env.iv !== 'string' || !env.iv)) throw new CodecError('IV_MISSING')
  return {
    version: 1,
    mode: params.mode ?? env.mode ?? 'gcm',
    source: env.source ?? 'passphrase',
    keyLength: env.keyLength ?? params.keyLength ?? 256,
    salt: env.salt ?? params.salt ?? '',
    iv: overrideIv ?? env.iv!,
    ciphertext: env.ciphertext,
  }
}

/** 快速判断一串东西像不像密文（UI 用，不做完整解析） */
export function looksLikeCiphertext(input: string): boolean {
  return isBase64(input.trim())
}

/* ══════════════════ RSA ══════════════════ */

export type RsaPadding = 'oaep-sha1' | 'pkcs1v15'
export type RsaKeySize = 2048 | 3072 | 4096

export const RSA_PADDINGS: readonly RsaPadding[] = ['oaep-sha1', 'pkcs1v15']
export const RSA_KEY_SIZES: readonly RsaKeySize[] = [2048, 3072, 4096]

/** Web Crypto 的 RSA-OAEP 固定使用 SHA-1（规范如此），不是我们偷懒 */
const RSA_OAEP_HASH = 'SHA-1'

export function isPkcs1PrivateKey(pem: string): boolean {
  return /-----BEGIN RSA PRIVATE KEY-----/.test(pem)
}

export function isPkcs8PrivateKey(pem: string): boolean {
  return /-----BEGIN PRIVATE KEY-----/.test(pem)
}

export function isEncryptedPrivateKey(pem: string): boolean {
  return /-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(pem)
}

/**
 * 私钥格式检查 —— 把「不支持」这件事说在前面
 *
 * PKCS#1（`BEGIN RSA PRIVATE KEY`）在第一版**明确不支持**：
 * Web Crypto 只接受 PKCS#8，转换需要引入额外的密钥库，超出本版范围。
 */
export function assertSupportedPrivateKey(pem: string): void {
  if (!pem.trim()) throw new CodecError('PEM_INVALID', '私钥为空')
  if (isEncryptedPrivateKey(pem)) throw new CodecError('PEM_ENCRYPTED')
  if (isPkcs1PrivateKey(pem)) throw new CodecError('PKCS1_UNSUPPORTED')
  if (!isPkcs8PrivateKey(pem)) throw new CodecError('PEM_INVALID', '期望看到 -----BEGIN PRIVATE KEY----- 头')
}

function pemToBytes(pem: string, label: string): Uint8Array {
  const body = pem
    .replace(new RegExp(`-----BEGIN ${label}-----`), '')
    .replace(new RegExp(`-----END ${label}-----`), '')
    .replace(/\s+/g, '')
  if (!body) throw new CodecError('PEM_INVALID')
  try {
    return base64ToBytes(body)
  } catch {
    throw new CodecError('PEM_INVALID', 'PEM 主体不是合法 Base64')
  }
}

async function importPkcs8For(padding: RsaPadding, pem: string, usages: readonly KeyUsage[]): Promise<CryptoKey> {
  assertSupportedPrivateKey(pem)
  const der = pemToBytes(pem, 'PRIVATE KEY')
  const importAlgorithm = rsaImportAlgorithm(padding)
  try {
    return await subtle().importKey('pkcs8', toBufferSource(der), importAlgorithm, false, [...usages])
  } catch (err) {
    if (isUnsupportedAlgorithmError(err)) {
      throw new CodecError('UNSUPPORTED', `当前运行环境未实现 ${importAlgorithm.name}（Web Crypto 缺该算法）`)
    }
    throw new CodecError('PEM_INVALID', '这段 PKCS#8 私钥导入失败')
  }
}

/** OAEP 的上限是 k - 2*hLen - 2；PKCS#1 v1.5 是 k - 11 */
export function maxRsaPlaintextBytes(bits: number, padding: RsaPadding): number {
  const k = Math.ceil(bits / 8)
  return padding === 'oaep-sha1' ? k - 2 * 20 - 2 : k - 11
}

/**
 * PKCS1v1.5 在部分运行环境里根本没实现（Node 24 的 Web Crypto 就不支持）
 *
 * 这种情况下必须诚实地报「不支持」，而不是把 NotSupportedError 漏给用户。
 * 浏览器端（Chrome / Firefox / Safari）实现了它，代码路径保留。
 */
function isUnsupportedAlgorithmError(err: unknown): boolean {
  return err instanceof Error && err.name === 'NotSupportedError'
}

function rsaAlgorithm(padding: RsaPadding): { name: 'RSA-OAEP' } | { name: 'RSA-PKCS1v1_5' } {
  if (!RSA_PADDINGS.includes(padding)) throw new CodecError('UNSUPPORTED', `Web Crypto 不支持 ${padding}`)
  return padding === 'oaep-sha1' ? { name: 'RSA-OAEP' } : { name: 'RSA-PKCS1v1_5' }
}

/**
 * importKey 用的算法名与 encrypt/decrypt 用的**不一样**
 *
 * RSA-OAEP 导入密钥时必须带 hash（RsaHashedImportParams 要求），
 * 漏掉会得到一句毫无线索的「PEM 导入失败」。
 */
function rsaImportAlgorithm(padding: RsaPadding): { name: 'RSA-OAEP'; hash: string } | { name: 'RSA-PKCS1v1_5' } {
  const algorithm = rsaAlgorithm(padding)
  return algorithm.name === 'RSA-OAEP' ? { name: 'RSA-OAEP', hash: RSA_OAEP_HASH } : { name: 'RSA-PKCS1v1_5' }
}

export async function decryptRsa(
  ciphertextB64: string,
  privateKeyPem: string,
  padding: RsaPadding = 'oaep-sha1',
): Promise<string> {
  const algorithm = rsaAlgorithm(padding)
  let cipher: Uint8Array
  try {
    cipher = base64ToBytes(ciphertextB64.trim())
  } catch {
    throw new CodecError('CIPHERTEXT_FORMAT')
  }
  if (cipher.length === 0) throw new CodecError('CIPHERTEXT_FORMAT')

  const key = await importPkcs8For(padding, privateKeyPem, ['decrypt'])
  let plain: Uint8Array
  try {
    plain = new Uint8Array(await subtle().decrypt(algorithm, key, toBufferSource(cipher)))
  } catch {
    throw new CodecError('RSA_DECRYPT_FAILED')
  }
  try {
    return bytesToTextStrict(plain)
  } catch {
    throw new CodecError('RSA_DECRYPT_FAILED', '解密结果不是合法 UTF-8')
  }
}

export async function encryptRsa(
  plaintext: string,
  publicKeyPem: string,
  padding: RsaPadding = 'oaep-sha1',
): Promise<string> {
  const algorithm = rsaAlgorithm(padding)
  const der = pemToBytes(publicKeyPem, 'PUBLIC KEY')
  let key: CryptoKey
  try {
    key = await subtle().importKey('spki', toBufferSource(der), rsaImportAlgorithm(padding), false, ['encrypt'])
  } catch (err) {
    if (isUnsupportedAlgorithmError(err)) {
      throw new CodecError(
        'UNSUPPORTED',
        `当前运行环境未实现 ${rsaImportAlgorithm(padding).name}（Web Crypto 缺该算法）`,
      )
    }
    throw new CodecError('PEM_INVALID', '这段公钥导入失败（期望 SPKI / -----BEGIN PUBLIC KEY-----）')
  }

  const modulus = (key.algorithm as RsaHashedKeyAlgorithm).modulusLength
  const limit = maxRsaPlaintextBytes(modulus, padding)
  if (textToBytes(plaintext).length > limit) {
    throw new CodecError('RSA_TOO_LONG', `${modulus} 位密钥在 ${padding} 下最多装 ${limit} 字节`)
  }

  const out = new Uint8Array(await subtle().encrypt(algorithm, key, toBufferSource(textToBytes(plaintext))))
  return bytesToBase64(out)
}

export interface RsaKeyPairPem {
  publicKeyPem: string
  privateKeyPem: string
}

/** 生成密钥对。密钥只活在内存里，由调用方决定要不要复制走 */
export async function generateRsaKeyPair(bits: RsaKeySize = 2048): Promise<RsaKeyPairPem> {
  if (!RSA_KEY_SIZES.includes(bits)) throw new CodecError('UNSUPPORTED', `不支持 ${bits} 位密钥`)
  const pair = await subtle().generateKey(
    { name: 'RSA-OAEP', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: RSA_OAEP_HASH },
    true,
    ['encrypt', 'decrypt'],
  )
  const [pkcs8, spki] = await Promise.all([
    subtle().exportKey('pkcs8', pair.privateKey),
    subtle().exportKey('spki', pair.publicKey),
  ])
  return {
    publicKeyPem: pemWrap(new Uint8Array(spki), 'PUBLIC KEY'),
    privateKeyPem: pemWrap(new Uint8Array(pkcs8), 'PRIVATE KEY'),
  }
}

function pemWrap(bytes: Uint8Array, label: string): string {
  const body = bytesToBase64(bytes)
    .replace(/(.{64})/g, '$1\n')
    .replace(/\n$/, '')
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`
}
