import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDocx, pickDocumentTitle } from '@/lib/docx-build';
import {
  isImagePath,
  isMarkdownPath,
  pickMarkdownEntry,
  readFolderSource,
  readZipSource,
} from '@/lib/docx-source';

/** 1×1 PNG，image-size 能读出尺寸即可。atob 要逐字符取码位，直接 from 会把高位字节转成 NaN。 */
const pngBytes = new Uint8Array(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  )
    .split('')
    .map((char) => char.charCodeAt(0))
);

/** 只有 RIFF/WEBP 头就够：格式判断发生在交给 remark-docx 之前。 */
const webpBytes = new Uint8Array([
  ...'RIFF'.split('').map((char) => char.charCodeAt(0)),
  0,
  0,
  0,
  0,
  ...'WEBP'.split('').map((char) => char.charCodeAt(0)),
]);

function makeZip(entries: Record<string, Uint8Array | string>) {
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, value]) => [
        name,
        typeof value === 'string' ? strToU8(value) : value,
      ])
    )
  );
}

function docxEntries(bytes: ArrayBuffer) {
  return unzipSync(new Uint8Array(bytes));
}

describe('包内条目判断', () => {
  it('识别 Markdown 与图片', () => {
    expect(isMarkdownPath('docs/a.MD')).toBe(true);
    expect(isMarkdownPath('docs/a.markdown')).toBe(true);
    expect(isMarkdownPath('docs/a.txt')).toBe(false);
    expect(isImagePath('images/a.JPG')).toBe(true);
    expect(isImagePath('images/a.svg')).toBe(true);
    expect(isImagePath('images/a.pdf')).toBe(false);
  });

  it('优先根目录 README，其次路径最短，同级按字母序', () => {
    expect(pickMarkdownEntry(['docs/b.md', 'README.md'])).toBe('README.md');
    expect(pickMarkdownEntry(['a/deep/nested/doc.md', 'z.md'])).toBe('z.md');
    expect(pickMarkdownEntry(['b.md', 'a.md'])).toBe('a.md');
    expect(pickMarkdownEntry(['__MACOSX/._a.md', 'note.txt'])).toBeNull();
  });
});

describe('读取 zip 来源', () => {
  it('选出主文档并只保留图片资源', () => {
    const source = readZipSource(
      makeZip({
        'README.md': '# 标题\n\n![](docs/images/a.png)\n',
        'docs/images/a.png': pngBytes,
        'docs/notes.txt': '忽略我',
        '__MACOSX/._README.md': '忽略我',
      })
    );

    expect(source.entry).toBe('README.md');
    expect(source.markdown).toContain('# 标题');
    expect(source.files.map((file) => file.path)).toEqual(['docs/images/a.png']);
  });

  it('包内没有 Markdown 时报错', () => {
    expect(() => readZipSource(makeZip({ 'a.png': pngBytes }))).toThrow(/没有找到 Markdown/);
  });

  it('不是 zip 时给出能照做的提示，而不是 fflate 的原始错误', () => {
    expect(() => readZipSource(strToU8('# 只是一个 markdown 文件'))).toThrow(/这不是 zip/);
    expect(() => readZipSource(new Uint8Array([0x50, 0x4b]))).toThrow(/这不是 zip/);
    expect(() => readZipSource(new Uint8Array(0))).toThrow(/这不是 zip/);
  });

  it('空压缩包和分卷标记同样算 zip，不会被魔数检查误伤', () => {
    expect(() => readZipSource(makeZip({}))).toThrow(/没有找到 Markdown/);
    // 分卷标记是合法 zip 头，只是内容不完整：该交给解压报错，而不是被魔数检查拦下。
    expect(() => readZipSource(new Uint8Array([0x50, 0x4b, 0x07, 0x08]))).not.toThrow(/这不是 zip/);
  });
});

describe('读取本地文件夹来源', () => {
  const options = { page: 'a4' } as const;

  it('按主线程传来的相对路径选主文档，子目录图片不靠文件名兜底', async () => {
    // 回归点：File 经 postMessage 后拿不到 webkitRelativePath，如果路径只取自 file.name，
    // 主文档会变成 docs.md、图片只能走唯一文件名兜底，文档里的相对引用就等于失效。
    const source = await readFolderSource([
      {
        path: 'docs/guide.md',
        file: new File([strToU8('# 指南\n\n![图](images/a.png)\n')], 'guide.md'),
      },
      { path: 'docs/images/a.png', file: new File([pngBytes], 'a.png') },
    ]);

    expect(source.entry).toBe('docs/guide.md');
    expect(source.files.map((file) => file.path)).toEqual(['docs/images/a.png']);

    const { issues, imageCount, matchedByFileName } = await buildDocx(source, options);
    expect(issues).toEqual([]);
    expect(imageCount).toBe(1);
    expect(matchedByFileName).toBe(0);
  });

  it('同名图片分布在不同目录时不会误配', async () => {
    const source = await readFolderSource([
      { path: 'a/doc.md', file: new File([strToU8('![图](images/a.png)\n')], 'doc.md') },
      { path: 'a/images/a.png', file: new File([pngBytes], 'a.png') },
      { path: 'b/images/a.png', file: new File([pngBytes], 'a.png') },
    ]);

    const { issues, matchedByFileName } = await buildDocx(source, options);
    expect(issues).toEqual([]);
    expect(matchedByFileName).toBe(0);
  });

  it('跳过 .DS_Store 等噪声条目', async () => {
    const source = await readFolderSource([
      { path: 'notes.md', file: new File([strToU8('# 标题\n')], 'notes.md') },
      { path: '.DS_Store', file: new File([new Uint8Array([0, 1, 2])], '.DS_Store') },
    ]);

    expect(source.entry).toBe('notes.md');
    expect(source.files).toEqual([]);
  });
});

describe('文档标题', () => {
  it('取首个一级标题，取不到时退回文件名', () => {
    expect(pickDocumentTitle('正文\n\n# 真正的标题\n', 'a.md')).toBe('真正的标题');
    expect(pickDocumentTitle('正文没有标题\n', 'docs/报告.md')).toBe('报告');
    expect(pickDocumentTitle('# 保留井号 #\n', 'a.md')).toBe('保留井号');
  });
});

describe('Markdown 转 Word', () => {
  const options = { page: 'a4' } as const;

  it('子目录图片按相对路径内嵌进文档', async () => {
    const source = readZipSource(
      makeZip({
        'docs/guide.md': '# 指南\n\n![示意图](images/a.png)\n',
        'docs/images/a.png': pngBytes,
      })
    );

    const { bytes, issues, imageCount } = await buildDocx(source, options);
    const entries = docxEntries(bytes);
    const media = Object.keys(entries).filter((name) => name.startsWith('word/media/'));

    expect(issues).toEqual([]);
    expect(imageCount).toBe(1);
    expect(media.length).toBeGreaterThan(0);
    expect(new TextDecoder().decode(entries['word/document.xml'])).toContain('示意图');
  });

  it('缺失图片不会被静默丢弃，而是回报给界面', async () => {
    const source = readZipSource(
      makeZip({ 'a.md': '# 标题\n\n![丢失](images/gone.png)\n\n正文仍在\n' })
    );

    const { bytes, issues } = await buildDocx(source, options);
    const document = new TextDecoder().decode(docxEntries(bytes)['word/document.xml']);

    expect(issues).toEqual([{ ref: 'images/gone.png', reason: '压缩包或文件夹里没有这个文件。' }]);
    expect(document).toContain('正文仍在');
  });

  it('WebP 图片给出可执行的提示', async () => {
    const source = readZipSource(makeZip({ 'a.md': '![图](a.webp)\n', 'a.webp': webpBytes }));

    const { issues } = await buildDocx(source, options);

    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toMatch(/WebP/);
  });

  it('SVG 图片给出可执行的提示，不计入已写入数量', async () => {
    const source = readZipSource(
      makeZip({
        'a.md': '![图](a.svg)\n',
        'a.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
      })
    );

    const { issues, imageCount } = await buildDocx(source, options);

    expect(issues).toEqual([{ ref: 'a.svg', reason: 'SVG 无法写入 Word，请先转成 PNG 或 JPEG。' }]);
    expect(imageCount).toBe(0);
  });

  it('分隔线保持为横线而不是分页符', async () => {
    const source = readZipSource(makeZip({ 'a.md': '上文\n\n---\n\n下文\n' }));

    const { bytes } = await buildDocx(source, options);
    const document = new TextDecoder().decode(docxEntries(bytes)['word/document.xml']);

    expect(document).not.toContain('w:type="page"');
  });

  it('代码块按等宽样式输出而不是降级成普通段落', async () => {
    const source = readZipSource(makeZip({ 'a.md': '```js\nconst a = 1;\n```\n' }));

    const { bytes } = await buildDocx(source, options);
    const styles = new TextDecoder().decode(docxEntries(bytes)['word/styles.xml']);

    expect(styles).toContain('CodeBlock');
    expect(styles).toContain('Consolas');
  });

  it('标题、表格与中文正文都能进入文档', async () => {
    const source = readZipSource(
      makeZip({
        'a.md': '# 一级标题\n\n中文正文。\n\n| 列 A | 列 B |\n| --- | --- |\n| 1 | 2 |\n',
      })
    );

    const { bytes } = await buildDocx(source, options);
    const document = new TextDecoder().decode(docxEntries(bytes)['word/document.xml']);

    expect(document).toContain('一级标题');
    expect(document).toContain('中文正文');
    expect(document).toContain('列 A');
  });
});
