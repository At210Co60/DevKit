/**
 * 字符编码判定与中文乱码排查
 *
 * 一个必须承认的现实：**浏览器只有 decoder，没有 encoder**（UTF-8 除外）。
 * 也就是说「用 GBK 编码一段中文」在浏览器里做不到，
 * 因此自动修复乱码只能覆盖部分场景。本文件的策略是：
 *
 *   - 能可靠自动修的（UTF-8 被误读成 Latin-1）→ 直接修
 *   - 不能可靠自动修的（GBK 误读）→ 诚实告知，并让用户手选编码重新解读原始字节
 *
 * 不做「万能乱码修复」，因为那种工具只会瞎猜。
 */

export type SupportedEncoding =
  'utf-8' | 'gbk' | 'gb18030' | 'big5' | 'shift_jis' | 'euc-kr' | 'windows-1252' | 'iso-8859-1'

export const SUPPORTED_ENCODINGS: readonly SupportedEncoding[] = [
  'utf-8',
  'gbk',
  'gb18030',
  'big5',
  'shift_jis',
  'euc-kr',
  'windows-1252',
  'iso-8859-1',
] as const

const REPLACEMENT = '\uFFFD'

/** 浏览器是否认识这个编码标签（各浏览器支持度略有差异） */
export function isSupportedEncoding(enc: string): enc is SupportedEncoding {
  try {
    new TextDecoder(enc)
    return true
  } catch {
    return false
  }
}

/** 字节序列是否是合法 UTF-8 */
export function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

/**
 * 判断一段文本里有没有真正的解码失败痕迹
 * 有替换字符 ≠ 一定是乱码，但要提示用户注意
 */
export function hasReplacementChar(text: string): boolean {
  return text.includes(REPLACEMENT)
}

/** 按指定编码解读字节。编码不被支持时抛错，由调用方兜底 */
export function decodeBytes(bytes: Uint8Array, encoding: string = 'utf-8'): string {
  return new TextDecoder(encoding).decode(bytes)
}

/**
 * 猜字节序列的编码
 *
 * 判据：合法 UTF-8 且含多字节序列 → utf-8；否则看是不是 GB18030 合法 → gbk；再兜底 latin1
 */
export function detectEncoding(bytes: Uint8Array): SupportedEncoding {
  if (bytes.length === 0) return 'utf-8'

  const hasHighByte = bytes.some((b) => b > 0x7f)
  if (!hasHighByte) return 'utf-8'

  if (isValidUtf8(bytes)) return 'utf-8'

  // UTF-8 挂掉但 GB18030 能解，说明大概率是国标编码
  if (isSupportedEncoding('gb18030')) {
    try {
      new TextDecoder('gb18030', { fatal: true }).decode(bytes)
      return 'gbk'
    } catch {
      /* 继续往下试 */
    }
  }

  return 'windows-1252'
}

/**
 * 修复「UTF-8 被误当成 Latin-1/CP1252」造成的乱码
 *
 * 这是最常见的乱码形态（各种 Curl/命令行输出乱码都是它）。
 * 原理：Latin-1 是字节到码位的一一映射，所以 charCode & 0xFF 就是原始字节。
 *
 * @returns 修复后的文本；如果原文本本来就是正常的，返回 null
 */
export function repairUtf8AsLatin1(text: string): string | null {
  // 已经含替换字符说明解码阶段就丢信息了，救不回来
  if (hasReplacementChar(text)) return null

  // 正常中文不该走这条路，含 CJK 的直接跳过
  if (/[\u4e00-\u9fff]/.test(text)) return null

  try {
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff)
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)

    // 解出来一模一样说明压根不是乱码（例如纯 ASCII），
    // 返回 null 而不是「修复成功」，否则界面会报一个假阳性
    if (decoded === text) return null

    if (!decoded.trim()) return null
    return decoded
  } catch {
    return null
  }
}
