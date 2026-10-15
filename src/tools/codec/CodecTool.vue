<script setup lang="ts">
import { computed } from 'vue'

import ActionBar from '@/components/ActionBar.vue'
import ResultBox from '@/components/ResultBox.vue'
import ToolShell from '@/components/ToolShell.vue'
import { quips, ui } from '@/content'

import { DECODE_KIND_LABELS, type DecodeKind } from './core'
import {
  AES_KEY_LENGTHS,
  AES_MODES,
  HASH_ALGORITHMS,
  RSA_PADDINGS,
  UNSUPPORTED_ALGORITHMS,
  type AesKeyLength,
  type AesMode,
  type HashAlgorithm,
  type RsaPadding,
  type SecretSource,
} from './crypto'
import { useCodecTool, type CodecAction } from './useCodecTool'

/**
 * 解码 / 解密工作台 —— 视图层，只渲染，不含业务分支
 *
 * 两条刻在 UI 上的底线：
 * 1. 顶部常驻隐私承诺与安全边界（ToolShell 的 notice 插槽）
 * 2. 哈希命中时解码按钮置灰，并把「不可逆」写在最显眼处
 *
 * 直接解构 composable 的返回值，让每个 ref 都成为顶层绑定，模板才能自动解包。
 */

const {
  input,
  results,
  pending,
  matches,
  primary,
  isHash,
  decodeActions,
  hashActions,
  manualKind,
  charsetSource,
  charsetEncoding,
  encodings,
  decodeKinds,
  depthLimit,
  hashAlgorithm,
  aesMode,
  aesSource,
  aesKeyLength,
  secret,
  rsaPadding,
  privateKeyPem,
  publicKeyPem,
  privateKeyHint,
  run,
  loadSample,
  clearInput,
  clearResults,
} = useCodecTool()

const inputActions = computed<CodecAction[]>(() => [
  { key: 'sample', label: ui.common.loadSample, kind: 'primary' },
  { key: 'auto', label: '自动多层解码', icon: '🧩', disabled: isHash.value },
  { key: 'clear', label: ui.common.clear, kind: 'ghost' },
])

const decodeActionBar = computed<CodecAction[]>(() => [
  ...decodeActions.value,
  { key: 'charset', label: '按指定编码重新解读' },
])

const cryptoActions = computed<CodecAction[]>(() => [
  { key: 'aes-encrypt', label: `AES-${aesMode.value.toUpperCase()} ${ui.common.encrypt}`, kind: 'primary' },
  { key: 'aes-decrypt', label: `AES-${aesMode.value.toUpperCase()} ${ui.common.decrypt}` },
  { key: 'rsa-encrypt', label: `RSA ${ui.common.encrypt}` },
  { key: 'rsa-decrypt', label: `RSA ${ui.common.decrypt}` },
  { key: 'rsa-keygen', label: '生成 RSA-2048 密钥对', kind: 'ghost' },
])

const clearResultActions: CodecAction[] = [{ key: 'clear-results', label: ui.common.clear, kind: 'ghost' }]

function onInputAction(key: string): void {
  if (key === 'sample') loadSample()
  else if (key === 'clear') clearInput()
  else void run(key)
}

function onKeyLength(event: Event): void {
  aesKeyLength.value = Number((event.target as HTMLSelectElement).value) as AesKeyLength
}
function onAesMode(event: Event): void {
  aesMode.value = (event.target as HTMLSelectElement).value as AesMode
}
function onSecretSource(event: Event): void {
  aesSource.value = (event.target as HTMLSelectElement).value as SecretSource
}
function onRsaPadding(event: Event): void {
  rsaPadding.value = (event.target as HTMLSelectElement).value as RsaPadding
}
function onHashAlgorithm(event: Event): void {
  hashAlgorithm.value = (event.target as HTMLSelectElement).value as HashAlgorithm
}
function onManualKind(event: Event): void {
  manualKind.value = (event.target as HTMLSelectElement).value as DecodeKind
}
function onCharsetSource(event: Event): void {
  charsetSource.value = (event.target as HTMLSelectElement).value as typeof charsetSource.value
}
function onCharsetEncoding(event: Event): void {
  charsetEncoding.value = (event.target as HTMLSelectElement).value as typeof charsetEncoding.value
}
</script>

<template>
  <ToolShell
    title="解码 / 解密工作台"
    tagline="贴一段看不懂的东西进来，先认出它是什么，再决定怎么处理"
    :notice="quips.codec.warning"
    notice-kind="warn"
  >
    <template #notice-icon>🔒</template>

    <p class="notice notice-info">🔒 {{ ui.privacy.localOnly }}{{ ui.privacy.safeToPaste }}</p>

    <!-- ═══ 输入 ═══ -->
    <section class="card codec-block">
      <label class="codec-label" for="codec-input">{{ ui.common.input }}</label>
      <textarea
        id="codec-input"
        v-model="input"
        class="input codec-textarea"
        rows="6"
        spellcheck="false"
        :placeholder="quips.codec.empty"
      />
      <ActionBar :items="inputActions" @action="onInputAction" />
      <p class="codec-hint">最多解 {{ depthLimit }} 层，再深就成了噪声。</p>
    </section>

    <!-- ═══ 嗅探结果 ═══ -->
    <section v-if="matches.length" class="card codec-block">
      <p class="codec-label">{{ quips.codec.sniffed(primary?.label ?? '') }}</p>
      <ul class="codec-sniff-list">
        <li v-for="match in matches" :key="match.kind" class="codec-sniff-item">
          <span class="tag tag-stable">{{ match.label }}</span>
          <span class="codec-sniff-reason">{{ match.reason }}</span>
        </li>
      </ul>
    </section>

    <p v-else-if="input.trim()" class="notice notice-warn">🔍 {{ quips.codec.notFound }}</p>

    <!-- ═══ 哈希：不可逆，写在明处 ═══ -->
    <section v-if="isHash" class="notice notice-danger codec-danger">
      <strong>{{ quips.codec.hashWarn }}</strong>
      <span>{{ quips.codec.hashCanDo }}</span>
    </section>

    <!-- ═══ 解码路径 ═══ -->
    <section class="card codec-block">
      <p class="codec-label">{{ ui.common.decoding }}</p>
      <ActionBar :items="decodeActionBar" @action="(key) => run(key)" />

      <div class="codec-grid">
        <label class="codec-field">
          <span>字符编码来源</span>
          <select class="select" :value="charsetSource" @change="onCharsetSource">
            <option value="base64">Base64</option>
            <option value="base64url">Base64URL</option>
            <option value="hex">Hex</option>
            <option value="binary">Binary</option>
          </select>
        </label>
        <label class="codec-field">
          <span>按编码解读</span>
          <select class="select" :value="charsetEncoding" @change="onCharsetEncoding">
            <option v-for="enc in encodings" :key="enc" :value="enc">{{ enc }}</option>
          </select>
        </label>
        <label class="codec-field">
          <span>手动指定解码方式</span>
          <select class="select" :value="manualKind" @change="onManualKind">
            <option v-for="kind in decodeKinds" :key="kind" :value="kind">
              {{ DECODE_KIND_LABELS[kind] }}
            </option>
          </select>
        </label>
      </div>
      <p class="codec-hint">{{ quips.codec.charsetPick }}</p>
    </section>

    <!-- ═══ 哈希计算 ═══ -->
    <section class="card codec-block">
      <p class="codec-label">哈希计算</p>
      <div class="codec-grid">
        <label class="codec-field">
          <span>算法</span>
          <select class="select" :value="hashAlgorithm" @change="onHashAlgorithm">
            <option v-for="algorithm in HASH_ALGORITHMS" :key="algorithm" :value="algorithm">
              {{ algorithm }}
            </option>
          </select>
        </label>
      </div>
      <ActionBar :items="hashActions" @action="(key) => run(key)" />
      <p class="codec-hint">{{ quips.codec.hashWarn }}</p>
    </section>

    <!-- ═══ AES ═══ -->
    <section class="card codec-block">
      <p class="codec-label">AES（GCM / CBC）</p>
      <div class="codec-grid">
        <label class="codec-field">
          <span>模式</span>
          <select class="select" :value="aesMode" @change="onAesMode">
            <option v-for="mode in AES_MODES" :key="mode" :value="mode">{{ mode.toUpperCase() }}</option>
          </select>
        </label>
        <label class="codec-field">
          <span>密钥来源</span>
          <select class="select" :value="aesSource" @change="onSecretSource">
            <option value="passphrase">密码短语（PBKDF2 派生）</option>
            <option value="hex">Hex 密钥</option>
          </select>
        </label>
        <label class="codec-field">
          <span>密钥长度</span>
          <select class="select" :value="aesKeyLength" @change="onKeyLength">
            <option v-for="len in AES_KEY_LENGTHS" :key="len" :value="len">{{ len }} 位</option>
          </select>
        </label>
      </div>
      <label class="codec-field">
        <span>{{ ui.common.keyword }}</span>
        <input
          v-model="secret"
          class="input"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :placeholder="aesSource === 'hex' ? '00 11 … 或 0011…' : '密码短语'"
        />
      </label>
      <p class="codec-hint">🔑 {{ quips.codec.secretHint }}</p>
    </section>

    <!-- ═══ RSA ═══ -->
    <section class="card codec-block">
      <p class="codec-label">RSA</p>
      <div class="codec-grid">
        <label class="codec-field">
          <span>填充方式</span>
          <select class="select" :value="rsaPadding" @change="onRsaPadding">
            <option v-for="padding in RSA_PADDINGS" :key="padding" :value="padding">{{ padding }}</option>
          </select>
        </label>
      </div>
      <label class="codec-field">
        <span>私钥（PKCS#8）</span>
        <textarea
          v-model="privateKeyPem"
          class="input codec-textarea codec-textarea--sm"
          rows="4"
          spellcheck="false"
          placeholder="-----BEGIN PRIVATE KEY-----"
        />
      </label>
      <label class="codec-field">
        <span>公钥（SPKI）</span>
        <textarea
          v-model="publicKeyPem"
          class="input codec-textarea codec-textarea--sm"
          rows="3"
          spellcheck="false"
          placeholder="-----BEGIN PUBLIC KEY-----"
        />
      </label>
      <p v-if="privateKeyHint" class="notice notice-warn">{{ privateKeyHint }}</p>
    </section>

    <ActionBar :items="cryptoActions" @action="(key) => run(key)" />

    <p v-if="pending" class="codec-hint">{{ ui.common.working }}</p>

    <!-- ═══ 明确不支持 ═══ -->
    <section class="notice notice-warn">
      <strong>{{ quips.codec.unsupportedTitle }}</strong>
      <ul class="codec-unsupported">
        <li v-for="algo in UNSUPPORTED_ALGORITHMS" :key="algo.id">
          <b>{{ algo.name }}</b
          >：{{ algo.reason }}
        </li>
        <li>{{ quips.codec.pkcs1Unsupported }}</li>
        <li>{{ quips.codec.opensslUnsupported }}</li>
      </ul>
    </section>

    <!-- ═══ 结果 ═══ -->
    <section v-if="results.length" class="codec-results">
      <div class="codec-results-head">
        <p class="codec-label">{{ ui.common.output }}</p>
        <ActionBar :items="clearResultActions" @action="clearResults()" />
      </div>

      <article v-for="result in results" :key="result.id" class="card codec-result">
        <header class="codec-result-head">
          <h2 class="codec-result-title">{{ result.title }}</h2>
          <span class="tag tag-beta">🔒 {{ quips.codec.localOnlyTag }}</span>
        </header>
        <ResultBox :value="result.value" :error="result.error" :error-detail="result.errorDetail" empty-hint="—" mono />
        <p v-if="result.note" class="codec-result-note">{{ result.note }}</p>
      </article>
    </section>
  </ToolShell>
</template>

<style scoped>
.codec-block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}

.codec-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.codec-textarea {
  min-height: 120px;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 13px;
  resize: vertical;
}

.codec-textarea--sm {
  min-height: 72px;
}

.codec-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}

.codec-danger {
  flex-direction: column;
  gap: var(--sp-1);
}

.codec-sniff-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.codec-sniff-item {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
}

.codec-sniff-reason {
  font-size: 12.5px;
  color: var(--text-sub);
}

.codec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--sp-3);
  margin: var(--sp-3) 0;
}

.codec-field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  min-width: 0;
}

.codec-field > span {
  font-size: 12px;
  color: var(--text-sub);
}

.codec-unsupported {
  margin: var(--sp-1) 0 0;
  padding-left: var(--sp-5);
  font-size: 12.5px;
  line-height: 1.7;
}

.codec-results {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.codec-results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}

.codec-result {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
}

.codec-result-head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: center;
  justify-content: space-between;
}

.codec-result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.codec-result-note {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
  white-space: pre-wrap;
}
</style>
