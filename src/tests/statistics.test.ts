import { describe, expect, it } from 'vitest';
import {
  chiSquare2x2,
  linearCorrelation,
  parseNumberLines,
  phiCoefficient2x2,
  solveContingencyTable,
  summarize,
} from '@/lib/statistics';

describe('描述统计', () => {
  it('识别非法输入所在行', () => {
    expect(parseNumberLines('1\n\nabc\nInfinity\n2')).toEqual({
      values: [1, 2],
      invalidLines: [3, 4],
    });
  });

  it('空集没有统计结果', () => {
    expect(summarize([])).toBeNull();
  });

  it('计算总体方差、标准差和偶数中位数', () => {
    const result = summarize([1, 2, 3, 4])!;
    expect(result.mean).toBe(2.5);
    expect(result.variance).toBe(1.25);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(1.25));
    expect(result.median).toBe(2.5);
    expect(result.modes).toEqual([]);
  });

  it('返回全部并列众数', () => {
    expect(summarize([1, 1, 2, 2, 3])?.modes).toEqual([1, 2]);
  });
});

describe('2×2 Pearson 卡方统计量', () => {
  it('计算已知列联表', () => {
    expect(chiSquare2x2([10, 20, 30, 40])).toBeCloseTo(0.7936507936507936);
  });

  it('零分母时不计算', () => {
    expect(chiSquare2x2([0, 0, 10, 20])).toBeNull();
  });

  it('计算 Phi 关联强度', () => {
    expect(phiCoefficient2x2([10, 20, 30, 40])).toBeCloseTo(0.0890870806374748);
    expect(phiCoefficient2x2([0, 0, 10, 20])).toBeNull();
  });
});

describe('2×2 列联表补全', () => {
  it('根据分项和合计迭代补全表格', () => {
    const result = solveContingencyTable({ a: 4, ab: 10, ac: 8, cd: 10 });

    expect(result.values).toEqual({ a: 4, b: 6, c: 4, d: 6, ab: 10, cd: 10, ac: 8, bd: 12, n: 20 });
    expect(result.conflictKeys).toEqual([]);
  });

  it('信息不足时保留空值', () => {
    expect(solveContingencyTable({ a: 4 }).values.b).toBeNull();
  });

  it('识别合计冲突和负数推导', () => {
    expect(solveContingencyTable({ a: 4, b: 6, ab: 11 }).conflictKeys).toEqual(['a', 'b', 'ab']);
    expect(solveContingencyTable({ a: 12, ab: 10 }).negativeKeys).toEqual(['a', 'b', 'ab']);
  });
});

describe('Pearson 线性相关', () => {
  it('计算完全正相关及回归方程', () => {
    expect(linearCorrelation([1, 2, 3], [3, 5, 7])).toEqual({
      coefficient: 1,
      slope: 2,
      intercept: 1,
    });
  });

  it('数据为空、数量不等或无方差时不计算', () => {
    expect(linearCorrelation([], [])).toBeNull();
    expect(linearCorrelation([1, 2], [1])).toBeNull();
    expect(linearCorrelation([1, 1], [2, 3])).toBeNull();
  });
});
