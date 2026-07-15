import { describe, expect, it } from 'vitest'
import { chiSquare2x2, parseNumberLines, summarize } from '@/lib/statistics'

describe('描述统计', () => {
  it('识别非法输入所在行', () => {
    expect(parseNumberLines('1\n\nabc\nInfinity\n2')).toEqual({
      values: [1, 2],
      invalidLines: [3, 4],
    })
  })

  it('空集没有统计结果', () => {
    expect(summarize([])).toBeNull()
  })

  it('计算总体方差、标准差和偶数中位数', () => {
    const result = summarize([1, 2, 3, 4])!
    expect(result.mean).toBe(2.5)
    expect(result.variance).toBe(1.25)
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(1.25))
    expect(result.median).toBe(2.5)
    expect(result.modes).toEqual([])
  })

  it('返回全部并列众数', () => {
    expect(summarize([1, 1, 2, 2, 3])?.modes).toEqual([1, 2])
  })
})

describe('2×2 Pearson 卡方统计量', () => {
  it('计算已知列联表', () => {
    expect(chiSquare2x2([10, 20, 30, 40])).toBeCloseTo(0.7936507936507936)
  })

  it('零分母时不计算', () => {
    expect(chiSquare2x2([0, 0, 10, 20])).toBeNull()
  })
})
