/**
 * ticketImageGenerator.test.ts
 *
 * 覆盖 SVG 模板这条路径上所有自有逻辑：占位符取值、模板填充、未知 key 的报错
 * 与纠错建议、证件号隐藏。
 *
 * 只测不依赖 DOM 的部分。Canvas 回退路径要 `document.createElement` + 真实绘制，
 * 收益低于维护成本，交互层由 `ticketParserPage.test.ts` 覆盖。
 */
import { describe, it, expect } from 'vitest';
import {
  TICKET_PLACEHOLDERS,
  TemplatePlaceholderError,
  collectPlaceholderKeys,
  fillSvgTemplate,
  placeholderValues,
  type PlaceholderKey,
} from '@/lib/ticket/imageGenerator';
import { toTicket, type TicketData } from '@/lib/ticket/types';

function makeTicket(overrides: Partial<TicketData> = {}) {
  const base = {
    TrainNumber: 'G1',
    DepartureStation: '北京南',
    DestinationStation: '上海虹桥',
    PhonicsOfDepartureStation: 'beijingnan',
    PhonicsOfDestinationStation: 'shanghaihongqiao',
    TravelDate: '2025-08-16',
    DepartureTime: '17:40',
    SeatLevel: '二等座',
    Carriage: '06车',
    Seat: '11A号',
    Name: '张三',
    IdNumber: '110101199001011234',
    Fare: 78,
    ElectronicInvoiceRailwayETicketNumber: '12345',
    TypeOfBusiness: '售',
  } as unknown as TicketData;
  return toTicket({ ...base, ...overrides });
}

// ------------------------------------------------------------------
// 占位符表
// ------------------------------------------------------------------

describe('TICKET_PLACEHOLDERS', () => {
  it('每个占位符都有中文说明', () => {
    for (const [key, def] of Object.entries(TICKET_PLACEHOLDERS)) {
      expect(def.label, `${key} 缺中文说明`).toBeTruthy();
    }
  });

  it('取值一律是 string，SVG 文本节点吃不了 null', () => {
    const values = placeholderValues(makeTicket());
    for (const key of Object.keys(TICKET_PLACEHOLDERS) as PlaceholderKey[]) {
      expect(typeof values[key], `${key} 不是 string`).toBe('string');
    }
  });
});

describe('placeholderValues', () => {
  it('按字段类型派生格式化值', () => {
    const v = placeholderValues(makeTicket());
    expect(v.travelDate).toBe('2025年08月16日');
    expect(v.travelDateRaw).toBe('2025-08-16');
    expect(v.travelYear).toBe('2025');
    expect(v.travelMonth).toBe('08');
    expect(v.travelDay).toBe('16');
    expect(v.fare).toBe('78.00');
    expect(v.fareWithSymbol).toBe('¥ 78.00');
  });

  it('seatInfo 把席别与席位拼起来', () => {
    expect(placeholderValues(makeTicket()).seatInfo).toBe('二等座 06车11A号');
  });

  it('常规售票不给【售】标签，退票才加', () => {
    expect(placeholderValues(makeTicket({ TypeOfBusiness: '售' })).businessTag).toBe('');
    expect(placeholderValues(makeTicket({ TypeOfBusiness: '退' })).businessTag).toBe('【退】');
  });

  it('缺字段时给空串而不是 null', () => {
    const v = placeholderValues(toTicket({ TravelDate: null } as TicketData));
    expect(v.travelDate).toBe('');
    expect(v.travelYear).toBe('');
    expect(v.fare).toBe('');
    expect(v.fareWithSymbol).toBe('');
  });

  it('hideIdNumber 时证件号为空串', () => {
    expect(placeholderValues(makeTicket(), { hideIdNumber: true }).idNumber).toBe('');
    expect(placeholderValues(makeTicket(), { hideIdNumber: false }).idNumber).toBe(
      '110101199001011234'
    );
  });
});

// ------------------------------------------------------------------
// fillSvgTemplate
// ------------------------------------------------------------------

describe('fillSvgTemplate', () => {
  it('替换所有占位符', () => {
    const svg = '<text>{{trainNumber}}</text><text>{{departureStation}}</text>';
    expect(fillSvgTemplate(svg, makeTicket())).toBe('<text>G1</text><text>北京南</text>');
  });

  it('花括号内允许空格', () => {
    expect(fillSvgTemplate('<text>{{ trainNumber }}</text>', makeTicket())).toBe('<text>G1</text>');
  });

  it('同一个占位符出现多次全部替换', () => {
    expect(fillSvgTemplate('{{seat}}{{seat}}', makeTicket())).toBe('11A号11A号');
  });

  it('模板里没有占位符时原样返回', () => {
    const svg = '<svg><text>静态内容</text></svg>';
    expect(fillSvgTemplate(svg, makeTicket())).toBe(svg);
  });

  it('未知占位符抛 TemplatePlaceholderError，不把花括号印到票面上', () => {
    // 这是最关键的一条：拼错 key 必须报错，绝不能静默印出 {{trainNubmer}}
    expect(() => fillSvgTemplate('<text>{{trainNubmer}}</text>', makeTicket())).toThrow(
      TemplatePlaceholderError
    );
  });

  it('错误信息带上最接近的正确写法', () => {
    let error: unknown;
    try {
      fillSvgTemplate('<text>{{trainNubmer}}</text>', makeTicket());
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(TemplatePlaceholderError);
    expect((error as TemplatePlaceholderError).unknownKeys).toEqual(['trainNubmer']);
    expect((error as TemplatePlaceholderError).suggestions.trainNubmer).toBe('trainNumber');
    expect((error as Error).message).toContain('{{trainNumber}}');
  });

  it('差得太远的 key 不乱猜', () => {
    let error: unknown;
    try {
      fillSvgTemplate('<text>{{zzzzzzzzzzzz}}</text>', makeTicket());
    } catch (e) {
      error = e;
    }
    expect((error as TemplatePlaceholderError).suggestions.zzzzzzzzzzzz).toBeUndefined();
  });

  it('多个未知 key 一次报全', () => {
    let error: unknown;
    try {
      fillSvgTemplate('{{trainNubmer}}{{seeetLevel}}', makeTicket());
    } catch (e) {
      error = e;
    }
    expect((error as TemplatePlaceholderError).unknownKeys).toEqual(['trainNubmer', 'seeetLevel']);
  });

  it('已知与未知混排时仍然报错', () => {
    expect(() => fillSvgTemplate('{{trainNumber}}{{nope}}', makeTicket())).toThrow(
      TemplatePlaceholderError
    );
  });
});

describe('collectPlaceholderKeys', () => {
  it('去重收集模板用到的 key', () => {
    expect(collectPlaceholderKeys('{{trainNumber}}{{trainNumber}}{{name}}').sort()).toEqual([
      'name',
      'trainNumber',
    ]);
  });

  it('接受空格写法', () => {
    expect(collectPlaceholderKeys('{{ fare }}')).toEqual(['fare']);
  });

  it('无占位符返回空数组', () => {
    expect(collectPlaceholderKeys('<svg/>')).toEqual([]);
  });
});
