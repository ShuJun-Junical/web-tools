import { describe, expect, it } from 'vitest';
import { calculateBazi, type BaziInput } from '@/lib/bazi';

const baseInput: BaziInput = {
  calendar: 'solar',
  year: 2005,
  month: 12,
  day: 23,
  hour: 8,
  minute: 37,
  leapMonth: false,
  gender: 'male',
  daySect: 2,
  yunSect: 1,
};

describe('生辰八字排盘', () => {
  it('排出四柱和固定衍生数据', () => {
    const result = calculateBazi(baseInput);
    expect(result.pillars.map((pillar) => pillar.gan + pillar.zhi)).toEqual([
      '乙酉',
      '戊子',
      '辛巳',
      '壬辰',
    ]);
    expect(result.pillars[2].ganShiShen).toBe('日主');
    expect(result.pillars[2].hiddenGan.map((item) => `${item.gan}${item.shiShen}`)).toEqual([
      '丙正官',
      '庚劫财',
      '戊正印',
    ]);
    expect(result.derived).toContainEqual({ label: '胎元', ganZhi: '己卯', naYin: '城头土' });
    expect(result.relations).toContain('年支酉与时支辰：六合');
    expect(result.yun.daYun).toHaveLength(8);
    expect(result.yun.daYun[0].years[0].months).toHaveLength(12);
  });

  it('输出关系中的干支文字', () => {
    const result = calculateBazi({
      ...baseInput,
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    });
    expect(result.pillars[3].gan).toBe('甲');
    expect(result.relations[1]).toBe('年干己与时干甲：天干五合');
  });

  it('在立春准确时刻前后切换年柱和月柱', () => {
    const before = calculateBazi({
      ...baseInput,
      year: 2024,
      month: 2,
      day: 4,
      hour: 16,
      minute: 26,
    });
    const after = calculateBazi({
      ...baseInput,
      year: 2024,
      month: 2,
      day: 4,
      hour: 16,
      minute: 28,
    });
    expect(before.pillars.slice(0, 2).map((pillar) => pillar.gan + pillar.zhi)).toEqual([
      '癸卯',
      '乙丑',
    ]);
    expect(after.pillars.slice(0, 2).map((pillar) => pillar.gan + pillar.zhi)).toEqual([
      '甲辰',
      '丙寅',
    ]);
  });

  it('支持两种晚子时换日口径', () => {
    const input = { ...baseInput, year: 1988, month: 2, day: 15, hour: 23, minute: 30 };
    expect(calculateBazi({ ...input, daySect: 2 }).pillars[2]).toMatchObject({
      gan: '庚',
      zhi: '子',
    });
    expect(calculateBazi({ ...input, daySect: 1 }).pillars[2]).toMatchObject({
      gan: '辛',
      zhi: '丑',
    });
  });

  it('公历和对应农历得到相同四柱', () => {
    const solar = calculateBazi({
      ...baseInput,
      year: 1986,
      month: 5,
      day: 29,
      hour: 0,
      minute: 0,
    });
    const lunar = calculateBazi({
      ...baseInput,
      calendar: 'lunar',
      year: 1986,
      month: 4,
      day: 21,
      hour: 0,
      minute: 0,
    });
    expect(lunar.solar).toBe('1986-05-29 00:00:00');
    expect(lunar.pillars).toEqual(solar.pillars);
  });

  it('拒绝空值、非法日期和不存在的闰月', () => {
    expect(() => calculateBazi({ ...baseInput, year: Number.NaN })).toThrow('整数');
    expect(() => calculateBazi({ ...baseInput, month: 2, day: 30 })).toThrow('公历日期无效');
    expect(() => calculateBazi({ ...baseInput, calendar: 'lunar', leapMonth: true })).toThrow(
      '农历日期无效'
    );
  });
});
