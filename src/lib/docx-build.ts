import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDocx, { type DocxOptions } from 'remark-docx';
import { imagePlugin } from 'remark-docx/plugins/image';
import { Paragraph, TextRun } from 'docx';
import { createAssetIndex, fileNameOf, isRemoteAssetRef, resolveAssetRef } from './docx-asset-path';
import type { DocxSource } from './docx-source';
import { createChineseStyles } from './docx-styles';

/** remark-docx 只通过 DocxOptions 暴露插件类型，从它反推比引用内部路径稳。 */
type RemarkDocxPlugin = NonNullable<DocxOptions['plugins']>[number];

/**
 * 围栏代码块样式。
 *
 * remark-docx 自带的 code 处理器在没挂 shiki 插件时会把代码降级成普通段落，
 * 这里补一个只改排版、不做语法高亮的实现，避免为了等宽字体引入整套 shiki。
 */
const codePlugin: RemarkDocxPlugin = async () => ({
  code: (node) =>
    node.value.split(/\r?\n/).map(
      (line) =>
        new Paragraph({
          style: 'CodeBlock',
          children: [
            new TextRun({ text: line || ' ', font: { ascii: 'Consolas', eastAsia: '宋体' } }),
          ],
        })
    ),
});

/** docx 的页面尺寸与页边距单位是 twip（1/1440 英寸）。 */
const twipsPerInch = 1440;

export const pagePresets = {
  a4: { width: 11906, height: 16838, margin: twipsPerInch },
  'a4-narrow': { width: 11906, height: 16838, margin: Math.round(twipsPerInch * 0.79) },
  letter: { width: 12240, height: 15840, margin: twipsPerInch },
} as const;

export type PagePreset = keyof typeof pagePresets;

export interface DocxBuildOptions {
  page: PagePreset;
}

export interface DocxIssue {
  ref: string;
  reason: string;
}

export interface DocxBuildResult {
  bytes: ArrayBuffer;
  title: string;
  /** 没能写进文档的图片，逐条说明原因。 */
  issues: DocxIssue[];
  /** 命中但不是按引用原路径找到的资源数，用于提示兜底匹配。 */
  matchedByFileName: number;
  imageCount: number;
}

/**
 * 识别图片格式。
 *
 * `webp` 和 `svg` 也能认出来，只是识别出来是为了在 `load` 里拦下并给出原因，
 * 真写进文档的只有 `png` / `jpeg` / `gif` / `bmp`。
 */
function sniffImageType(
  bytes: Uint8Array
): 'png' | 'jpeg' | 'gif' | 'bmp' | 'svg' | 'webp' | 'unknown' {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
  )
    return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpeg';
  if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 6)) === 'GIF8') return 'gif';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'webp';
  }
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  return 'unknown';
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** 标题优先取首个一级标题，取不到时退回文件名。 */
export function pickDocumentTitle(markdown: string, entry: string): string {
  const match = /^[ \t]{0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(markdown);
  if (match?.[1]) return match[1];
  const name = fileNameOf(entry).replace(/\.[^.]+$/, '');
  return name || '文档';
}

export async function buildDocx(
  source: DocxSource,
  options: DocxBuildOptions,
  onProgress?: (stage: string) => void
): Promise<DocxBuildResult> {
  const index = createAssetIndex(source.files.map((file) => file.path));
  const files = new Map(source.files.map((file) => [file.path, file.bytes]));
  const issues: DocxIssue[] = [];
  const seen = new Set<string>();
  let matchedByFileName = 0;
  let imageCount = 0;

  const report = (ref: string, reason: string) => {
    // 分隔符用 NUL：路径和原因里都不会出现，避免不同组合拼出同一个 key。
    const key = `${ref}\u0000${reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ ref, reason });
  };

  const load = async (url: string): Promise<ArrayBuffer> => {
    if (isRemoteAssetRef(url)) {
      onProgress?.(`获取远程图片 ${fileNameOf(url)}`);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.arrayBuffer();
      } catch {
        report(url, '远程图片获取失败，通常是目标站点没有开放跨域读取。');
        throw new Error(url);
      }
    }

    const resolved = resolveAssetRef(url, { basePath: source.entry, index });
    if (!resolved) {
      report(url, '压缩包或文件夹里没有这个文件。');
      throw new Error(url);
    }
    if (resolved.kind === 'file-name') matchedByFileName += 1;
    onProgress?.(`读取图片 ${fileNameOf(resolved.path)}`);

    const bytes = files.get(resolved.path);
    if (!bytes) {
      report(url, `找到 ${resolved.path} 但读取失败。`);
      throw new Error(url);
    }

    const type = sniffImageType(bytes);
    if (type === 'unknown') {
      report(url, '不是可识别的图片内容。');
      throw new Error(url);
    }
    if (type === 'webp') {
      report(url, 'WebP 无法写入 Word，请先转成 PNG 或 JPEG。');
      throw new Error(url);
    }
    // remark-docx 写 SVG 时要先用 canvas 把它栅格化成 PNG 兜底，而 Worker 里没有
    // document/window/Image，那一步必然抛错并被插件静默吞掉：图片不进文档，
    // 页面却按已写入计数。这里和 WebP 一样提前拦下，给出能照做的提示。
    if (type === 'svg') {
      report(url, 'SVG 无法写入 Word，请先转成 PNG 或 JPEG。');
      throw new Error(url);
    }
    imageCount += 1;
    return toArrayBuffer(bytes);
  };

  const preset = pagePresets[options.page];
  const title = pickDocumentTitle(source.markdown, source.entry);

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDocx, {
      title,
      creator: '',
      description: '',
      size: { width: preset.width, height: preset.height },
      margin: {
        top: preset.margin,
        right: preset.margin,
        bottom: preset.margin,
        left: preset.margin,
      },
      // 默认值是 page，会让 Markdown 里普通的 `---` 在 Word 里变成换页。
      thematicBreak: 'line',
      styles: createChineseStyles(),
      plugins: [codePlugin, imagePlugin({ load })],
    });

  onProgress?.('生成 Word 文档');
  const file = await processor.process(source.markdown);
  const bytes = await file.result;

  return { bytes, title, issues, matchedByFileName, imageCount };
}
