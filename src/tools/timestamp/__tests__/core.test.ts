import { describe, expect, it } from 'vitest'

import {
  TIME_ZONE_IDS,
  TIMESTAMP_SAMPLE,
  buildTimestampView,
  detectUnit,
  formatRelative,
  getZonedParts,
  nowTimestamps,
  parseTimestampInput,
  parseZonedDateTime,
  resolveTimeZone,
  zoneOffsetMs,
  zonedTimeToEpoch,
} from '../core'

const NOW = Date.UTC(2024, 4, 20, 5, 45, 30) // 2024-05-20 13:45:30 +08:00

describe('detectUnit / 位数识别', () => {
  it('10 位按秒、13 位按毫秒', () => {
    expect(detectUnit('1716187530')).toBe('seconds')
    expect(detectUnit('1716187530000')).toBe('millis')
  })

  it('位数更少也按秒，位数更多按毫秒', () => {
    expect(detectUnit('1')).toBe('seconds')
    expect(detectUnit('171618753012345')).toBe('millis')
  })

  it('11 / 12 位按量级兜底', () => {
    expect(detectUnit('12345678901')).toBe('seconds')
    expect(detectUnit('171618753012')).toBe('millis')
  })

  it('带前导零与负号仍能识别', () => {
    expect(detectUnit('0000000001')).toBe('seconds')
    expect(detectUnit('-1716187530')).toBe('seconds')
  })

  it('非纯数字返回 null', () => {
    expect(detectUnit('abc')).toBeNull()
    expect(detectUnit('1716187530.5')).toBeNull()
    expect(detectUnit('')).toBeNull()
  })
})

describe('parseTimestampInput / 时间戳方向', () => {
  it('秒级时间戳换算成毫秒', () => {
    const result = parseTimestampInput('1716183930')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.epochMs).toBe(1716183930000)
    expect(result.unit).toBe('seconds')
    expect(result.kind).toBe('timestamp')
  })

  it('毫秒级时间戳原样使用', () => {
    const result = parseTimestampInput('1716187530000')
    expect(result.ok && result.epochMs).toBe(1716187530000)
    expect(result.ok && result.unit).toBe('millis')
  })

  it('空输入返回 empty', () => {
    expect(parseTimestampInput('   ')).toEqual({ ok: false, code: 'empty' })
  })

  it('既不是数字也不是日期时给出明确错误码', () => {
    expect(parseTimestampInput('昨天')).toEqual({ ok: false, code: 'notTimestamp' })
  })

  it('超出可表示范围报 outOfRange 而不是抛错', () => {
    expect(parseTimestampInput('9'.repeat(19))).toEqual({ ok: false, code: 'outOfRange' })
  })

  it('超出 19 位的纯数字按 notTimestamp 处理', () => {
    expect(parseTimestampInput('1'.repeat(25)).ok).toBe(false)
  })
})

describe('parseZonedDateTime / 日期方向', () => {
  it('同一段墙钟时间在不同时区得到不同纪元毫秒', () => {
    const shanghai = parseZonedDateTime('2024-05-20 13:45:30', 'Asia/Shanghai')
    const utc = parseZonedDateTime('2024-05-20 13:45:30', 'UTC')
    expect(shanghai).toBe(1716183930000)
    expect(utc).toBe(1716212730000)
    expect((shanghai as number) - (utc as number)).toBe(-8 * 3600 * 1000)
  })

  it('支持 T 分隔、斜杠分隔与省略秒', () => {
    expect(parseZonedDateTime('2024-05-20T13:45:30', 'UTC')).toBe(parseZonedDateTime('2024/05/20 13:45:30', 'UTC'))
    expect(parseZonedDateTime('2024-05-20 13:45', 'UTC')).toBe(1716212700000)
  })

  it('纯日期按当天 00:00:00 处理', () => {
    expect(parseZonedDateTime('2024-05-20', 'UTC')).toBe(1716163200000)
  })

  it('带显式偏移量的 ISO 串交给 Date.parse', () => {
    expect(parseZonedDateTime('2024-05-20T13:45:30+08:00', 'UTC')).toBe(1716183930000)
    expect(parseZonedDateTime('2024-05-20T05:45:30Z', 'Asia/Shanghai')).toBe(1716183930000)
  })

  it('不存在的日期与非法时刻返回 null', () => {
    expect(parseZonedDateTime('2024-02-31', 'UTC')).toBeNull()
    expect(parseZonedDateTime('2024-13-01', 'UTC')).toBeNull()
    expect(parseZonedDateTime('2024-05-20 25:00', 'UTC')).toBeNull()
    expect(parseZonedDateTime('2024-05-20 13:60', 'UTC')).toBeNull()
  })

  it('闰年 2 月 29 日在闰年合法、平年非法', () => {
    expect(parseZonedDateTime('2024-02-29', 'UTC')).toBe(1709164800000)
    expect(parseZonedDateTime('2023-02-29', 'UTC')).toBeNull()
  })

  it('parseTimestampInput 的日期分支会给出 invalidDate', () => {
    expect(parseTimestampInput('2024-02-31', 'UTC')).toEqual({ ok: false, code: 'invalidDate' })
    const ok = parseTimestampInput('2024-05-20 13:45:30', 'Asia/Shanghai')
    expect(ok.ok && ok.kind).toBe('date')
    expect(ok.ok && ok.epochMs).toBe(1716183930000)
  })
})

describe('时区反解', () => {
  it('偏移量符合常识', () => {
    expect(zoneOffsetMs(NOW, 'UTC')).toBe(0)
    expect(zoneOffsetMs(NOW, 'Asia/Shanghai')).toBe(8 * 3600 * 1000)
  })

  it('纽约冬夏偏移不同（夏令时）', () => {
    const winter = zoneOffsetMs(Date.UTC(2024, 0, 15), 'America/New_York')
    const summer = zoneOffsetMs(Date.UTC(2024, 6, 15), 'America/New_York')
    expect(winter).toBe(-5 * 3600 * 1000)
    expect(summer).toBe(-4 * 3600 * 1000)
  })

  it('墙上时间 → 纪元毫秒可逆（含夏令时两侧）', () => {
    for (const [month, expectedOffset] of [
      [0, -5 * 3600 * 1000],
      [6, -4 * 3600 * 1000],
    ] as const) {
      const date = new Date(Date.UTC(2024, month, 15, 12, 0, 0))
      const parts = getZonedParts(date.getTime(), 'America/New_York')
      expect(zonedTimeToEpoch(parts, 'America/New_York')).toBe(date.getTime())
      expect(zoneOffsetMs(date.getTime(), 'America/New_York')).toBe(expectedOffset)
    }
  })

  it('非法时区退回本地时区而不是抛异常', () => {
    expect(resolveTimeZone('Not/AZone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(resolveTimeZone('')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(resolveTimeZone('local')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('所有可选时区都能解析', () => {
    for (const id of TIME_ZONE_IDS) {
      expect(typeof resolveTimeZone(id)).toBe('string')
      expect(parseZonedDateTime('2024-05-20 13:45:30', id)).not.toBeNull()
    }
  })
})

describe('formatRelative / 相对时间', () => {
  it('5 秒内算刚刚', () => {
    expect(formatRelative(NOW, NOW + 3000)).toEqual({ unit: 'justNow', amount: 0, past: true })
    expect(formatRelative(NOW, NOW)).toEqual({ unit: 'justNow', amount: 0, past: true })
    expect(formatRelative(NOW + 3000, NOW)).toEqual({ unit: 'justNow', amount: 0, past: false })
  })

  it('秒 / 分 / 时 / 天逐级收敛', () => {
    expect(formatRelative(NOW - 30_000, NOW)).toEqual({ unit: 'second', amount: 30, past: true })
    expect(formatRelative(NOW - 5 * 60_000, NOW)).toEqual({ unit: 'minute', amount: 5, past: true })
    expect(formatRelative(NOW - 3 * 3600_000, NOW)).toEqual({ unit: 'hour', amount: 3, past: true })
    expect(formatRelative(NOW - 2 * 86400_000, NOW)).toEqual({ unit: 'day', amount: 2, past: true })
  })

  it('月与年', () => {
    expect(formatRelative(NOW - 60 * 86400_000, NOW).unit).toBe('month')
    expect(formatRelative(NOW - 800 * 86400_000, NOW)).toEqual({ unit: 'year', amount: 2, past: true })
  })

  it('未来时间 past 为 false', () => {
    expect(formatRelative(NOW + 10 * 60_000, NOW)).toEqual({ unit: 'minute', amount: 10, past: false })
  })
})

describe('buildTimestampView', () => {
  it('上海时区输出日期时间、ISO、星期与相对时间', () => {
    const view = buildTimestampView(1716183930000, 'Asia/Shanghai', NOW)
    expect(view.dateTime).toBe('2024-05-20 13:45:30')
    expect(view.iso).toBe('2024-05-20T05:45:30.000Z')
    expect(view.weekday).toBe('星期一')
    expect(view.relative).toEqual({ unit: 'justNow', amount: 0, past: true })
    expect(view.epochSeconds).toBe(1716183930)
    expect(view.epochMs).toBe(1716183930000)
    expect(view.timeZone).toBe('Asia/Shanghai')
  })

  it('UTC 时区下同一时刻的墙钟时间不同', () => {
    const view = buildTimestampView(1716183930000, 'UTC', NOW)
    expect(view.dateTime).toBe('2024-05-20 05:45:30')
  })

  it('晚于基准时刻时给出「后」的方向', () => {
    const view = buildTimestampView(NOW + 3 * 60_000, 'UTC', NOW)
    expect(view.relative.past).toBe(false)
    expect(view.relative.amount).toBe(3)
  })

  it('秒级与毫秒级时间戳得到同一时刻', () => {
    const fromSeconds = buildTimestampView(1716183930000, 'UTC', NOW)
    const fromMillis = buildTimestampView(1716183930 * 1000, 'UTC', NOW)
    expect(fromSeconds.dateTime).toBe(fromMillis.dateTime)
  })
})

describe('nowTimestamps / 当前时间', () => {
  it('同时给出秒与毫秒', () => {
    expect(nowTimestamps(NOW)).toEqual({ seconds: '1716183930', millis: '1716183930000' })
  })

  it('默认取当前时间且是合法数字', () => {
    // 不用「ms === s*1000 + Date.now()%1000」断言：
    // 实现与断言各调一次 Date.now()，跨过毫秒边界就必然失败（典型 flaky）
    const before = Date.now()
    const stamps = nowTimestamps()
    const after = Date.now()

    const sec = Number(stamps.seconds)
    const ms = Number(stamps.millis)

    expect(sec).toBeGreaterThan(1_600_000_000)
    expect(ms).toBeGreaterThanOrEqual(before)
    expect(ms).toBeLessThanOrEqual(after)
    // 秒值必须是毫秒值整除 1000 的结果
    expect(ms % 1000).toBe(ms - sec * 1000)
  })
})

describe('TIMESTAMP_SAMPLE', () => {
  it('示例能被自己的解析器吃下', () => {
    const result = parseTimestampInput(TIMESTAMP_SAMPLE, 'Asia/Shanghai')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const view = buildTimestampView(result.epochMs, 'Asia/Shanghai', result.epochMs)
    expect(view.dateTime).toBe('2024-05-20 13:45:30')
  })
})
