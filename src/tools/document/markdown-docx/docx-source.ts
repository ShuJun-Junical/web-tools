import { unzipSync } from 'fflate';
import { fileNameOf, normalizeAssetPath } from './docx-asset-path';

/** 单个条目与解压总量的上限，避免选到异常压缩包时把浏览器内存打满。 */
const maxEntryBytes = 64 * 1024 * 1024;
const maxTotalBytes = 256 * 1024 * 1024;

const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd']);
const imageExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.svg',
  '.webp',
  '.avif',
]);

export interface SourceFile {
  /** 保留目录结构的包内路径，例如 `docs/images/a.png`。 */
  path: string;
  bytes: Uint8Array;
}

/** 主线程交给 worker 的一个文件夹条目。 */
export interface DocxFolderEntry {
  /** 主线程读到的相对路径，例如 `docs/images/a.png`。 */
  path: string;
  file: File;
}

export interface DocxSource {
  /** 主 Markdown 在包内的路径。 */
  entry: string;
  markdown: string;
  /** 随包资源，目前只保留图片。 */
  files: SourceFile[];
}

function extensionOf(path: string): string {
  const name = fileNameOf(path);
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
}

export function isMarkdownPath(path: string): boolean {
  return markdownExtensions.has(extensionOf(path));
}

export function isImagePath(path: string): boolean {
  return imageExtensions.has(extensionOf(path));
}

/** macOS 压缩包自带的资源分叉目录和元数据，不参与转换。 */
function isNoiseEntry(path: string): boolean {
  const segments = normalizeAssetPath(path).split('/');
  return segments.some((segment) => segment === '__MACOSX' || segment === '.DS_Store');
}

/**
 * 选主文档：优先根目录 README，其次路径最短的 Markdown。
 * 多个候选同级时按字母序，保证同样输入总是选到同一个文件。
 */
export function pickMarkdownEntry(paths: readonly string[]): string | null {
  const candidates = paths.filter((path) => isMarkdownPath(path) && !isNoiseEntry(path));
  if (candidates.length === 0) return null;

  const normalized = candidates.map((path) => ({ path, key: normalizeAssetPath(path) }));
  const readme = normalized.find((item) => {
    const key = item.key.toLowerCase();
    return key === 'readme.md' || key === 'readme.markdown' || key === 'readme.mdown';
  });
  if (readme) return readme.key;

  normalized.sort((a, b) => a.key.length - b.key.length || a.key.localeCompare(b.key));
  return normalized[0].key;
}

function decodeText(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8').decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 读取 zip：只解压 Markdown 与图片条目，其余条目直接跳过。 */
export function readZipSource(bytes: Uint8Array): DocxSource {
  if (!looksLikeZip(bytes)) {
    throw new Error('这不是 zip 压缩包。文件夹请用「选择文件夹」，或先把内容打包成 zip 再拖进来。');
  }

  const collected: { path: string; bytes: Uint8Array }[] = [];
  let total = 0;

  const entries = unzipSync(bytes, {
    filter: (file) => {
      if (file.name.endsWith('/')) return false;
      const path = normalizeAssetPath(file.name);
      if (!path || isNoiseEntry(path)) return false;
      if (!isMarkdownPath(path) && !isImagePath(path)) return false;
      if (file.originalSize > maxEntryBytes) {
        throw new Error(
          `压缩包内 ${path} 解压后超过 ${maxEntryBytes / 1024 / 1024}MB，请拆分后再试。`
        );
      }
      total += file.originalSize;
      if (total > maxTotalBytes) throw new Error('压缩包解压后体积过大，请拆分后再试。');
      return true;
    },
  });

  for (const [name, data] of Object.entries(entries)) {
    const path = normalizeAssetPath(name);
    if (path) collected.push({ path, bytes: data });
  }

  return toSource(collected);
}

/**
 * 读取本地文件夹。
 *
 * 相对路径必须由主线程在 postMessage 之前取出来：结构化克隆不会携带 `webkitRelativePath`，
 * 直接把 File 发进 worker 会让它退化成只有文件名，文档与子目录图片的相对关系就断了。
 */
export async function readFolderSource(entries: readonly DocxFolderEntry[]): Promise<DocxSource> {
  const collected: { path: string; bytes: Uint8Array }[] = [];
  let total = 0;

  for (const { path: rawPath, file } of entries) {
    const path = normalizeAssetPath(rawPath);
    if (!path || isNoiseEntry(path)) continue;
    if (!isMarkdownPath(path) && !isImagePath(path)) continue;
    if (file.size > maxEntryBytes) continue;

    total += file.size;
    if (total > maxTotalBytes)
      throw new Error('所选文件夹体积过大，请只保留需要转换的文档和图片。');
    collected.push({ path, bytes: new Uint8Array(await file.arrayBuffer()) });
  }

  return toSource(collected);
}

/**
 * zip 魔数：本地文件头 0x04034b50，空压缩包结尾记录 0x06054b50，分卷标记 0x08074b50。
 *
 * 拖进来一个文件夹时浏览器给的是代表目录的空壳 File，直接解压只会报 fflate 的原始错误，
 * 或者在读取字节时抛出系统的 ENOENT 文案。提前拦一道才能给出能照做的提示。
 */
function looksLikeZip(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  // 魔数是小端存放的，后两字节要反过来拼：50 4b 03 04 -> 0x0403。
  const kind = (bytes[3] << 8) | bytes[2];
  return kind === 0x0403 || kind === 0x0605 || kind === 0x0807;
}

function toSource(collected: { path: string; bytes: Uint8Array }[]): DocxSource {
  const entry = pickMarkdownEntry(collected.map((item) => item.path));
  if (!entry) throw new Error('没有找到 Markdown 文件（.md / .markdown）。');

  const markdownEntry = collected.find((item) => item.path === entry);
  if (!markdownEntry) throw new Error(`无法读取主文档 ${entry}。`);

  return {
    entry,
    markdown: decodeText(markdownEntry.bytes),
    files: collected
      .filter((item) => item.path !== entry && isImagePath(item.path))
      .map(({ path, bytes }) => ({ path, bytes })),
  };
}
