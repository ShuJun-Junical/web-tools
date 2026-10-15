/// <reference types="node" />
/**
 * ticketOfdParser.test.ts
 *
 * 端到端 + 编码兜底。fixture 由 `scripts/build-ofd-fixture.mjs` 用 fflate zipSync
 * 合成，按 OFD 1.1 GB/T 33190-2017 规范围起来：OFD.xml 声明 DocRoot，
 * Attachments.xml 列附件 FileLoc。
 *
 * 这里只验「OFD 容器这层解得对不对」；解码策略本身的分支覆盖见
 * `ticketXmlEncoding.test.ts`，XML → TicketData 的映射见 `ticketXmlParser.test.ts`。
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { extractXmlFromOFDBytes } from '@/lib/ticket/ofdParser';
import { parseXBRL } from '@/lib/ticket/xmlParser';

// fixture 是合成数据，只供测试用；由 scripts/build-ofd-fixture.mjs 生成
const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '__fixtures__', 'synthetic-ticket.ofd');

describe('extractXmlFromOFDBytes', () => {
  it('从合成 fixture OFD 拿到 rai_issuer_*.xml 附件', async () => {
    const bytes = await readFile(fixturePath);
    const result = await extractXmlFromOFDBytes(bytes);

    expect(result.fileName).toBe('rai_issuer_2099-12-31_synthetic-99.xml');
    expect(result.xmlContent).toContain('<?xml version="1.0" encoding="UTF-8"');
    expect(result.xmlContent).toContain('<rai:TrainNumber>G0001</rai:TrainNumber>');
    expect(result.xmlContent.length).toBeGreaterThan(1000);
  });

  it('端到端：附件 XML 喂给 parseXBRL 后字段正确填充', async () => {
    const bytes = await readFile(fixturePath);
    const { xmlContent } = await extractXmlFromOFDBytes(bytes);
    const { ticket, extra } = parseXBRL(xmlContent);

    expect(ticket.TrainNumber).toBe('G0001');
    expect(ticket.Fare).toBe(123.45);
    expect(ticket.DateOfIssue).toBe('2099-12-31');
    expect(ticket.DepartureStation).toBe('StationA');
    expect(ticket.DestinationStation).toBe('StationB');
    expect(ticket.IssuePartyCode).toBeNull();
    expect(ticket.ETicketNumber).toBeNull();
    expect(extra.UnknownField).toBe('extra-field-test');
  });
});

describe('extractXmlFromOFDBytes 规范路径兼容', () => {
  it('附件 FileLoc 路径里嵌 docDir（如 Doc_0/Attachs/）也能命中', async () => {
    // 测试 Documents 路径 Doc_1 时仍能正确拼接：FileLoc 是相对 Doc_1/ 的
    const ofdXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_1/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`;
    const attXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Attachments xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Attachment ID="1" Name="rai_issuer_2099-12-31_synthetic-99" Format="xml">
    <ofd:FileLoc>Doc_1/Attachs/rai_issuer_2099-12-31_synthetic-99.xml</ofd:FileLoc>
  </ofd:Attachment>
</ofd:Attachments>`;
    const innerXml = '<?xml version="1.0" encoding="UTF-8"?><root><train>X1</train></root>';
    const ofd = zipSync({
      'OFD.xml': strToU8(ofdXml),
      'Doc_1/Attachs/Attachments.xml': strToU8(attXml),
      'Doc_1/Attachs/rai_issuer_2099-12-31_synthetic-99.xml': strToU8(innerXml),
    });
    const result = await extractXmlFromOFDBytes(new Uint8Array(ofd));
    expect(result.fileName).toBe('rai_issuer_2099-12-31_synthetic-99.xml');
    expect(result.xmlContent).toContain('<train>X1</train>');
  });

  it('没 Attachments.xml 时回退扫 docDir/Attachs/ 下所有 rai_issuer_*.xml', async () => {
    // 老版本 OFD 不一定有 Attachments.xml，解析层得能兜底
    const ofdXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`;
    const innerXml = '<?xml version="1.0" encoding="UTF-8"?><root><train>F2</train></root>';
    const ofd = zipSync({
      'OFD.xml': strToU8(ofdXml),
      'Doc_0/Attachs/rai_issuer_2099-12-31_synthetic-99.xml': strToU8(innerXml),
    });
    const result = await extractXmlFromOFDBytes(new Uint8Array(ofd));
    expect(result.fileName).toBe('rai_issuer_2099-12-31_synthetic-99.xml');
    expect(result.xmlContent).toContain('<train>F2</train>');
  });

  it('缺 OFD.xml 应抛错', async () => {
    const ofd = zipSync({
      'Doc_0/Attachs/rai_issuer_x.xml': strToU8('<root/>'),
    });
    await expect(extractXmlFromOFDBytes(new Uint8Array(ofd))).rejects.toThrow(/缺少 OFD\.xml/);
  });

  it('OFD.xml 缺 DocRoot 应抛错', async () => {
    const ofd = zipSync({
      'OFD.xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"></ofd:OFD>'
      ),
    });
    await expect(extractXmlFromOFDBytes(new Uint8Array(ofd))).rejects.toThrow(/缺少 DocRoot/);
  });

  it('没 rai_issuer_ 附件应抛错', async () => {
    const ofdXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`;
    const attXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Attachments xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Attachment ID="1" Name="other" Format="xml">
    <ofd:FileLoc>Doc_0/Attachs/other.xml</ofd:FileLoc>
  </ofd:Attachment>
</ofd:Attachments>`;
    const ofd = zipSync({
      'OFD.xml': strToU8(ofdXml),
      'Doc_0/Attachs/Attachments.xml': strToU8(attXml),
      'Doc_0/Attachs/other.xml': strToU8('<root/>'),
    });
    await expect(extractXmlFromOFDBytes(new Uint8Array(ofd))).rejects.toThrow(/rai_issuer_/);
  });
});

describe('extractXmlFromOFDBytes 编码兜底', () => {
  it('附件内容是 UTF-16BE BOM 字节也能解', async () => {
    // UTF-16BE BOM (FE FF) + UTF-16BE 字符串 "<r>X</r>"
    const payload = new Uint8Array([
      0xfe, 0xff, 0x00, 0x3c, 0x00, 0x72, 0x00, 0x3e, 0x00, 0x58, 0x00, 0x3c, 0x00, 0x2f, 0x00,
      0x72, 0x00, 0x3e,
    ]);
    const ofdXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`;
    const attXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Attachments xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Attachment ID="1" Name="rai_issuer_2099-12-31_synthetic-99" Format="xml">
    <ofd:FileLoc>Doc_0/Attachs/rai_issuer_2099-12-31_synthetic-99.xml</ofd:FileLoc>
  </ofd:Attachment>
</ofd:Attachments>`;
    const ofd = zipSync({
      'OFD.xml': strToU8(ofdXml),
      'Doc_0/Attachs/Attachments.xml': strToU8(attXml),
      'Doc_0/Attachs/rai_issuer_2099-12-31_synthetic-99.xml': payload,
    });
    const result = await extractXmlFromOFDBytes(new Uint8Array(ofd));
    expect(result.xmlContent).toBe('<r>X</r>');
  });

  it('附件声明 encoding="GB18030" 时解析不抛错', async () => {
    // Node 24 没有 GB18030 解码器，这里只验证不抛错；
    // GB18030 真实解码正确性靠浏览器 / Playwright 验证
    const xmlUtf8 = '<?xml version="1.0" encoding="GB18030"?><r>X</r>';
    const ofdXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`;
    const attXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Attachments xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Attachment ID="1" Name="rai_issuer_2099-12-31_synthetic-99" Format="xml">
    <ofd:FileLoc>Doc_0/Attachs/rai_issuer_2099-12-31_synthetic-99.xml</ofd:FileLoc>
  </ofd:Attachment>
</ofd:Attachments>`;
    const ofd = zipSync({
      'OFD.xml': strToU8(ofdXml),
      'Doc_0/Attachs/Attachments.xml': strToU8(attXml),
      'Doc_0/Attachs/rai_issuer_2099-12-31_synthetic-99.xml': strToU8(xmlUtf8),
    });
    // 不抛错即通过——Node 24 TextDecoder 不支持 gb18030 时，try-catch 兜底
    await expect(extractXmlFromOFDBytes(new Uint8Array(ofd))).resolves.toBeDefined();
  });
});
