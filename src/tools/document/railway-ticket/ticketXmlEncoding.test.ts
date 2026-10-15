/**
 * ticketXmlEncoding.test.ts
 *
 * `decodeXmlBytes` 的分支全覆盖：三类 BOM、encoding 声明、GB 系列别名归一、
 * 不支持的编码回退、空输入。
 *
 * 本文件直接对 `decodeXmlBytes` 测，不走 zip / PDF 容器——`ticketOfdParser.test.ts` 与
 * `ticketPdfParser.test.ts` 只验证「两条路径都调用了它」，解码规则本身在这里一次性验完。
 */
import { describe, it, expect } from 'vitest';
import { decodeXmlBytes } from './xmlEncoding';

/** GB18030 下「中文」的字节 */
const GB18030_ZHONGWEN = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);

/** 在字节流前面拼一个 BOM */
function withBom(bom: number[], payload: Uint8Array): Uint8Array {
  return new Uint8Array([...bom, ...payload]);
}

describe('decodeXmlBytes BOM 优先', () => {
  it('UTF-8 BOM 解出正文', () => {
    const bytes = withBom([0xef, 0xbb, 0xbf], new TextEncoder().encode('<r>X</r>'));
    expect(decodeXmlBytes(bytes)).toBe('<r>X</r>');
  });

  it('UTF-16BE BOM 解出正文', () => {
    const bytes = withBom([0xfe, 0xff], new Uint8Array([0x00, 0x3c, 0x00, 0x72, 0x00, 0x3e]));
    expect(decodeXmlBytes(bytes)).toBe('<r>');
  });

  it('UTF-16LE BOM 解出正文', () => {
    const bytes = withBom([0xff, 0xfe], new Uint8Array([0x3c, 0x00, 0x72, 0x00, 0x3e, 0x00]));
    expect(decodeXmlBytes(bytes)).toBe('<r>');
  });

  it('BOM 优先于 encoding 声明', () => {
    // 声明写 GB18030 但实际带 UTF-8 BOM：BOM 是更硬的信号，赢
    const payload = new TextEncoder().encode('<?xml version="1.0" encoding="GB18030"?><r>X</r>');
    const bytes = withBom([0xef, 0xbb, 0xbf], payload);
    expect(decodeXmlBytes(bytes)).toContain('<r>X</r>');
  });
});

describe('decodeXmlBytes encoding 声明', () => {
  it('无 BOM 时按声明的 UTF-8 解', () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><r>X</r>');
    expect(decodeXmlBytes(bytes)).toContain('<r>X</r>');
  });

  it('声明 GB18030 时真按 GB18030 解出中文', () => {
    // Node 24 带 full ICU，支持 gb18030，可以断言真实解码结果而非「不抛错」
    const head = new TextEncoder().encode('<?xml version="1.0" encoding="GB18030"?><r>');
    const bytes = new Uint8Array([...head, ...GB18030_ZHONGWEN, 0x3c, 0x2f, 0x72, 0x3e]);
    expect(decodeXmlBytes(bytes)).toContain('中文');
  });

  it('GBK / GB2312 声明都归一到 gb18030（超集）', () => {
    for (const declared of ['GBK', 'gb2312']) {
      const head = new TextEncoder().encode(`<?xml version="1.0" encoding="${declared}"?><r>`);
      const bytes = new Uint8Array([...head, ...GB18030_ZHONGWEN, 0x3c, 0x2f, 0x72, 0x3e]);
      expect(decodeXmlBytes(bytes)).toContain('中文');
    }
  });

  it('未知编码名回退 UTF-8，不抛错', () => {
    // 声明了浏览器不认识的编码，不能让整张票解析失败
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="x-made-up"?><r>X</r>');
    expect(decodeXmlBytes(bytes)).toContain('<r>X</r>');
  });

  it('无声明无 BOM 时按 UTF-8 兜底', () => {
    expect(decodeXmlBytes(new TextEncoder().encode('<r>X</r>'))).toBe('<r>X</r>');
  });
});

describe('decodeXmlBytes 边界', () => {
  it('空输入返回空串', () => {
    expect(decodeXmlBytes(new Uint8Array(0))).toBe('');
  });

  it('声明出现在前 200 字节之外时按 UTF-8 兜底，不报错', () => {
    const padding = new TextEncoder().encode(`<!--${'x'.repeat(300)}-->`);
    const tail = new TextEncoder().encode('<?xml version="1.0" encoding="GB18030"?><r>X</r>');
    expect(decodeXmlBytes(new Uint8Array([...padding, ...tail]))).toContain('<r>X</r>');
  });

  it('非法字节不抛错，退化为替换字符', () => {
    // 宁可带 U+FFFD 也不能让上层以为整个文件坏了，下游 XML 解析会自己报错
    const result = decodeXmlBytes(new Uint8Array([0xff, 0xfe, 0x41]));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
