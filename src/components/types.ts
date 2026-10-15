/**
 * 组件层的共享类型
 *
 * 单独成文件而不是放在 .vue 里：`defineProps<...>()` 写在 `<script setup>` 内时，
 * 外部无法可靠地 type-import 它，工具层只能各自复制一份结构相同的定义。
 */

export interface ActionItem {
  /** 点击时 emit('action', key)，由工具层 switch 分发 */
  key: string
  label: string
  /** primary 用于主操作，同一行最多一个 */
  kind?: 'primary' | 'default' | 'ghost'
  disabled?: boolean
  icon?: string
}

export type NoticeKind = 'info' | 'warn' | 'danger' | 'success'
