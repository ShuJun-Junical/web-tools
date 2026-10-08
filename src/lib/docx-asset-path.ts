/**
 * Markdown 图片引用与压缩包内相对路径的解析。
 *
 * pandoc 的 wasm 版因为 WASI 虚拟文件系统没有真实目录，会把子目录引用静默降级成图片说明文字，
 * 官方 app 只能靠「压平文件名 + resource-path」绕过。纯 JS 管线没有这个限制，
 * 这里负责在完整目录结构下定位资源，并把匹配方式回传给界面用于说明。
 */

/**
 * http(s)、data:、mailto 等不能当作包内文件的引用。
 * 协议名要求两位以上，避免把 Windows 盘符 `C:\...` 误判成协议而触发无意义的网络请求。
 */
const remoteRefPattern = /^(?:[a-z][a-z0-9+.-]+:|\/\/)/i;

export function isRemoteAssetRef(ref: string): boolean {
  return remoteRefPattern.test(ref.trim());
}

/** 统一分隔符、解码百分号转义、解析 `.` 与 `..`，并去掉首尾斜杠。 */
export function normalizeAssetPath(path: string): string {
  let decoded = path.replace(/\\/g, '/').trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // 含非法百分号转义时按原样处理，交给后续查表决定是否命中。
  }

  const parts: string[] = [];
  for (const segment of decoded.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts.join('/');
}

/** 取所在目录（无尾斜杠）。根目录下返回空串。 */
export function directoryOf(path: string): string {
  const normalized = normalizeAssetPath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

export function fileNameOf(path: string): string {
  const normalized = normalizeAssetPath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
}

export interface AssetIndex {
  /** 规范化路径 → 原始路径。 */
  byPath: ReadonlyMap<string, string>;
  /** 小写规范化路径 → 原始路径，供大小写不一致时兜底。 */
  byLowerPath: ReadonlyMap<string, string>;
  /** 文件名 → 原始路径列表。只有唯一命中时才会按文件名匹配。 */
  byFileName: ReadonlyMap<string, readonly string[]>;
}

export function createAssetIndex(paths: Iterable<string>): AssetIndex {
  const byPath = new Map<string, string>();
  const byLowerPath = new Map<string, string>();
  const byFileName = new Map<string, string[]>();

  for (const path of paths) {
    const normalized = normalizeAssetPath(path);
    if (!normalized) continue;
    if (!byPath.has(normalized)) byPath.set(normalized, path);

    const lower = normalized.toLowerCase();
    if (!byLowerPath.has(lower)) byLowerPath.set(lower, path);

    const fileName = fileNameOf(normalized).toLowerCase();
    const group = byFileName.get(fileName);
    if (group) group.push(path);
    else byFileName.set(fileName, [path]);
  }

  return { byPath, byLowerPath, byFileName };
}

export type AssetMatchKind = 'path' | 'case-insensitive' | 'file-name';

export interface ResolvedAsset {
  /** 命中的原始路径，可直接回到源文件。 */
  path: string;
  kind: AssetMatchKind;
}

export interface ResolveAssetOptions {
  /** 主文档所在路径，用于把相对引用解析成包内绝对路径。 */
  basePath: string;
  index: AssetIndex;
}

/**
 * 定位引用对应的资源：先按完整相对路径精确匹配，再放宽到大小写不敏感，
 * 最后在文件名全局唯一时按文件名匹配（`![](a.png)` 但资源其实在 `images/a.png`）。
 */
export function resolveAssetRef(ref: string, options: ResolveAssetOptions): ResolvedAsset | null {
  const trimmed = ref.trim();
  if (!trimmed || isRemoteAssetRef(trimmed)) return null;

  const { basePath, index } = options;
  const joined = normalizeAssetPath(`${directoryOf(basePath)}/${trimmed}`);
  if (joined) {
    const exact = index.byPath.get(joined);
    if (exact) return { path: exact, kind: 'path' };

    const lower = index.byLowerPath.get(joined.toLowerCase());
    if (lower) return { path: lower, kind: 'case-insensitive' };
  }

  // 文档写在子目录里、却引用了仓库根目录下的同名文件时，用文件名兜底。
  const candidates = index.byFileName.get(fileNameOf(joined).toLowerCase());
  if (candidates && candidates.length === 1) return { path: candidates[0], kind: 'file-name' };

  return null;
}
