import { describe, expect, it } from 'vitest';
import {
  createAssetIndex,
  directoryOf,
  fileNameOf,
  isRemoteAssetRef,
  normalizeAssetPath,
  resolveAssetRef,
} from '@/lib/docx-asset-path';

const files = [
  'index.md',
  'docs/guide.md',
  'docs/images/diagram.png',
  'assets/img/My Photo.PNG',
  'assets/img/my photo.png',
];

const index = createAssetIndex(files);
const resolve = (ref: string, basePath = 'docs/guide.md') =>
  resolveAssetRef(ref, { basePath, index });

describe('资源路径规范化', () => {
  it('统一分隔符并解析 . 与 ..', () => {
    expect(normalizeAssetPath('docs\\images\\a.png')).toBe('docs/images/a.png');
    expect(normalizeAssetPath('./docs/./images/a.png')).toBe('docs/images/a.png');
    expect(normalizeAssetPath('docs/sub/../images/a.png')).toBe('docs/images/a.png');
    expect(normalizeAssetPath('/docs/images/a.png')).toBe('docs/images/a.png');
    expect(normalizeAssetPath('../../a.png')).toBe('a.png');
  });

  it('解码百分号转义，非法转义时保持原样', () => {
    expect(normalizeAssetPath('img/my%20photo.png')).toBe('img/my photo.png');
    expect(normalizeAssetPath('img/100%.png')).toBe('img/100%.png');
  });

  it('拆分目录与文件名', () => {
    expect(directoryOf('docs/images/a.png')).toBe('docs/images');
    expect(directoryOf('index.md')).toBe('');
    expect(fileNameOf('docs/images/a.png')).toBe('a.png');
    expect(fileNameOf('index.md')).toBe('index.md');
  });
});

describe('远程引用识别', () => {
  it.each([
    'https://x.dev/a.png',
    'http://x.dev/a.png',
    'data:image/png;base64,AA',
    '//x.dev/a.png',
  ])('%s 视为远程', (ref) => {
    expect(isRemoteAssetRef(ref)).toBe(true);
  });

  it.each(['images/a.png', './a.png', 'C:\\images\\a.png', 'a b.png'])('%s 视为包内路径', (ref) => {
    expect(isRemoteAssetRef(ref)).toBe(false);
  });
});

describe('包内资源解析', () => {
  it('按主文档所在目录解析相对引用', () => {
    expect(resolve('images/diagram.png')).toEqual({
      path: 'docs/images/diagram.png',
      kind: 'path',
    });
    expect(resolve('./images/diagram.png')).toEqual({
      path: 'docs/images/diagram.png',
      kind: 'path',
    });
    expect(resolve('images\\diagram.png')).toEqual({
      path: 'docs/images/diagram.png',
      kind: 'path',
    });
  });

  it('父目录引用能回到上层', () => {
    expect(resolve('../assets/img/my photo.png', 'docs/guide.md')).toEqual({
      path: 'assets/img/my photo.png',
      kind: 'path',
    });
  });

  it('大小写不一致时兜底命中', () => {
    expect(resolve('images/Diagram.png')).toEqual({
      path: 'docs/images/diagram.png',
      kind: 'case-insensitive',
    });
  });

  it('文件名全局唯一时按文件名兜底', () => {
    expect(resolve('diagram.png', 'index.md')).toEqual({
      path: 'docs/images/diagram.png',
      kind: 'file-name',
    });
  });

  it('同名文件出现在不同目录时不做文件名兜底', () => {
    const ambiguous = createAssetIndex(['a/img/photo.png', 'b/img/photo.png']);
    expect(resolveAssetRef('photo.png', { basePath: 'index.md', index: ambiguous })).toBeNull();
  });

  it('找不到、远程引用和空引用都返回 null', () => {
    expect(resolve('images/missing.png')).toBeNull();
    expect(resolve('https://x.dev/a.png')).toBeNull();
    expect(resolve('   ')).toBeNull();
  });
});
