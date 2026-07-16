import { describe, expect, it } from 'vitest'
import { findInvalidChineseIds, isValidChineseId } from '@/lib/chineseId'

describe('身份证 MOD 11-2 校验', () => {
  it('校验 18 位身份证号码', () => {
    expect(isValidChineseId('11010519491231002X')).toBe(true)
    expect(isValidChineseId('11010519491231002x')).toBe(true)
    expect(isValidChineseId('110105194912310021')).toBe(false)
    expect(isValidChineseId('')).toBe(false)
  })

  it('区分长度和校验码错误，并提示 17、18 位号码应有的校验码', () => {
    expect(findInvalidChineseIds('11010519491231002X\n\n110105194912310021\n11010519491231002\n123')).toEqual([
      { line: 3, id: '110105194912310021', reason: '校验码不对', expectedCheckCode: 'X' },
      { line: 4, id: '11010519491231002', reason: '长度不对', expectedCheckCode: 'X' },
      { line: 5, id: '123', reason: '长度不对', expectedCheckCode: null },
    ])
  })
})
