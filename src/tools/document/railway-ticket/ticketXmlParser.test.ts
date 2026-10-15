/**
 * ticketXmlParser.test.ts
 *
 * 单元测试 XBRL XML → TicketData 映射，覆盖 xmlParser.ts 顶部注释的硬规则：
 * 标识类字段保持 string、xsi:nil 节点 = null、xbrl / xbrli:xbrl 两种根都识别、
 * 架构外元素进 extra、金额 / 税率按 TICKET_FIELDS 的 type 数字化。
 */
import { describe, it, expect } from 'vitest';
import { parseXBRL } from './xmlParser';

const wrap = (inner: string, rootTag = 'xbrl') =>
  `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="http://www.xbrl.org/2003/instance"
            xmlns:rai="http://xbrl.mof.gov.cn/taxonomy/2021-11-30/rai"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <context id="C"><entity><identifier scheme="x">x</identifier></entity></context>
  <unit id="CNY"><measure>iso4217:CNY</measure></unit>
  ${inner}
</${rootTag}>`;

describe('parseXBRL 标识类字段', () => {
  it('TrainNumber 保持 string，前导零不丢', () => {
    // 0107 是管内临客车次，number 化会变成 107 → 整张票认不出
    const { ticket } = parseXBRL(wrap('<rai:TrainNumber>0107</rai:TrainNumber>'));
    expect(ticket.TrainNumber).toBe('0107');
  });

  it('25 位电子客票号保持 string，不被截断', () => {
    // JS number 最大安全整数 16 位，25 位直接被截
    const long = '2'.repeat(25);
    const { ticket } = parseXBRL(wrap(`<rai:ETicketNumber>${long}</rai:ETicketNumber>`));
    expect(ticket.ETicketNumber).toBe(long);
    expect(typeof ticket.ETicketNumber).toBe('string');
  });
});

describe('parseXBRL 数值字段', () => {
  it('Fare / TotalAmountExcludingTax / TaxAmount 按 money 转 number', () => {
    const { ticket } = parseXBRL(
      wrap(
        '<rai:Fare contextRef="C" unitRef="CNY" decimals="2">78.00</rai:Fare>' +
          '<rai:TotalAmountExcludingTax contextRef="C" unitRef="CNY" decimals="2">73.00</rai:TotalAmountExcludingTax>' +
          '<rai:TaxAmount contextRef="C" unitRef="CNY" decimals="2">5.00</rai:TaxAmount>'
      )
    );
    expect(ticket.Fare).toBe(78);
    expect(ticket.TotalAmountExcludingTax).toBe(73);
    expect(ticket.TaxAmount).toBe(5);
  });

  it('TaxRate 按 percent 转 number', () => {
    const { ticket } = parseXBRL(wrap('<rai:TaxRate>0.09</rai:TaxRate>'));
    expect(ticket.TaxRate).toBe(0.09);
  });

  it('空串 / 非数字金额 → null，不当 0 处理', () => {
    // Number('') === 0，会让空 Fare 变 ¥0.00 误导用户
    const { ticket } = parseXBRL(wrap('<rai:Fare></rai:Fare>'));
    expect(ticket.Fare).toBeNull();
  });
});

describe('parseXBRL xsi:nil', () => {
  it('xsi:nil="true" 节点 → null', () => {
    const { ticket } = parseXBRL(wrap('<rai:IssuePartyCode xsi:nil="true"/>'));
    expect(ticket.IssuePartyCode).toBeNull();
  });

  it('xsi:nil 与非 nil 共存：按各自处理', () => {
    const { ticket } = parseXBRL(
      wrap('<rai:IssuePartyCode xsi:nil="true"/>' + '<rai:IssueParty>filled</rai:IssueParty>')
    );
    expect(ticket.IssuePartyCode).toBeNull();
    expect(ticket.IssueParty).toBe('filled');
  });
});

describe('parseXBRL 根元素兼容', () => {
  it('2021-11-30 架构：根是 <xbrl>', () => {
    const { ticket } = parseXBRL(wrap('<rai:TrainNumber>G1</rai:TrainNumber>', 'xbrl'));
    expect(ticket.TrainNumber).toBe('G1');
  });

  it('2023-12-31 架构：根是 <xbrli:xbrl>', () => {
    const { ticket } = parseXBRL(
      `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
             xmlns:rai="http://xbrl.mof.gov.cn/taxonomy/2023-12-31/rai"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <xbrli:context id="C"><xbrli:entity><xbrli:identifier scheme="x">x</xbrli:identifier></xbrli:entity></xbrli:context>
  <xbrli:unit id="CNY"><xbrli:measure>iso4217:CNY</xbrli:measure></xbrli:unit>
  <rai:TrainNumber>G2</rai:TrainNumber>
</xbrli:xbrl>`
    );
    expect(ticket.TrainNumber).toBe('G2');
  });
});

describe('parseXBRL 架构外元素', () => {
  it('TICKET_FIELDS 之外的元素进 extra', () => {
    const { ticket, extra } = parseXBRL(
      wrap('<rai:TrainNumber>G3</rai:TrainNumber><rai:FutureField>foo</rai:FutureField>')
    );
    expect(ticket.TrainNumber).toBe('G3');
    expect(extra.FutureField).toBe('foo');
  });

  it('context / unit / schemaRef 等非数据元素不出现在 result', () => {
    const { ticket, extra } = parseXBRL(wrap('<rai:TrainNumber>G4</rai:TrainNumber>'));
    expect('context' in ticket).toBe(false);
    expect('context' in extra).toBe(false);
    expect('unit' in extra).toBe(false);
  });
});
