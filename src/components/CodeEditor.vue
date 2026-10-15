<script setup lang="ts">
import { json as jsonLang } from '@codemirror/lang-json'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * CodeMirror 6 封装 —— 全站唯一直接接触 CodeMirror 的文件
 *
 * 存在的意义：业务组件永远不该 import 'codemirror'。
 * 换编辑器 / 换主题 / 处理版本兼容，只需要改这一个文件。
 *
 * 配色不引入 oneDark 主题包，而是让 CodeMirror 跟随 styles/tokens.css
 * 的 --bg-code / --bg-code-fg，这样深色模式切换零额外成本。
 */

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** json = JSON 高亮；plain = 不高亮 */
    language?: 'json' | 'plain'
    readonly?: boolean
    placeholder?: string
  }>(),
  { language: 'plain', readonly: false, placeholder: '' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null
/** 外部 → 内部同步时置位，防止回环触发 emit */
let syncing = false

function create(doc: string, listen: boolean): EditorView {
  const extensions: Extension[] = [basicSetup]
  if (props.language === 'json') extensions.push(jsonLang())
  if (props.readonly) extensions.push(EditorState.readOnly.of(true))
  if (props.placeholder) {
    extensions.push(EditorView.contentAttributes.of({ 'aria-label': props.placeholder }))
  }
  if (listen) {
    extensions.push(
      EditorView.updateListener.of((u) => {
        if (!u.docChanged || syncing) return
        emit('update:modelValue', u.state.doc.toString())
      }),
    )
  }
  return new EditorView({
    state: EditorState.create({ doc, extensions }),
    parent: host.value!,
  })
}

function rebuild() {
  if (!host.value) return
  view?.destroy()
  host.value.innerHTML = ''
  view = create(props.modelValue, true)
}

onMounted(rebuild)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

/* 外部值变化 → 同步进编辑器。仅在内容真的不同时写入，避免光标被推到末尾 */
watch(
  () => props.modelValue,
  (next) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (current === next) return
    syncing = true
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
      selection: { anchor: Math.min(view.state.selection.main.anchor, next.length) },
    })
    syncing = false
  },
)

/* 语言与只读状态无法增量更新，变化时重建 */
watch(() => [props.language, props.readonly] as const, rebuild)

defineExpose({ focus: () => view?.focus() })
</script>

<template>
  <div ref="host" class="code-editor" />
</template>

<style scoped>
.code-editor {
  min-height: 180px;
  max-height: 60vh;
  overflow: auto;
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.code-editor :deep(.cm-editor) {
  max-height: 60vh;
  background: var(--bg-code);
  color: var(--bg-code-fg);
}

.code-editor :deep(.cm-editor.cm-focused) {
  outline: none;
}

.code-editor :deep(.cm-scroller) {
  font-family: 'SF Mono', 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: var(--code-fg-size);
  line-height: 1.6;
}

.code-editor :deep(.cm-gutters) {
  background: var(--bg-code);
  color: var(--text-muted);
  border-right: 1px solid var(--border);
}

.code-editor :deep(.cm-activeLine) {
  background: rgb(255 255 255 / 4%);
}
</style>
