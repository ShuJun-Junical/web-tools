import { describe, expect, it } from 'vitest';
import { customTagConfig, dataTypesForGroup, fieldValidationError } from '@/lib/exif-custom';

describe('ExifTool 自定义字段配置', () => {
  it('为 EXIF 数字标识和 XMP 命名空间生成可写定义', () => {
    const exif = customTagConfig({ group: 'IFD0', identifier: '0xC5D9', dataType: 'int16u' });
    expect(exif.tag).toBe('IFD0:CustomC5D9');
    expect(exif.config).toContain("WriteGroup => 'IFD0'");
    const xmp = customTagConfig({
      group: 'XMP-demo',
      identifier: 'Note',
      dataType: 'string',
      namespaceUri: 'https://example.com/demo/',
    });
    expect(xmp.tag).toBe('XMP-demo:Note');
    expect(xmp.config).toContain('https://example.com/demo/');
  });

  it('空层级和代码注入样式的标识被拒绝', () => {
    expect(() => customTagConfig({ group: '', identifier: 'A', dataType: 'string' })).toThrow(
      '层级'
    );
    expect(() =>
      customTagConfig({ group: 'XMP-demo', identifier: "A';system('x')", dataType: 'string' })
    ).toThrow('字段标识');
  });

  it('拒绝含反斜杠或引号的命名空间 URI', () => {
    expect(() =>
      customTagConfig({
        group: 'XMP-demo',
        identifier: 'Note',
        dataType: 'string',
        namespaceUri: 'https://example.com/a\\',
      })
    ).toThrow('命名空间');
    expect(() =>
      customTagConfig({
        group: 'XMP-demo',
        identifier: 'Note',
        dataType: 'string',
        namespaceUri: "https://example.com/a'b",
      })
    ).toThrow('命名空间');
    expect(() =>
      customTagConfig({
        group: 'XMP-demo',
        identifier: 'Note',
        dataType: 'string',
        namespaceUri: 'https://example.com/a_b',
      })
    ).not.toThrow();
  });

  it('为界面提供类型集合与就地校验', () => {
    expect(dataTypesForGroup('IPTC')).toEqual(['string']);
    expect(dataTypesForGroup('GPS')).toContain('rational64s');
    expect(fieldValidationError('IFD0', 'Artist', 'string')).toBe('');
    expect(fieldValidationError('IFD0', '0x99999', 'string')).toContain('65535');
    expect(fieldValidationError('', 'A', 'string')).toContain('层级');
    expect(fieldValidationError('PNG', 'Note', 'string')).toBe('');
    expect(fieldValidationError('XMP-demo', 'Note', 'badtype')).toContain('XMP');
  });
});
