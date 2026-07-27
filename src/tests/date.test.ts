import { describe, expect, it } from 'vitest'
import { expandYear, formatDateInput, parseDateInput } from '@/lib/date'

describe('日期输入解析', () => {
  it('解析四位年份的紧凑日期', () => {
    expect(parseDateInput('20260304')).toEqual({ year: 2026, month: 3, day: 4 })
  })

  it('按当前年份切分两位年份', () => {
    expect(expandYear(26, 2026)).toBe(2026)
    expect(expandYear(27, 2026)).toBe(1927)
    expect(parseDateInput('260304', 2026)).toEqual({ year: 2026, month: 3, day: 4 })
    expect(parseDateInput('270304', 2026)).toEqual({ year: 1927, month: 3, day: 4 })
  })

  it.each([
    '2026-3-4', '26-3-4',
    '2026/3/4', '26/3/4',
    '2026 3 4', '26 3 4',
    '2026,3,4', '26,3,4',
    '2026，3，4', '26，3，4',
    '2026.3.4', '26.3.4',
  ])('解析明确分隔的数字日期 %s', value => {
    expect(parseDateInput(value, 2026)).toEqual({ year: 2026, month: 3, day: 4 })
  })

  it('解析并格式化中文年月日', () => {
    expect(parseDateInput('26年3月4日', 2026)).toEqual({ year: 2026, month: 3, day: 4 })
    expect(formatDateInput({ year: 2026, month: 3, day: 4 })).toBe('2026年03月04日')
  })

  it('沿用 JavaScript Date 支持的字符串格式', () => {
    expect(parseDateInput('March 4, 2026')).toEqual({ year: 2026, month: 3, day: 4 })
  })

  it.each(['', '20260230', '2026-2-30', 'not a date'])('拒绝无效日期 %j', value => {
    expect(parseDateInput(value)).toBeNull()
  })
})
