/**
 * ticketTypes.test.ts
 *
 * 覆盖 `types.ts` 里所有非平凡纯逻辑：字段类型转换、发车时刻构造、格式化、
 * 掩码、领域层派生与排序、字段行生成。
 *
 * 发车时刻的用例刻意覆盖注释里点名的三个坑：`new Date('2025-08-16')` 被当成
 * UTC 午夜、`new Date(y,m,d,h)` 走浏览器本地时区、2025-02-30 静默进位。
 */
import { describe, it, expect } from 'vitest';
import {
  TICKET_FIELDS,
  byDepartureAt,
  coerceTicketValue,
  departureWeekday,
  formatDate,
  formatDepartureAt,
  formatMoney,
  formatPercent,
  getDepartureAt,
  text,
  ticketFieldRows,
  toTicket,
  type Ticket,
  type TicketData,
} from '@/lib/ticket/types';

/** 造一张只填了部分字段的 TicketData，其余字段按「全 null」铺满 */
function makeData(overrides: Partial<TicketData> = {}): TicketData {
  const base: Record<string, unknown> = {};
  for (const name of Object.keys(TICKET_FIELDS)) base[name] = null;
  return { ...base, ...overrides } as unknown as TicketData;
}

// ------------------------------------------------------------------
// coerceTicketValue
// ------------------------------------------------------------------

describe('coerceTicketValue', () => {
  it('标识类字段保持字符串，前导零不丢', () => {
    expect(coerceTicketValue('TrainNumber', '0107')).toBe('0107');
    expect(coerceTicketValue('ETicketNumber', '2'.repeat(25))).toBe('2'.repeat(25));
  });

  it('money / percent 转 number', () => {
    expect(coerceTicketValue('Fare', '78.00')).toBe(78);
    expect(coerceTicketValue('TaxRate', '0.09')).toBe(0.09);
  });

  it('空串与非数字金额 → null，不当 0', () => {
    // Number('') === 0，当成 0 会让票价显示成 ¥0.00 误导用户
    expect(coerceTicketValue('Fare', '')).toBeNull();
    expect(coerceTicketValue('Fare', '   ')).toBeNull();
    expect(coerceTicketValue('Fare', 'abc')).toBeNull();
  });

  it('标识类字段即使内容是 true/false 也保持字符串', () => {
    // DiscountMark 登记为 string，走 string 分支，不能被转成布尔或数字化
    expect(coerceTicketValue('DiscountMark', 'TRUE')).toBe('TRUE');
    expect(coerceTicketValue('DiscountMark', '123')).toBe('123');
  });

  it('raw 为 null 时一律返回 null', () => {
    expect(coerceTicketValue('Fare', null)).toBeNull();
    expect(coerceTicketValue('TrainNumber', null)).toBeNull();
  });

  it('未登记字段按 string 原样返回，不丢数据', () => {
    expect(coerceTicketValue('SomeFutureField', '123')).toBe('123');
  });
});

// ------------------------------------------------------------------
// 格式化
// ------------------------------------------------------------------

describe('格式化', () => {
  it('text 把 null / undefined 归一成空串', () => {
    expect(text(null)).toBe('');
    expect(text(undefined)).toBe('');
    expect(text('G1')).toBe('G1');
  });

  it('formatMoney 两位小数，null → 空串', () => {
    expect(formatMoney(78)).toBe('78.00');
    expect(formatMoney(123.456)).toBe('123.46');
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
  });

  it('formatPercent 0.09 → 9%，避免浮点尾巴', () => {
    expect(formatPercent(0.09)).toBe('9%');
    expect(formatPercent(0.06)).toBe('6%');
    expect(formatPercent(0.13)).toBe('13%');
    expect(formatPercent(null)).toBe('');
  });

  it('formatDate 标准格式转中文，非标准格式原样返回', () => {
    expect(formatDate('2025-08-16')).toBe('2025年08月16日');
    // 带两个连字符但不是日期的脏值不能被当成 3 段拼成「not年a月date日」
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDate('2025-8-16')).toBe('2025-8-16');
    expect(formatDate(null)).toBe('');
  });
});

// ------------------------------------------------------------------
// getDepartureAt
// ------------------------------------------------------------------

describe('getDepartureAt', () => {
  it('按北京时间 UTC+8 构造绝对时刻', () => {
    const at = getDepartureAt({ TravelDate: '2025-08-16', DepartureTime: '17:40' } as TicketData);
    // 2025-08-16T09:40:00Z == 北京时间 17:40
    expect(at?.toISOString()).toBe('2025-08-16T09:40:00.000Z');
  });

  it('不受浏览器本地时区影响（与 new Date(string) 的 UTC 午夜陷阱相反）', () => {
    const at = getDepartureAt({ TravelDate: '2025-08-16', DepartureTime: '00:00' } as TicketData);
    // 若是 new Date('2025-08-16') 那种 UTC 午夜，结果会是 08-16T00:00Z（北京 08:00），偏 8 小时
    expect(at?.toISOString()).toBe('2025-08-15T16:00:00.000Z');
  });

  it('H:mm 与 HH:mm 都接受', () => {
    const h = getDepartureAt({ TravelDate: '2025-08-16', DepartureTime: '9:05' } as TicketData);
    const hh = getDepartureAt({ TravelDate: '2025-08-16', DepartureTime: '09:05' } as TicketData);
    expect(h?.getTime()).toBe(hh?.getTime());
  });

  it('不存在的日期被拒绝，不静默进位', () => {
    // Date.UTC(2025, 1, 30) 会进位到 3-02，必须回检
    expect(
      getDepartureAt({ TravelDate: '2025-02-30', DepartureTime: '10:00' } as TicketData)
    ).toBeNull();
    expect(
      getDepartureAt({ TravelDate: '2025-13-01', DepartureTime: '10:00' } as TicketData)
    ).toBeNull();
  });

  it('时间越界或格式非法返回 null', () => {
    const base = { TravelDate: '2025-08-16' } as TicketData;
    expect(getDepartureAt({ ...base, DepartureTime: '25:00' })).toBeNull();
    expect(getDepartureAt({ ...base, DepartureTime: '10:70' })).toBeNull();
    expect(getDepartureAt({ ...base, DepartureTime: '10点' })).toBeNull();
    expect(getDepartureAt({ ...base, DepartureTime: '' })).toBeNull();
  });

  it('日期或时间缺失返回 null', () => {
    expect(getDepartureAt({ DepartureTime: '10:00' } as TicketData)).toBeNull();
    expect(getDepartureAt({ TravelDate: '2025-08-16' } as TicketData)).toBeNull();
  });

  it('闰年 2-29 有效，平年 2-29 无效', () => {
    expect(
      getDepartureAt({ TravelDate: '2024-02-29', DepartureTime: '10:00' } as TicketData)
    ).not.toBeNull();
    expect(
      getDepartureAt({ TravelDate: '2025-02-29', DepartureTime: '10:00' } as TicketData)
    ).toBeNull();
  });
});

describe('formatDepartureAt / departureWeekday', () => {
  it('按北京时间展示，不随浏览器时区漂移', () => {
    const at = getDepartureAt({ TravelDate: '2025-08-16', DepartureTime: '17:40' } as TicketData);
    expect(formatDepartureAt(at)).toContain('2025');
    expect(formatDepartureAt(at)).toContain('17:40');
  });

  it('null 输入返回空串', () => {
    expect(formatDepartureAt(null)).toBe('');
    expect(departureWeekday(null)).toBe('');
  });

  it('2025-08-16 是周六', () => {
    const at = getDepartureAt({ TravelDate: '2025-08-16', DepartureTime: '17:40' } as TicketData);
    expect(departureWeekday(at)).toBe('周六');
  });
});

// ------------------------------------------------------------------
// 领域层
// ------------------------------------------------------------------

describe('toTicket', () => {
  it('开票方两套字段合并，取第一个非空', () => {
    const fromIssueParty = toTicket(
      makeData({
        IssueParty: 'A',
        NameOfSeller: 'B',
        IssuePartyCode: 'C',
        UnifiedSocialCreditCodeOfSeller: 'D',
      })
    );
    expect(fromIssueParty.issuerName).toBe('A');
    expect(fromIssueParty.issuerTaxId).toBe('C');

    const fromSeller = toTicket(
      makeData({ NameOfSeller: 'B', UnifiedSocialCreditCodeOfSeller: 'D' })
    );
    expect(fromSeller.issuerName).toBe('B');
    expect(fromSeller.issuerTaxId).toBe('D');
  });

  it('两套字段都为空时为 null 而不是空串', () => {
    const ticket = toTicket(makeData());
    expect(ticket.issuerName).toBeNull();
    expect(ticket.issuerTaxId).toBeNull();
  });

  it('派生 departureAt，逻辑用 Date 展示用原文', () => {
    const ticket = toTicket(makeData({ TravelDate: '2025-08-16', DepartureTime: '17:40' }));
    expect(ticket.departureTime).toBe('17:40');
    expect(ticket.departureAt?.toISOString()).toBe('2025-08-16T09:40:00.000Z');
  });

  it('Fare 映射到 amount，退票票语义一致', () => {
    expect(toTicket(makeData({ Fare: 78, AmountRefunded: 5 })).amount).toBe(78);
    expect(toTicket(makeData({ Fare: 78 })).refundedAmount).toBeNull();
  });
});

describe('byDepartureAt', () => {
  const withAt = (iso: string): Ticket => ({ departureAt: new Date(iso) }) as Ticket;
  const withoutAt = { departureAt: null } as Ticket;

  it('按时刻升序', () => {
    expect([withAt('2025-08-16T10:00Z'), withAt('2025-08-16T08:00Z')].sort(byDepartureAt)).toEqual([
      withAt('2025-08-16T08:00Z'),
      withAt('2025-08-16T10:00Z'),
    ]);
  });

  it('无发车时刻的排最后', () => {
    expect([withoutAt, withAt('2025-08-16T08:00Z')].sort(byDepartureAt)).toEqual([
      withAt('2025-08-16T08:00Z'),
      withoutAt,
    ]);
  });

  it('两人都无时刻时返回 0，不抖动', () => {
    expect(byDepartureAt(withoutAt, { departureAt: null } as Ticket)).toBe(0);
  });
});

// ------------------------------------------------------------------
// 规格表与转换的一致性
// ------------------------------------------------------------------

describe('TICKET_FIELDS 与 coerceTicketValue 的一致性', () => {
  it('标 money / percent 的字段，数字串必须转成 number', () => {
    // 规格标错类型是最容易犯也最难发现的错：解析能跑通，只是界面上金额变成裸字符串
    const numeric = Object.entries(TICKET_FIELDS).filter(
      ([, meta]) => meta.type === 'money' || meta.type === 'percent'
    );
    expect(numeric.length).toBeGreaterThan(0);
    for (const [name, meta] of numeric) {
      expect(typeof coerceTicketValue(name, '123.45'), `${name} 标成 ${meta.type}`).toBe('number');
    }
  });

  it('标 string / date 的字段，数字串必须保持字符串', () => {
    // 这条是「前导零 / 超长票号」不被破坏的兜底断言：一旦有人把车次、票号
    // 误标成 money，这里会先炸，而不是等用户看到 107。
    const textual = Object.entries(TICKET_FIELDS).filter(
      ([, meta]) => meta.type === 'string' || meta.type === 'date'
    );
    expect(textual.length).toBeGreaterThan(0);
    for (const [name, meta] of textual) {
      expect(typeof coerceTicketValue(name, '0107'), `${name} 标成 ${meta.type}`).toBe('string');
    }
  });

  it('每个字段都有中文标签', () => {
    for (const [name, meta] of Object.entries(TICKET_FIELDS)) {
      expect(meta.label, `${name} 缺中文标签`).toBeTruthy();
    }
  });
});

// ------------------------------------------------------------------
// ticketFieldRows
// ------------------------------------------------------------------

describe('ticketFieldRows', () => {
  it('跳过空值字段', () => {
    const rows = ticketFieldRows(makeData({ TrainNumber: 'G1' }));
    expect(rows).toEqual([{ name: 'TrainNumber', label: '车次', value: 'G1', hidden: false }]);
  });

  it('默认排除 display: hidden 字段', () => {
    const rows = ticketFieldRows(makeData({ TaxAmount: 5, Fare: 78 }));
    expect(rows.map((r) => r.name)).toEqual(['Fare']);
  });

  it('includeHidden 时带出税额等字段并标记 hidden', () => {
    const rows = ticketFieldRows(makeData({ TaxAmount: 5 }), { includeHidden: true });
    const taxRow = rows.find((r) => r.name === 'TaxAmount');
    expect(taxRow?.value).toBe('5.00');
    expect(taxRow?.hidden).toBe(true);
  });

  it('按字段类型格式化：金额两位小数、百分比带 %', () => {
    const rows = ticketFieldRows(makeData({ Fare: 78, TaxRate: 0.09 }), { includeHidden: true });
    expect(rows.find((r) => r.name === 'Fare')?.value).toBe('78.00');
    expect(rows.find((r) => r.name === 'TaxRate')?.value).toBe('9%');
  });

  it('金额为 0 时不是空串，要显示 0.00', () => {
    // 0 是有效值，被 `value === ''` 过滤掉会丢信息
    const rows = ticketFieldRows(makeData({ Fare: 0 }));
    expect(rows.find((r) => r.name === 'Fare')?.value).toBe('0.00');
  });

  it('顺序跟随 TICKET_FIELDS 书写顺序', () => {
    const rows = ticketFieldRows(makeData({ Fare: 1, TrainNumber: 'G1', Name: '张三' }));
    expect(rows.map((r) => r.name)).toEqual(['TrainNumber', 'Fare', 'Name']);
  });

  it('全空数据返回空数组', () => {
    expect(ticketFieldRows(makeData())).toEqual([]);
  });
});
