import { describe, expect, it } from 'vitest';
import {
  convertUnicodeStyle,
  listUnicodeStyles,
  normalizeUnicodeStyle,
} from '@/lib/unicode-english-converter';

describe('Unicode 英文字体转换', () => {
  it('转换空输入、字母和数字', () => {
    expect(convertUnicodeStyle('', 'bold')).toBe('');
    expect(convertUnicodeStyle('Ab 09', 'bold')).toBe('𝐀𝐛 𝟎𝟗');
    expect(convertUnicodeStyle('Ab 09', 'italic')).toBe('𝐴𝑏 09');
  });

  it('处理特殊码点、全角空格并还原样式', () => {
    const styled = convertUnicodeStyle('Hello 20', 'script');
    expect(styled).toBe('ℋℯ𝓁𝓁ℴ 20');
    expect(convertUnicodeStyle('A 1', 'fullwidth', { fullwidthSpace: true })).toBe('Ａ　１');
    expect(normalizeUnicodeStyle(styled)).toBe('Hello 20');
  });

  it('列出全部 17 种样式', () => {
    expect(listUnicodeStyles()).toHaveLength(17);
  });
});
