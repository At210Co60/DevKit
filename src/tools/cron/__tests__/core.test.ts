import { describe, expect, it } from 'vitest'

import {
  CRON_ALIASES,
  CRON_FIELDS,
  CRON_LIMITATIONS,
  CRON_PRESETS,
  TIMEZONE_OPTIONS,
  checkCronAtom,
  describeCron,
  describeCronField,
  formatInTimeZone,
  formatRelativeTime,
  isValidTimeZone,
  summarizeCronFields,
  validateCronFields,
  weekdayInTimeZone,
  weekdayName,
  type CronFieldInfo,
  type CronFieldKey,
  type CronFieldSpec,
} from '../core'

/** 固定「现在」，避免测试跟着真实时间漂移 */
const NOW = new Date('2026-03-10T12:00:00Z')
const opts = { now: NOW, timeZone: 'UTC' } as const

/** 按字段名取规格，避免测试里到处写数组下标 */
function spec(key: CronFieldKey): CronFieldSpec {
  const found = CRON_FIELDS.find((item) => item.key === key)
  if (!found) throw new Error(`core 未导出字段规格：${key}`)
  return found
}

describe('checkCronAtom —— 单段校验', () => {
  it('接受 * 与 ?', () => {
    expect(checkCronAtom('*', spec('minute'))).toBeNull()
    expect(checkCronAtom('?', spec('minute'))).toBeNull()
  })

  it('接受步长与列表', () => {
    expect(checkCronAtom('*/15', spec('minute'))).toBeNull()
    expect(checkCronAtom('1,2,3', spec('minute'))).toBeNull()
    expect(checkCronAtom('10-20', spec('minute'))).toBeNull()
  })

  it('越界取值得给出具体原因', () => {
    expect(checkCronAtom('60', spec('minute'))).toContain('0-59')
    expect(checkCronAtom('24', spec('hour'))).toContain('0-23')
    expect(checkCronAtom('0', spec('dayOfMonth'))).toContain('1-31')
    expect(checkCronAtom('13', spec('dayOfWeek'))).toContain('0-7')
  })

  it('步长必须是非零数字', () => {
    expect(checkCronAtom('*/0', spec('minute'))).toContain('步长不能是 0')
    expect(checkCronAtom('*/x', spec('minute'))).toContain('不是数字')
    expect(checkCronAtom('*/1/2', spec('minute'))).toContain('好几遍')
  })

  it('拒绝反区间，但星期允许跨圈区间', () => {
    expect(checkCronAtom('5-1', spec('minute'))).toContain('起点比终点')
    expect(checkCronAtom('5-1', spec('dayOfWeek'))).toBeNull()
  })

  it('大小写不敏感的英文别名可用', () => {
    expect(checkCronAtom('JAN', spec('month'))).toBeNull()
    expect(checkCronAtom('mon', spec('dayOfWeek'))).toBeNull()
    expect(checkCronAtom('MONDAY', spec('dayOfWeek'))).not.toBeNull()
    expect(checkCronAtom('FOO', spec('dayOfWeek'))).not.toBeNull()
  })

  it('L 只允许日字段与星期字段，且不能写成 L-3', () => {
    expect(checkCronAtom('L', spec('dayOfMonth'))).toBeNull()
    expect(checkCronAtom('L', spec('dayOfWeek'))).toBeNull()
    expect(checkCronAtom('L', spec('minute'))).toContain('不支持 L')
    expect(checkCronAtom('L-3', spec('dayOfMonth'))).toContain('L 只能单独使用')
  })

  it('# 只允许星期字段，且序号限 1-5', () => {
    expect(checkCronAtom('5#3', spec('dayOfWeek'))).toBeNull()
    expect(checkCronAtom('5#7', spec('dayOfWeek'))).toContain('1-5')
    expect(checkCronAtom('5#3', spec('minute'))).toContain('不支持 #')
  })

  it('拒绝列表里的空项', () => {
    expect(checkCronAtom('1,,2', spec('minute'))).toContain('空项')
  })
})

describe('validateCronFields —— 逐段定位', () => {
  it('通过合法表达式时返回 null', () => {
    expect(validateCronFields(['*/5', '9-18', '*', '*', '1-5'])).toBeNull()
  })

  it('报出出错字段的下标与字段名', () => {
    const issue = validateCronFields(['0', '25', '*', '*', '*'])
    expect(issue?.fieldKey).toBe('hour')
    expect(issue?.fieldIndex).toBe(2)
    expect(issue?.message).toContain('小时字段「25」')
  })
})

describe('describeCronField —— 字段解释', () => {
  it('解释通配、步长、区间、列表', () => {
    expect(describeCronField('*', 'minute')).toBe('每分钟')
    expect(describeCronField('*/15', 'minute')).toBe('每 15 分钟')
    expect(describeCronField('9-18', 'hour')).toBe('9 到 18 点')
    expect(describeCronField('1,15', 'dayOfMonth')).toBe('1 日、15 日')
  })

  it('星期用中文名且 7 与 0 都读作周日', () => {
    expect(describeCronField('1-5', 'dayOfWeek')).toBe('周一至周五')
    expect(describeCronField('0', 'dayOfWeek')).toBe('周日')
    expect(describeCronField('7', 'dayOfWeek')).toBe('周日')
    expect(weekdayName(3)).toBe('周三')
    expect(weekdayName(7)).toBe('周日')
  })

  it('解释 L 与 #', () => {
    expect(describeCronField('L', 'dayOfMonth')).toBe('每月最后一天')
    expect(describeCronField('5#3', 'dayOfWeek')).toBe('每月第 3 个周五')
    expect(describeCronField('?', 'dayOfWeek')).toBe('不指定（等同 *）')
  })

  it('解释英文别名', () => {
    expect(describeCronField('JAN', 'month')).toBe('1 月')
    expect(describeCronField('FRI', 'dayOfWeek')).toBe('周五')
  })
})

describe('summarizeCronFields —— 整体描述', () => {
  const fields = (pairs: [string, string][]): CronFieldInfo[] =>
    pairs.map(([key, raw]) => ({ key: key as CronFieldInfo['key'], raw, text: '' }))

  it('每天固定时刻', () => {
    expect(
      summarizeCronFields(
        fields([
          ['minute', '0'],
          ['hour', '0'],
          ['dayOfMonth', '*'],
          ['month', '*'],
          ['dayOfWeek', '*'],
        ]),
      ),
    ).toBe('每天 00:00')
  })

  it('每 5 分钟', () => {
    expect(
      summarizeCronFields(
        fields([
          ['minute', '*/5'],
          ['hour', '*'],
          ['dayOfMonth', '*'],
          ['month', '*'],
          ['dayOfWeek', '*'],
        ]),
      ),
    ).toBe('每天 每 5 分钟')
  })

  it('工作日时间段', () => {
    expect(
      summarizeCronFields(
        fields([
          ['minute', '0'],
          ['hour', '9-18'],
          ['dayOfMonth', '*'],
          ['month', '*'],
          ['dayOfWeek', '1-5'],
        ]),
      ),
    ).toBe('每周一至周五 09:00 到 18:00')
  })

  it('每月固定日', () => {
    expect(
      summarizeCronFields(
        fields([
          ['minute', '0'],
          ['hour', '0'],
          ['dayOfMonth', '1'],
          ['month', '*'],
          ['dayOfWeek', '*'],
        ]),
      ),
    ).toBe('每月 1 日 00:00')
  })

  it('年月同时指定时不重复加「每月」', () => {
    expect(
      summarizeCronFields(
        fields([
          ['minute', '0'],
          ['hour', '0'],
          ['dayOfMonth', '1'],
          ['month', '1'],
          ['dayOfWeek', '*'],
        ]),
      ),
    ).toBe('1 月 1 日 00:00')
  })

  it('日与星期同时指定时说明是「或」', () => {
    expect(
      summarizeCronFields(
        fields([
          ['minute', '0'],
          ['hour', '0'],
          ['dayOfMonth', '13'],
          ['month', '*'],
          ['dayOfWeek', '5'],
        ]),
      ),
    ).toBe('每月 13 日或周五（满足其一） 00:00')
  })

  it('分钟小时全通配', () => {
    expect(
      summarizeCronFields(
        fields([
          ['minute', '*'],
          ['hour', '*'],
          ['dayOfMonth', '*'],
          ['month', '*'],
          ['dayOfWeek', '*'],
        ]),
      ),
    ).toBe('每天 每分钟')
  })
})

describe('describeCron —— 主入口', () => {
  it('空输入返回 empty，不做任何计算', () => {
    const result = describeCron('   ', opts)
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('empty')
    expect(result.runs).toHaveLength(0)
  })

  it('段数不对时明确告知需要几段', () => {
    const result = describeCron('0 0 * *', opts)
    expect(result.error?.code).toBe('field-count')
    expect(result.error?.message).toContain('5 段')
    expect(result.error?.message).toContain('4 段')
  })

  it('字段非法时指到具体字段', () => {
    const result = describeCron('0 99 * * *', opts)
    expect(result.ok).toBe(false)
    expect(result.error?.fieldKey).toBe('hour')
    expect(result.error?.message).toContain('99')
  })

  it('解析成功后给出摘要与运行时间', () => {
    const result = describeCron('0 0 * * *', opts)
    expect(result.ok).toBe(true)
    expect(result.summary).toBe('每天 00:00')
    expect(result.runs).toHaveLength(5)
    expect(result.runs[0]?.text).toBe('2026-03-11 00:00:00')
    expect(result.runs[0]?.weekday).toBe('周三')
  })

  it('运行时间严格递增', () => {
    const result = describeCron('*/5 * * * *', opts)
    const times = result.runs.map((run) => run.date.getTime())
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]!).toBeGreaterThan(times[i - 1]!)
    }
  })

  it('count 可配置', () => {
    expect(describeCron('0 0 * * *', { ...opts, count: 3 }).runs).toHaveLength(3)
  })

  it('带 @ 的别名会展开，并标记 isAlias', () => {
    const result = describeCron('@daily', opts)
    expect(result.ok).toBe(true)
    expect(result.isAlias).toBe(true)
    expect(result.input).toBe('@daily')
    expect(result.summary).toBe('每天 00:00')
  })

  it('不支持的别名明确列出可用别名', () => {
    const result = describeCron('@reboot', opts)
    expect(result.error?.code).toBe('unsupported')
    expect(result.error?.message).toContain('@daily')
    expect(result.error?.message).toContain('@reboot')
  })

  it('所有内置别名都能解析', () => {
    for (const alias of Object.keys(CRON_ALIASES)) {
      expect(describeCron(alias, opts).ok, alias).toBe(true)
    }
  })

  it('预设里的表达式都可用', () => {
    for (const preset of CRON_PRESETS) {
      expect(describeCron(preset.expression, opts).ok, preset.expression).toBe(true)
    }
  })

  it('永远不会成立的日期组合归为 no-run', () => {
    const result = describeCron('0 0 30 2 *', opts)
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('no-run')
  })

  it('六段式按秒优先解析，并给出提醒', () => {
    const result = describeCron('30 * * * * *', opts)
    expect(result.ok).toBe(true)
    expect(result.hasSeconds).toBe(true)
    expect(result.fields[0]?.key).toBe('second')
    expect(result.runs[0]?.text).toBe('2026-03-10 12:00:30')
    expect(result.warnings.map((warning) => warning.code)).toContain('six-fields')
  })

  it('五段式不会误报 six-fields', () => {
    expect(describeCron('0 0 * * *', opts).warnings.map((w) => w.code)).not.toContain('six-fields')
  })

  it('日与星期同时写死时提醒「或」语义', () => {
    const codes = describeCron('0 0 13 * 5', opts).warnings.map((warning) => warning.code)
    expect(codes).toContain('dom-and-dow')
  })

  it('? 与 # 各自给出提醒', () => {
    expect(describeCron('0 0 * * ?', opts).warnings.map((w) => w.code)).toContain('question-mark')
    expect(describeCron('0 0 * * 5#3', opts).warnings.map((w) => w.code)).toContain('nth-weekday')
    expect(describeCron('0 0 L * *', opts).warnings.map((w) => w.code)).toContain('last-day')
  })

  it('时区会改变「下一次运行」落在哪个瞬间', () => {
    const utc = describeCron('0 9 * * *', opts)
    const shanghai = describeCron('0 9 * * *', { now: NOW, timeZone: 'Asia/Shanghai' })
    // 同一个「早上 9 点」，在两个时区是两个不同的瞬间
    expect(utc.runs[0]?.iso).toBe('2026-03-11T09:00:00.000Z')
    expect(shanghai.runs[0]?.iso).toBe('2026-03-11T01:00:00.000Z')
    expect(utc.runs[0]?.iso).not.toBe(shanghai.runs[0]?.iso)
    // 展示文本各自按本地时区渲染
    expect(utc.runs[0]?.text).toBe('2026-03-11 09:00:00')
    expect(shanghai.runs[0]?.text).toBe('2026-03-11 09:00:00')
    // 同一个瞬间换个时区读，墙上时间就变了
    expect(formatInTimeZone(new Date(utc.runs[0]!.iso), 'Asia/Shanghai')).toBe('2026-03-11 17:00:00')
  })

  it('非法时区被拦下而不是抛异常', () => {
    const result = describeCron('0 0 * * *', { now: NOW, timeZone: 'Not/AZone' })
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('timezone')
  })

  it('空格与首尾空白不影响解析', () => {
    expect(describeCron('   0   0  *  *  *  ', opts).ok).toBe(true)
  })

  it('解析 dayOfWeek 的 # 之后仍能正确解析别的表达式（options 不被污染）', () => {
    expect(describeCron('0 0 * * 5#3', opts).ok).toBe(true)
    const plain = describeCron('0 0 13 * *', opts)
    expect(plain.ok).toBe(true)
    expect(plain.runs[0]?.text).toBe('2026-03-13 00:00:00')
  })

  it('相同入参必得相同出参（纯函数）', () => {
    const a = describeCron('0 9 * * 1-5', opts)
    const b = describeCron('0 9 * * 1-5', opts)
    expect(a.summary).toBe(b.summary)
    expect(a.runs.map((r) => r.iso)).toEqual(b.runs.map((r) => r.iso))
  })
})

describe('时间格式化', () => {
  const date = new Date('2026-03-11T00:00:00Z')

  it('按目标时区格式化', () => {
    expect(formatInTimeZone(date, 'UTC')).toBe('2026-03-11 00:00:00')
    expect(formatInTimeZone(date, 'Asia/Shanghai')).toBe('2026-03-11 08:00:00')
  })

  it('按目标时区取星期', () => {
    expect(weekdayInTimeZone(date, 'UTC')).toBe('周三')
  })

  it('相对时间按量级取整', () => {
    const now = new Date('2026-03-10T12:00:00Z')
    expect(formatRelativeTime(new Date('2026-03-10T12:00:30Z'), now)).toBe('不到 1 分钟')
    expect(formatRelativeTime(new Date('2026-03-10T12:30:00Z'), now)).toBe('30 分钟后')
    expect(formatRelativeTime(new Date('2026-03-10T18:00:00Z'), now)).toBe('6 小时后')
    expect(formatRelativeTime(new Date('2026-03-13T12:00:00Z'), now)).toBe('3 天后')
    expect(formatRelativeTime(new Date('2026-06-10T12:00:00Z'), now)).toBe('3 个月后')
    expect(formatRelativeTime(new Date('2028-03-10T12:00:00Z'), now)).toBe('2 年后')
  })

  it('已经过去的时间不编未来', () => {
    expect(formatRelativeTime(new Date('2026-03-10T11:00:00Z'), NOW)).toBe('就是现在')
  })
})

describe('时区工具', () => {
  it('识别合法与非法时区', () => {
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('Asia/Shanghai')).toBe(true)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })

  it('提供的时区选项都合法（local 由 resolveTimeZone 转换）', () => {
    for (const option of TIMEZONE_OPTIONS) {
      expect(option.value === 'local' || isValidTimeZone(option.value), option.value).toBe(true)
    }
  })
})

describe('限制说明', () => {
  it('写清楚了工具做不到什么', () => {
    expect(CRON_LIMITATIONS.length).toBeGreaterThan(0)
    expect(CRON_LIMITATIONS.join('')).toContain('1W')
    expect(CRON_LIMITATIONS.join('')).toContain('@reboot')
  })
})
