import { describe, expect, it } from 'vitest';
import { addMetadataBlock, bytesToHex, clearImageMetadata, editMetadataBlock, hexByteCount, hexValidationError, inspectImage, isSupportedImageFile, newBlockValidationError, sameImageData } from '@/lib/image-container';

const pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const encoder = new TextEncoder();

function join(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function pngChunk(kind: string, payload: number[] = []) {
  const chunk = new Uint8Array(payload.length + 12);
  new DataView(chunk.buffer).setUint32(0, payload.length);
  chunk.set(encoder.encode(kind), 4);
  chunk.set(payload, 8);
  return chunk;
}

function webpChunk(kind: string, payload: number[] = []) {
  const chunk = new Uint8Array(8 + payload.length + (payload.length & 1));
  chunk.set(encoder.encode(kind), 0);
  new DataView(chunk.buffer).setUint32(4, payload.length, true);
  chunk.set(payload, 8);
  return chunk;
}

function webp(...chunks: Uint8Array[]) {
  const body = join(encoder.encode('WEBP'), ...chunks);
  const header = new Uint8Array(8);
  header.set(encoder.encode('RIFF'));
  new DataView(header.buffer).setUint32(4, body.length, true);
  return join(header, body);
}

describe('图片容器清理', () => {
  it('PNG 与 APNG 保留图像及动画块，普通清理保留色彩和未知块', () => {
    const source = join(pngSignature,
      pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
      pngChunk('iCCP', [1]), pngChunk('eXIf', [2]), pngChunk('zZzz', [3]),
      pngChunk('acTL', [0]), pngChunk('fcTL', [0]), pngChunk('IDAT', [4]),
      pngChunk('fdAT', [0, 0, 0, 1, 5]), pngChunk('IEND'));
    const normal = clearImageMetadata(source, 'normal');
    const strong = clearImageMetadata(source, 'strong');
    expect(inspectImage(source).animated).toBe(true);
    expect(inspectImage(normal).blocks.map(block => block.kind)).toContain('iCCP');
    expect(inspectImage(normal).blocks.map(block => block.kind)).toContain('zZzz');
    expect(inspectImage(normal).blocks.map(block => block.kind)).not.toContain('eXIf');
    expect(inspectImage(strong).blocks.map(block => block.kind)).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'fdAT', 'IEND']);
    expect(sameImageData(source, normal)).toBe(true);
    expect(sameImageData(source, strong)).toBe(true);
  });

  it('动画 WebP 清理 EXIF/ICC/未知块，并更新 VP8X 标志', () => {
    const source = webp(webpChunk('VP8X', [0x2e, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      webpChunk('ICCP', [1]), webpChunk('ANIM', [0, 0, 0, 0, 0, 0]),
      webpChunk('ANMF', [1, 2, 3]), webpChunk('EXIF', [4]), webpChunk('ZZZZ', [5]));
    const normal = clearImageMetadata(source, 'normal');
    const strong = clearImageMetadata(source, 'strong');
    expect(inspectImage(source).animated).toBe(true);
    expect(inspectImage(normal).blocks.map(block => block.kind)).toContain('ICCP');
    expect(inspectImage(normal).blocks.map(block => block.kind)).toContain('ZZZZ');
    expect(inspectImage(normal).blocks.map(block => block.kind)).not.toContain('EXIF');
    expect(inspectImage(strong).blocks.map(block => block.kind)).toEqual(['VP8X', 'ANIM', 'ANMF']);
    expect(strong[20] & (0x20 | 0x08 | 0x04)).toBe(0);
    expect(sameImageData(source, strong)).toBe(true);
  });

  it('JPEG 保留压缩数据，普通清理保留 ICC 和方向，强力清理移除 APP 区段', () => {
    const source = join(Uint8Array.of(
      0xff, 0xd8,
      0xff, 0xe1, 0, 4, 1, 2,
    ), Uint8Array.of(0xff, 0xe2, 0, 14), encoder.encode('ICC_PROFILE\0'), Uint8Array.of(
      0xff, 0xee, 0, 7, 65, 100, 111, 98, 101,
      0xff, 0xe5, 0, 4, 7, 8,
      0xff, 0xdb, 0, 3, 0,
      0xff, 0xda, 0, 2, 17, 34, 0xff, 0, 51,
      0xff, 0xd9,
    ));
    const normal = clearImageMetadata(source, 'normal', 6);
    const strong = clearImageMetadata(source, 'strong');
    expect(inspectImage(normal).blocks.filter(block => !block.image).map(block => block.kind)).toEqual(['APP1', 'APP2', 'APP14', 'APP5']);
    expect(inspectImage(strong).blocks.some(block => !block.image)).toBe(false);
    expect(sameImageData(source, normal)).toBe(true);
    expect(sameImageData(source, strong)).toBe(true);
  });

  it('原始块可变长编辑和新增，不改变图像块；非法十六进制输入报错', () => {
    const source = join(pngSignature, pngChunk('IHDR', [1]), pngChunk('tEXt', [2]), pngChunk('IDAT', [3]), pngChunk('IEND'));
    const block = inspectImage(source).blocks.find(item => item.kind === 'tEXt')!;
    const edited = editMetadataBlock(source, block.id, 'aa bb cc');
    const added = addMetadataBlock(edited, 'iTXt', '00');
    expect(inspectImage(edited).blocks.find(item => item.kind === 'tEXt')?.dataEnd).toBeGreaterThan(block.dataEnd);
    expect(inspectImage(added).blocks.map(item => item.kind)).toContain('iTXt');
    expect(sameImageData(source, added)).toBe(true);
    expect(() => editMetadataBlock(source, block.id, 'abc')).toThrow('偶数位');
  });

  it('空文件与无效长度拒绝解析', () => {
    expect(() => inspectImage(new Uint8Array())).toThrow('仅支持');
    expect(() => inspectImage(join(pngSignature, pngChunk('IHDR', [1])))).toThrow('IEND');
  });
});

describe('容器层就地校验辅助', () => {
  it('hex 工具转换与错误信息', () => {
    expect(bytesToHex(Uint8Array.of(0x0a, 0xff))).toBe('0a ff');
    expect(hexValidationError('0a ff')).toBe('');
    expect(hexValidationError('')).toBe('');
    expect(hexValidationError('0af')).toContain('偶数位');
    expect(hexValidationError('zz ff')).toContain('0-9');
    expect(hexByteCount('0a ff')).toBe(2);
    expect(hexByteCount('0a f')).toBe(1);
  });

  it('新增块类型与长度组合校验', () => {
    expect(newBlockValidationError('jpeg', 'APP1', '0a')).toBe('');
    expect(newBlockValidationError('jpeg', 'SOS', '0a')).toContain('APP0');
    expect(newBlockValidationError('jpeg', 'APP1', 'aa '.repeat(70000))).toContain('上限');
    expect(newBlockValidationError('png', 'iCCP', '0a')).toBe('');
    expect(newBlockValidationError('png', 'iccp', '0a')).toContain('辅助块');
    expect(newBlockValidationError('webp', 'VP8X', '0a')).toContain('附加块');
    expect(newBlockValidationError('webp', 'XMP', '0a')).toBe('');
    expect(newBlockValidationError('webp', 'ABCDE', '0a')).toContain('ASCII');
    expect(newBlockValidationError('png', 'eXIf', '0a0')).toContain('偶数位');
  });

  it('支持文件判定扩展名或 MIME 任一即可', () => {
    expect(isSupportedImageFile(new File([], 'a.JPG'))).toBe(true);
    expect(isSupportedImageFile(new File([], 'blob', { type: 'image/webp' }))).toBe(true);
    expect(isSupportedImageFile(new File([], 'a.gif', { type: 'image/gif' }))).toBe(false);
  });
});
describe('JPEG 方向段注入位置', () => {
  it('普通清理将方向 APP1 注入到 JFIF APP0 之后，无 APP0 时紧随 SOI', () => {
    const source = join(Uint8Array.of(0xff, 0xd8),
      Uint8Array.of(0xff, 0xe0, 0, 16), encoder.encode('JFIF\0'), Uint8Array.of(1, 2, 1, 0, 0x48, 0, 0x48, 0, 0),
      Uint8Array.of(0xff, 0xe1, 0, 6, 1, 2, 3, 4),
      Uint8Array.of(0xff, 0xda, 0, 2, 17, 34, 0xff, 0, 51, 0xff, 0xd9));
    const normal = clearImageMetadata(source, 'normal', 6);
    expect(inspectImage(normal).blocks.map(block => block.kind).slice(0, 3)).toEqual(['SOI', 'APP0', 'APP1']);
    expect(sameImageData(source, normal)).toBe(true);
    const noJfif = clearImageMetadata(join(Uint8Array.of(0xff, 0xd8, 0xff, 0xda, 0, 2, 17, 34, 0xff, 0, 51, 0xff, 0xd9)), 'normal', 6);
    expect(inspectImage(noJfif).blocks.map(block => block.kind).slice(0, 2)).toEqual(['SOI', 'APP1']);
  });
});
