import { computed, ref, type ComputedRef } from 'vue'

import { quips, ui } from '@/content'
import { SUPPORTED_ENCODINGS, type SupportedEncoding } from '@/utils/charset'

import {
  autoDecode,
  canDecodeAs,
  decodeAs,
  DECODE_KINDS,
  DECODE_KIND_LABELS,
  MAX_DECODE_DEPTH,
  reDecodeAsCharset,
  type DecodeKind,
} from './core'
import {
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
  type AesEnvelope,
  type AesKeyLength,
  type AesMode,
  type CodecErrorCode,
  type HashAlgorithm,
  type RsaPadding,
  type SecretSource,
} from './crypto'
import { sniff, sniffAll, type SniffMatch } from './sniffer'

/**
 * 第 2 层：状态编排
 *
 * 职责边界：
 * - core / crypto / sniffer 负责「算」，这里只负责「什么时候算、算完放哪」
 * - 异步收敛成 ref：组件层完全感知不到 await
 * - 密钥只活在内存里，**任何时候都不写 localStorage**（密钥泄漏事故大多出在这一行）
 */

export interface CodecResult {
  id: string
  title: string
  value: string
  note: string
  error: string | null
  errorDetail: string | null
}

export interface CodecAction {
  key: string
  label: string
  kind?: 'primary' | 'default' | 'ghost'
  disabled?: boolean
  icon?: string
}

/** 示例：一段标准 JWT */
export const SAMPLE_INPUT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRldktpdCJ9',
  'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
].join('.')

/* ───────────────────────── 错误映射 ───────────────────────── */

const ERROR_COPY: Record<CodecErrorCode, string> = {
  NO_WEBCRYPTO: quips.codec.errors.noWebCrypto,
  KEY_MISMATCH: quips.codec.errors.keyMismatch,
  IV_MISSING: quips.codec.errors.ivMissing,
  BAD_SECRET: quips.codec.errors.badSecret,
  EMPTY_SECRET: quips.codec.errors.emptySecret,
  KEY_LENGTH: quips.codec.errors.keyLength,
  CIPHERTEXT_FORMAT: quips.codec.errors.ciphertextFormat,
  PEM_INVALID: quips.codec.errors.pemInvalid,
  PEM_ENCRYPTED: quips.codec.pemEncryptedUnsupported,
  PKCS1_UNSUPPORTED: quips.codec.pkcs1Unsupported,
  RSA_TOO_LONG: quips.codec.errors.rsaTooLong,
  RSA_DECRYPT_FAILED: quips.codec.errors.rsaDecryptFailed,
  UNSUPPORTED: quips.codec.errors.unsupported,
  UNKNOWN: quips.codec.errors.unknown,
}

function describe(err: unknown): { message: string; detail: string | null } {
  if (err instanceof CodecError) {
    return { message: ERROR_COPY[err.code] ?? quips.codec.errors.unknown, detail: err.detail ?? null }
  }
  return {
    message: quips.codec.errors.unknown,
    detail: err instanceof Error ? err.message : String(err),
  }
}

/* ───────────────────────── composable ───────────────────────── */

export function useCodecTool() {
  const input = ref('')
  const results = ref<CodecResult[]>([])
  const pending = ref(false)

  /* ── 无密钥：解码 ── */
  const manualKind = ref<DecodeKind>('base64')
  const charsetSource = ref<'base64' | 'base64url' | 'hex' | 'binary'>('base64')
  const charsetEncoding = ref<SupportedEncoding>('gbk')

  /* ── 哈希 ── */
  const hashAlgorithm = ref<HashAlgorithm>('SHA-256')

  /* ── AES ── */
  const aesMode = ref<AesMode>('gcm')
  const aesSource = ref<SecretSource>('passphrase')
  const aesKeyLength = ref<AesKeyLength>(256)
  const secret = ref('')

  /* ── RSA ── */
  const rsaPadding = ref<RsaPadding>('oaep-sha1')
  const privateKeyPem = ref('')
  const publicKeyPem = ref('')

  /** 同一时刻只认最后一次请求，避免慢的异步结果盖掉新的 */
  let runToken = 0
  let seq = 0

  const matches: ComputedRef<SniffMatch[]> = computed(() => sniffAll(input.value))
  const primary: ComputedRef<SniffMatch | null> = computed(() => sniff(input.value))

  /** 哈希命中：解码入口必须置灰，且逻辑层也会拒绝执行 —— 双保险 */
  const isHash = computed(() => primary.value?.irreversible === true)
  const needsKey = computed(() => primary.value?.requiresKey === true)

  function push(item: Omit<CodecResult, 'id' | 'note' | 'error' | 'errorDetail'> & Partial<CodecResult>): void {
    seq += 1
    const next: CodecResult = {
      id: `r${seq}`,
      note: '',
      error: null,
      errorDetail: null,
      ...item,
    }
    results.value = [next, ...results.value].slice(0, 12)
  }

  function clearResults(): void {
    results.value = []
  }

  function loadSample(): void {
    input.value = SAMPLE_INPUT
  }

  function clearInput(): void {
    input.value = ''
    clearResults()
  }

  /* ───────────────────────── 具体动作 ───────────────────────── */

  function requireInput(): boolean {
    if (input.value.trim()) return true
    push({ title: quips.codec.empty, value: '', error: quips.codec.empty })
    return false
  }

  function runAuto(): void {
    if (!requireInput()) return
    const result = autoDecode(input.value)
    if (result.steps.length === 0) {
      push({ title: quips.codec.notFound, value: '', note: quips.codec.chooseKind, error: quips.codec.notFound })
      return
    }
    const trace = result.steps
      .map((s) => `${s.depth}. ${DECODE_KIND_LABELS[s.kind]} → ${s.value.slice(0, 40)}`)
      .join('\n')
    const notes = [
      `解了 ${result.steps.length} 层`,
      result.stoppedBy === 'depth' ? quips.codec.depthLimit : quips.codec.triedAll,
      trace,
    ]
    push({ title: '自动多层解码', value: result.final, note: notes.join('\n') })
  }

  function runDecode(kind: DecodeKind): void {
    if (!requireInput()) return

    // 兜底防线：即使 UI 被绕过，逻辑层也不会对哈希执行「解码」
    if (isHash.value) {
      push({
        title: primary.value!.label,
        value: `${quips.codec.hashWarn}\n${quips.codec.hashCanDo}`,
      })
      return
    }

    const result = decodeAs(kind, input.value)
    if (!result.ok) {
      push({ title: DECODE_KIND_LABELS[kind], value: '', error: result.error })
      return
    }
    push({ title: DECODE_KIND_LABELS[kind], value: result.value, note: result.note ?? '' })
  }

  function runCharset(): void {
    if (!requireInput()) return
    const result = reDecodeAsCharset(input.value, charsetSource.value, charsetEncoding.value)
    if (!result.ok) {
      push({ title: '字符编码', value: '', error: result.error })
      return
    }
    push({ title: `字符编码 · ${charsetEncoding.value}`, value: result.value, note: result.note ?? '' })
  }

  async function runHash(algorithm: HashAlgorithm): Promise<void> {
    if (!requireInput()) return
    const token = ++runToken
    pending.value = true
    try {
      const value = await hashText(input.value, algorithm)
      if (token !== runToken) return
      push({ title: `${algorithm} 摘要`, value, note: quips.codec.localOnlyTag })
    } catch (err) {
      if (token !== runToken) return
      const { message, detail } = describe(err)
      push({ title: `${algorithm} 摘要`, value: '', error: message, errorDetail: detail })
    } finally {
      if (token === runToken) pending.value = false
    }
  }

  async function runAes(mode: 'encrypt' | 'decrypt'): Promise<void> {
    if (!input.value.trim()) {
      push({ title: quips.codec.empty, value: '', error: quips.codec.empty })
      return
    }
    const token = ++runToken
    pending.value = true
    const params = {
      mode: aesMode.value,
      source: aesSource.value,
      keyLength: aesKeyLength.value,
    }
    const title =
      mode === 'encrypt'
        ? `AES-${aesMode.value.toUpperCase()} ${ui.common.encrypt}`
        : `AES-${aesMode.value.toUpperCase()} ${ui.common.decrypt}`
    try {
      if (mode === 'encrypt') {
        const envelope = await encryptAes(input.value, secret.value, params)
        if (token !== runToken) return
        push({ title, value: JSON.stringify(envelope, null, 2), note: quips.codec.localOnlyTag })
      } else {
        const envelope = JSON.parse(input.value) as AesEnvelope
        const text = await decryptAes(envelope, secret.value, params)
        if (token !== runToken) return
        push({ title, value: text, note: quips.codec.localOnlyTag })
      }
    } catch (err) {
      if (token !== runToken) return
      const { message, detail } = describe(err)
      push({ title, value: '', error: message, errorDetail: detail })
    } finally {
      if (token === runToken) pending.value = false
    }
  }

  async function runRsa(mode: 'encrypt' | 'decrypt'): Promise<void> {
    if (!input.value.trim()) {
      push({ title: quips.codec.empty, value: '', error: quips.codec.empty })
      return
    }
    const token = ++runToken
    pending.value = true
    const title = `RSA-${rsaPadding.value === 'oaep-sha1' ? 'OAEP' : 'PKCS1v1.5'} ${mode === 'encrypt' ? ui.common.encrypt : ui.common.decrypt}`
    try {
      const value =
        mode === 'encrypt'
          ? await encryptRsa(input.value, publicKeyPem.value, rsaPadding.value)
          : await decryptRsa(input.value, privateKeyPem.value, rsaPadding.value)
      if (token !== runToken) return
      push({ title, value, note: quips.codec.localOnlyTag })
    } catch (err) {
      if (token !== runToken) return
      const { message, detail } = describe(err)
      push({ title, value: '', error: message, errorDetail: detail })
    } finally {
      if (token === runToken) pending.value = false
    }
  }

  async function runKeygen(): Promise<void> {
    const token = ++runToken
    pending.value = true
    try {
      const pair = await generateRsaKeyPair(2048)
      if (token !== runToken) return
      publicKeyPem.value = pair.publicKeyPem
      privateKeyPem.value = pair.privateKeyPem
      push({
        title: 'RSA-2048 密钥对',
        value: pair.privateKeyPem,
        note: `${quips.codec.keyGenerated}\n${quips.codec.secretHint}`,
      })
    } catch (err) {
      if (token !== runToken) return
      const { message, detail } = describe(err)
      push({ title: 'RSA-2048 密钥对', value: '', error: message, errorDetail: detail })
    } finally {
      if (token === runToken) pending.value = false
    }
  }

  async function run(actionKey: string): Promise<void> {
    if (actionKey === 'auto') return runAuto()
    if (actionKey === 'charset') return runCharset()
    if (actionKey === 'rsa-keygen') return runKeygen()
    if (actionKey === 'aes-encrypt' || actionKey === 'aes-decrypt') {
      return runAes(actionKey === 'aes-encrypt' ? 'encrypt' : 'decrypt')
    }
    if (actionKey === 'rsa-encrypt' || actionKey === 'rsa-decrypt') {
      return runRsa(actionKey === 'rsa-encrypt' ? 'encrypt' : 'decrypt')
    }
    if (actionKey.startsWith('decode:')) return runDecode(actionKey.slice('decode:'.length) as DecodeKind)
    if (actionKey.startsWith('hash:')) return runHash(actionKey.slice('hash:'.length) as HashAlgorithm)
  }

  /* ───────────────────────── 给视图的动作清单 ───────────────────────── */

  /** 按嗅探结果给出的解码入口。哈希命中时全部置灰 —— UI 不给「解码哈希」这个选项 */
  const decodeActions: ComputedRef<CodecAction[]> = computed(() => {
    const actions: CodecAction[] = [
      { key: 'auto', label: '自动多层解码', kind: 'primary', icon: '🧩', disabled: isHash.value },
    ]
    for (const match of matches.value) {
      const kind = toDecodeKind(match.kind)
      if (!kind) continue
      actions.push({
        key: `decode:${kind}`,
        label: `按 ${match.label} 解码`,
        disabled: isHash.value || !canDecodeAs(kind, input.value),
      })
    }
    if (actions.length === 1) {
      actions.push({ key: `decode:${manualKind.value}`, label: `按 ${DECODE_KIND_LABELS[manualKind.value]} 解码` })
    }
    return actions
  })

  const hashActions: ComputedRef<CodecAction[]> = computed(() =>
    HASH_ALGORITHMS.map((algorithm) => ({
      key: `hash:${algorithm}`,
      label: `${algorithm} 摘要`,
      disabled: !input.value.trim(),
    })),
  )

  /** 私钥格式预判：PKCS#1 直接在 UI 上说清「请先转 PKCS#8」，而不是等解密报错 */
  const privateKeyHint: ComputedRef<string> = computed(() => {
    if (!privateKeyPem.value.trim()) return ''
    if (isPkcs1PrivateKey(privateKeyPem.value)) return quips.codec.pkcs1Unsupported
    if (isEncryptedPrivateKey(privateKeyPem.value)) return quips.codec.pemEncryptedUnsupported
    return ''
  })

  const encodings = SUPPORTED_ENCODINGS
  const decodeKinds = DECODE_KINDS
  const depthLimit = MAX_DECODE_DEPTH

  return {
    // 输入与结果
    input,
    results,
    pending,
    // 嗅探
    matches,
    primary,
    isHash,
    needsKey,
    // 解码参数
    manualKind,
    charsetSource,
    charsetEncoding,
    encodings,
    decodeKinds,
    depthLimit,
    // 哈希
    hashAlgorithm,
    // 密钥（仅内存，不落盘）
    aesMode,
    aesSource,
    aesKeyLength,
    secret,
    rsaPadding,
    privateKeyPem,
    publicKeyPem,
    privateKeyHint,
    // 动作
    decodeActions,
    hashActions,
    run,
    loadSample,
    clearInput,
    clearResults,
  }
}

/** 嗅探类型 → 解码方式。哈希类刻意返回 null：它们不可逆，没有对应的 decode */
function toDecodeKind(kind: SniffMatch['kind']): DecodeKind | null {
  switch (kind) {
    case 'base64':
      return 'base64'
    case 'base64url':
      return 'base64url'
    case 'hex':
      return 'hex'
    case 'binary':
      return 'binary'
    case 'url-encoded':
      return 'url'
    case 'unicode-escape':
      return 'unicode-escape'
    case 'html-entity':
      return 'html-entity'
    case 'morse':
      return 'morse'
    default:
      return null
  }
}

export type UseCodecTool = ReturnType<typeof useCodecTool>
