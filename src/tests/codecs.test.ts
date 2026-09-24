import { describe, expect, it } from 'vitest';
import {
  decodeBase64,
  decodeUrl,
  encodeBase64,
  encodeUrl,
  imageDataUrlToBlob,
  looksLikeBase64,
  looksLikePunycode,
  looksLikeUrlEncoding,
  parseImageDataUrl,
} from '@/lib/codecs';

describe('Base64 文本转换', () => {
  it.each(['', 'hello', '你好', '工具🙂'])('往返转换 %j', (value) => {
    expect(decodeBase64(encodeBase64(value))).toBe(value);
  });

  it('拒绝非法 Base64 和非法 UTF-8', () => {
    expect(() => decodeBase64('%%%')).toThrow();
    expect(() => decodeBase64('/w==')).toThrow();
  });

  it('区分 Base64 形式和普通原文', () => {
    expect(looksLikeBase64('/w==')).toBe(true);
    expect(looksLikeBase64('普通原文')).toBe(false);
    expect(looksLikeBase64('hello')).toBe(true);
    expect(looksLikeBase64('a=b')).toBe(false);
  });
});

describe('URL 编解码', () => {
  it('往返转换 Unicode 和保留字符', () => {
    const value = '你好 /?a=1&b=🙂';
    expect(decodeUrl(encodeUrl(value))).toBe(value);
  });

  it('拒绝不完整的百分号序列', () => {
    expect(() => decodeUrl('%E4%A0')).toThrow();
  });

  it('区分 URL 编码形式和普通原文', () => {
    expect(looksLikeUrlEncoding('hello%20world')).toBe(true);
    expect(looksLikeUrlEncoding('%E4%A0')).toBe(true);
    expect(looksLikeUrlEncoding('100% complete')).toBe(false);
  });
});

describe('Punycode 形式识别', () => {
  it('识别域名和邮箱域名中的 xn-- 标签', () => {
    expect(looksLikePunycode('xn--fsqu00a.xn--0zwm56d')).toBe(true);
    expect(looksLikePunycode('user@xn--maana-pta.com')).toBe(true);
    expect(looksLikePunycode('example.com')).toBe(false);
  });
});

describe('图片 Data URL', () => {
  it('接受图片 Data URL 并生成 Blob', () => {
    const value = 'data:image/png;base64,aGVsbG8=';
    expect(parseImageDataUrl(value)?.mimeType).toBe('image/png');
    expect(imageDataUrlToBlob(value)?.type).toBe('image/png');
  });

  it('拒绝非图片和畸形数据', () => {
    expect(parseImageDataUrl('data:text/plain;base64,aGVsbG8=')).toBeNull();
    expect(parseImageDataUrl('data:image/png;base64,%%%')).toBeNull();
  });
});
