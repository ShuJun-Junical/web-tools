import { describe, expect, it } from 'vitest'
import { countPositiveCoins, getHexagram, interpretYao } from '@/lib/iching'

describe('周易起卦', () => {
  it('按正面数量判断爻', () => {
    expect([
      countPositiveCoins([false, false, false]),
      countPositiveCoins([true, false, false]),
      countPositiveCoins([true, true, false]),
      countPositiveCoins([true, true, true]),
    ]).toEqual([0, 1, 2, 3])
  })

  it('识别乾坤两卦', () => {
    expect(getHexagram([true, true, true, true, true, true])).toMatchObject({ number: 1, name: '乾为天' })
    expect(getHexagram([false, false, false, false, false, false])).toMatchObject({ number: 2, name: '坤为地' })
  })

  it('由本卦的老阴老阳生成变卦', () => {
    const result = interpretYao([3, 1, 1, 2, 2, 2])
    expect(result.original).toMatchObject({ number: 11, name: '地天泰' })
    expect(result.changed).toMatchObject({ number: 46, name: '地风升' })
    expect(result.changingLines).toEqual([1])
  })

  it('拒绝不足六爻的输入', () => {
    expect(() => interpretYao([])).toThrow('六爻')
  })
})
