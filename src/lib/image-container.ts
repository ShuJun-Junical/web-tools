export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface ImageBlock {
  id: string;
  kind: string;
  label: string;
  start: number;
  end: number;
  dataStart: number;
  dataEnd: number;
  image: boolean;
  display: boolean;
  known: boolean;
  signed: boolean;
}

export interface ImageStructure {
  format: ImageFormat;
  blocks: ImageBlock[];
  animated: boolean;
  unsupportedMultiImage: boolean;
}

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const pngImage = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'acTL', 'fcTL', 'fdAT']);
const pngDisplay = new Set(['iCCP', 'sRGB', 'cICP', 'gAMA', 'cHRM', 'sBIT', 'mDCV', 'cLLI']);
const pngMetadata = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME', 'pHYs', 'caBX']);
const webpImage = new Set(['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ANIM', 'ANMF']);
const decoder = new TextDecoder();
const encoder = new TextEncoder();

function text(bytes: Uint8Array, start: number, end: number) {
  return decoder.decode(bytes.subarray(start, end));
}

function startsWith(bytes: Uint8Array, start: number, value: string) {
  return text(bytes, start, start + value.length) === value;
}

function u32be(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

function u32le(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function imageFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (pngSignature.every((value, index) => bytes[index] === value)) return 'png';
  if (bytes.length >= 12 && startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP'))
    return 'webp';
  throw new Error('仅支持 JPEG、PNG 和 WebP 图片。');
}

function inspectJpeg(bytes: Uint8Array): ImageStructure {
  const blocks: ImageBlock[] = [];
  let offset = 2;
  let ended = false;
  let unsupportedMultiImage = false;
  let index = 0;

  blocks.push({
    id: 'jpeg-0',
    kind: 'SOI',
    label: 'JPEG 图像起点',
    start: 0,
    end: 2,
    dataStart: 0,
    dataEnd: 2,
    image: true,
    display: false,
    known: true,
    signed: false,
  });

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('JPEG 区段结构不完整。');
    const start = offset;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0x00) throw new Error('JPEG 标记无效。');
    const kind = `0xFF${marker.toString(16).toUpperCase().padStart(2, '0')}`;
    if (marker === 0xd9) {
      blocks.push({
        id: `jpeg-${++index}`,
        kind: 'EOI',
        label: 'JPEG 图像终点',
        start,
        end: offset,
        dataStart: start,
        dataEnd: offset,
        image: true,
        display: false,
        known: true,
        signed: false,
      });
      ended = true;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      blocks.push({
        id: `jpeg-${++index}`,
        kind,
        label: kind,
        start,
        end: offset,
        dataStart: start,
        dataEnd: offset,
        image: true,
        display: false,
        known: true,
        signed: false,
      });
      continue;
    }
    if (offset + 2 > bytes.length) throw new Error('JPEG 区段长度缺失。');
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) throw new Error('JPEG 区段长度无效。');
    const dataStart = offset + 2;
    const dataEnd = offset + length;
    offset = dataEnd;

    if (marker === 0xda) {
      while (offset < bytes.length - 1) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        const next = bytes[offset + 1];
        if (next === 0x00 || next === 0xff || (next >= 0xd0 && next <= 0xd7)) {
          offset += 2;
          continue;
        }
        break;
      }
    }

    const app = marker >= 0xe0 && marker <= 0xef;
    const comment = marker === 0xfe;
    const mpf = marker === 0xe2 && startsWith(bytes, dataStart, 'MPF\0');
    const hdr =
      marker === 0xeb &&
      (startsWith(bytes, dataStart, 'HDR') || startsWith(bytes, dataStart, 'JUMBF'));
    unsupportedMultiImage ||= mpf || hdr;
    const display =
      (marker === 0xe0 && startsWith(bytes, dataStart, 'JFIF\0')) ||
      (marker === 0xe2 && startsWith(bytes, dataStart, 'ICC_PROFILE\0')) ||
      (marker === 0xee && startsWith(bytes, dataStart, 'Adobe'));
    const known =
      !app ||
      comment ||
      display ||
      marker === 0xe1 ||
      marker === 0xed ||
      mpf ||
      (marker === 0xeb && startsWith(bytes, dataStart, 'JUMBF'));
    const signed = marker === 0xeb && startsWith(bytes, dataStart, 'JUMBF');
    blocks.push({
      id: `jpeg-${++index}`,
      kind: app ? `APP${marker - 0xe0}` : comment ? 'COM' : kind,
      label: app ? `JPEG APP${marker - 0xe0}` : comment ? 'JPEG 注释' : kind,
      start,
      end: offset,
      dataStart,
      dataEnd,
      image: !app && !comment,
      display,
      known,
      signed,
    });
  }

  if (!ended) throw new Error('JPEG 缺少图像终止标记。');
  if (offset < bytes.length)
    blocks.push({
      id: `jpeg-${++index}`,
      kind: 'Trailer',
      label: 'JPEG 尾部数据',
      start: offset,
      end: bytes.length,
      dataStart: offset,
      dataEnd: bytes.length,
      image: false,
      display: false,
      known: false,
      signed: false,
    });
  return { format: 'jpeg', blocks, animated: false, unsupportedMultiImage };
}

function inspectPng(bytes: Uint8Array): ImageStructure {
  const blocks: ImageBlock[] = [];
  let offset = 8;
  let ended = false;
  let animated = false;
  let index = 0;
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('PNG 数据块长度无效。');
    const kind = text(bytes, offset + 4, offset + 8);
    const unknownCritical =
      kind.charCodeAt(0) >= 65 && kind.charCodeAt(0) <= 90 && !pngImage.has(kind);
    if (unknownCritical) throw new Error(`暂不支持 PNG 关键块 ${kind}。`);
    const image = pngImage.has(kind);
    animated ||= kind === 'acTL';
    blocks.push({
      id: `png-${++index}`,
      kind,
      label: `PNG ${kind}`,
      start: offset,
      end,
      dataStart: offset + 8,
      dataEnd: end - 4,
      image,
      display: pngDisplay.has(kind),
      known: image || pngDisplay.has(kind) || pngMetadata.has(kind),
      signed: kind === 'caBX',
    });
    offset = end;
    if (kind === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended) throw new Error('PNG 缺少 IEND 数据块。');
  if (offset < bytes.length)
    blocks.push({
      id: `png-${++index}`,
      kind: 'Trailer',
      label: 'PNG 尾部数据',
      start: offset,
      end: bytes.length,
      dataStart: offset,
      dataEnd: bytes.length,
      image: false,
      display: false,
      known: false,
      signed: false,
    });
  return { format: 'png', blocks, animated, unsupportedMultiImage: false };
}

function inspectWebp(bytes: Uint8Array): ImageStructure {
  const blocks: ImageBlock[] = [];
  const declaredEnd = u32le(bytes, 4) + 8;
  if (declaredEnd > bytes.length) throw new Error('WebP RIFF 长度无效。');
  let offset = 12;
  let animated = false;
  let index = 0;
  while (offset + 8 <= declaredEnd) {
    const kind = text(bytes, offset, offset + 4);
    const length = u32le(bytes, offset + 4);
    const end = offset + 8 + length + (length & 1);
    if (end > declaredEnd) throw new Error('WebP 数据块长度无效。');
    const image = webpImage.has(kind);
    animated ||= kind === 'ANIM' || kind === 'ANMF';
    blocks.push({
      id: `webp-${++index}`,
      kind,
      label: `WebP ${kind.trim()}`,
      start: offset,
      end,
      dataStart: offset + 8,
      dataEnd: offset + 8 + length,
      image,
      display: kind === 'ICCP',
      known: image || kind === 'ICCP' || kind === 'EXIF' || kind === 'XMP ',
      signed: false,
    });
    offset = end;
  }
  if (offset !== declaredEnd) throw new Error('WebP 数据块边界无效。');
  if (declaredEnd < bytes.length)
    blocks.push({
      id: `webp-${++index}`,
      kind: 'Trailer',
      label: 'WebP 尾部数据',
      start: declaredEnd,
      end: bytes.length,
      dataStart: declaredEnd,
      dataEnd: bytes.length,
      image: false,
      display: false,
      known: false,
      signed: false,
    });
  return { format: 'webp', blocks, animated, unsupportedMultiImage: false };
}

export function inspectImage(bytes: Uint8Array): ImageStructure {
  const format = imageFormat(bytes);
  return format === 'jpeg'
    ? inspectJpeg(bytes)
    : format === 'png'
      ? inspectPng(bytes)
      : inspectWebp(bytes);
}

function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function setU32le(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true);
}

function fixWebpFlags(bytes: Uint8Array) {
  const structure = inspectWebp(bytes);
  const vp8x = structure.blocks.find((block) => block.kind === 'VP8X');
  if (!vp8x) return bytes;
  const kinds = new Set(structure.blocks.map((block) => block.kind));
  const result = bytes.slice();
  result[vp8x.dataStart] =
    (result[vp8x.dataStart] & ~(0x20 | 0x08 | 0x04)) |
    (kinds.has('ICCP') ? 0x20 : 0) |
    (kinds.has('EXIF') ? 0x08 : 0) |
    (kinds.has('XMP ') ? 0x04 : 0);
  return result;
}

function jpegOrientationBlock(orientation: number) {
  const result = Uint8Array.of(
    0xff,
    0xe1,
    0,
    34,
    0x45,
    0x78,
    0x69,
    0x66,
    0,
    0,
    0x49,
    0x49,
    42,
    0,
    8,
    0,
    0,
    0,
    1,
    0,
    0x12,
    1,
    3,
    0,
    1,
    0,
    0,
    0,
    orientation,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  );
  return result;
}

/** JPEG 段序约束：EXIF APP1 必须位于 JFIF APP0 之后，否则 ExifTool 等按规范扫描的解码器会整体跳过它。 */
function jpegParts(
  kept: ImageBlock[],
  bytes: Uint8Array,
  mode: 'normal' | 'strong',
  orientation?: number | null
) {
  const inject =
    mode === 'normal' && orientation && orientation >= 1 && orientation <= 8
      ? jpegOrientationBlock(orientation)
      : null;
  const injectAfter = inject
    ? (kept.find((block) => block.kind === 'APP0' && !block.image) ?? kept[0])
    : null;
  const parts: Uint8Array[] = [];
  for (const block of kept) {
    parts.push(bytes.subarray(block.start, block.end));
    if (inject && block === injectAfter) parts.push(inject);
  }
  return parts;
}

export function clearImageMetadata(
  bytes: Uint8Array,
  mode: 'normal' | 'strong',
  orientation?: number
) {
  const structure = inspectImage(bytes);
  if (structure.unsupportedMultiImage) throw new Error('此多图 JPEG 变体暂不支持清理导出。');
  const kept = structure.blocks.filter(
    (block) => block.image || (mode === 'normal' && (block.display || !block.known))
  );
  const parts =
    structure.format === 'png'
      ? [bytes.subarray(0, 8), ...kept.map((block) => bytes.subarray(block.start, block.end))]
      : structure.format === 'webp'
        ? [bytes.subarray(0, 12), ...kept.map((block) => bytes.subarray(block.start, block.end))]
        : jpegParts(kept, bytes, mode, orientation);
  let result: Uint8Array = concat(parts);
  if (structure.format === 'webp') {
    setU32le(result, 4, result.length - 8);
    result = fixWebpFlags(result);
  }
  const output = inspectImage(result);
  if (!sameImageData(bytes, result)) throw new Error('图像数据校验失败，未生成清理结果。');
  if (mode === 'strong' && output.blocks.some((block) => !block.image))
    throw new Error('仍有附加数据，未生成强力清理结果。');
  return result;
}

export function sameImageData(before: Uint8Array, after: Uint8Array) {
  const original = inspectImage(before);
  const current = inspectImage(after);
  if (original.format !== current.format) return false;
  const imageParts = (bytes: Uint8Array, structure: ImageStructure) =>
    structure.blocks
      .filter((block) => block.image && block.kind !== 'VP8X')
      .map((block) => ({ kind: block.kind, bytes: bytes.subarray(block.start, block.end) }));
  const left = imageParts(before, original);
  const right = imageParts(after, current);
  return (
    left.length === right.length &&
    left.every(
      (part, index) =>
        part.kind === right[index].kind &&
        part.bytes.length === right[index].bytes.length &&
        part.bytes.every((value, byteIndex) => value === right[index].bytes[byteIndex])
    )
  );
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function parseHex(hex: string) {
  const clean = hex.replace(/\s/g, '');
  if (clean.length % 2 || /[^0-9a-f]/i.test(clean))
    throw new Error('请输入偶数位的十六进制字节，仅包含 0-9 与 a-f。');
  return Uint8Array.from(clean.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);
}

/** 就地校验用：返回错误信息，空字符串表示通过。 */
export function hexValidationError(hex: string): string {
  const clean = hex.replace(/\s/g, '');
  if (!clean) return '';
  if (/[^0-9a-f]/i.test(clean)) return '十六进制字节仅允许 0-9 与 a-f。';
  if (clean.length % 2) return '请输入偶数位的十六进制字节。';
  return '';
}

export function hexByteCount(hex: string) {
  return Math.floor(hex.replace(/\s/g, '').length / 2);
}

export function bytesToHex(bytes: Uint8Array): string {
  const pairs: string[] = [];
  for (const byte of bytes) pairs.push(byte.toString(16).padStart(2, '0'));
  return pairs.join(' ');
}

function jpegInsertMarker(kindInput: string) {
  const kind = kindInput.trim().toUpperCase();
  const app = /^APP(?:[0-9]|1[0-5])$/.test(kind) ? Number(kind.slice(3)) : null;
  if (app === null && kind !== 'COM') throw new Error('JPEG 原始块类型须为 APP0–APP15 或 COM。');
  return app === null ? 0xfe : 0xe0 + app;
}

function pngAuxiliaryKind(kindInput: string) {
  const kind = kindInput.trim();
  if (!/^[a-z][A-Za-z]{2}[A-Za-z]$/.test(kind) || kind[2] !== kind[2].toUpperCase())
    throw new Error('PNG 新增块须为符合规范的 4 字母辅助块类型。');
  return kind;
}

function webpExtensionKind(kindInput: string) {
  const kind = kindInput.padEnd(4, ' ');
  if (!/^[\x20-\x7e]{4}$/.test(kind)) throw new Error('WebP 块类型须为 4 个可打印 ASCII 字符。');
  if (webpImage.has(kind)) throw new Error('这里只能新增 WebP 附加块。');
  return kind;
}

/** 新增原始块前端的组合校验：块类型与负载长度。返回错误信息，空字符串表示通过。 */
export function newBlockValidationError(
  format: ImageFormat,
  kindInput: string,
  hex: string
): string {
  const hexError = hexValidationError(hex);
  if (hexError) return hexError;
  try {
    if (format === 'jpeg') {
      jpegInsertMarker(kindInput);
      if (hexByteCount(hex) > 65533) return 'JPEG 元数据区段超过长度上限。';
    } else if (format === 'png') {
      pngAuxiliaryKind(kindInput);
    } else {
      webpExtensionKind(kindInput);
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

export const supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
export const supportedImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

export function isSupportedImageFile(file: File) {
  return (
    supportedImageExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)) ||
    supportedImageMimeTypes.includes(file.type)
  );
}

function pngChunkBytes(type: Uint8Array, payload: Uint8Array) {
  const chunk = new Uint8Array(12 + payload.length);
  new DataView(chunk.buffer).setUint32(0, payload.length);
  chunk.set(type, 4);
  chunk.set(payload, 8);
  new DataView(chunk.buffer).setUint32(
    chunk.length - 4,
    crc32(chunk.subarray(4, chunk.length - 4))
  );
  return chunk;
}

function webpChunkBytes(type: Uint8Array, payload: Uint8Array) {
  const chunk = new Uint8Array(8 + payload.length + (payload.length & 1));
  chunk.set(type, 0);
  setU32le(chunk, 4, payload.length);
  chunk.set(payload, 8);
  return chunk;
}

interface ContainerEditOps {
  editBlock(
    structure: ImageStructure,
    bytes: Uint8Array,
    block: ImageBlock,
    payload: Uint8Array
  ): Uint8Array;
  addBlock(
    structure: ImageStructure,
    bytes: Uint8Array,
    kindInput: string,
    payload: Uint8Array
  ): Uint8Array;
}

const containerOps: Record<ImageFormat, ContainerEditOps> = {
  jpeg: {
    editBlock(structure, bytes, block, payload) {
      if (payload.length > 65533) throw new Error('JPEG 元数据区段超过长度上限。');
      const replacement = concat([
        bytes.subarray(block.start, block.dataStart - 2),
        Uint8Array.of((payload.length + 2) >> 8, (payload.length + 2) & 255),
        payload,
      ]);
      return concat([bytes.subarray(0, block.start), replacement, bytes.subarray(block.end)]);
    },
    addBlock(structure, bytes, kindInput, payload) {
      const marker = jpegInsertMarker(kindInput);
      if (payload.length > 65533) throw new Error('JPEG 元数据区段超过长度上限。');
      const replacement = concat([
        Uint8Array.of(0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255),
        payload,
      ]);
      const position =
        structure.blocks.find((block) => block.kind === '0xFFDA')?.start ?? bytes.length - 2;
      return concat([bytes.subarray(0, position), replacement, bytes.subarray(position)]);
    },
  },
  png: {
    editBlock(structure, bytes, block, payload) {
      const chunk = pngChunkBytes(bytes.subarray(block.start + 4, block.start + 8), payload);
      return concat([bytes.subarray(0, block.start), chunk, bytes.subarray(block.end)]);
    },
    addBlock(structure, bytes, kindInput, payload) {
      const kind = pngAuxiliaryKind(kindInput);
      const position =
        structure.blocks.find((block) => block.kind === 'PLTE' || block.kind === 'IDAT')?.start ??
        bytes.length - 12;
      return concat([
        bytes.subarray(0, position),
        pngChunkBytes(encoder.encode(kind), payload),
        bytes.subarray(position),
      ]);
    },
  },
  webp: {
    editBlock(structure, bytes, block, payload) {
      const chunk = webpChunkBytes(bytes.subarray(block.start, block.start + 4), payload);
      const result = concat([bytes.subarray(0, block.start), chunk, bytes.subarray(block.end)]);
      setU32le(result, 4, result.length - 8);
      return result;
    },
    addBlock(structure, bytes, kindInput, payload) {
      const kind = webpExtensionKind(kindInput);
      const last = structure.blocks.at(-1);
      const position =
        kind === 'ICCP'
          ? (structure.blocks.find((block) => block.kind === 'VP8X')?.end ?? 12)
          : last?.kind === 'Trailer'
            ? last.start
            : (last?.end ?? bytes.length);
      const result = concat([
        bytes.subarray(0, position),
        webpChunkBytes(encoder.encode(kind), payload),
        bytes.subarray(position),
      ]);
      setU32le(result, 4, result.length - 8);
      return fixWebpFlags(result);
    },
  },
};

export function editMetadataBlock(bytes: Uint8Array, id: string, hex: string) {
  const structure = inspectImage(bytes);
  const block = structure.blocks.find((item) => item.id === id && !item.image);
  if (!block || block.kind === 'Trailer') throw new Error('只能编辑可识别边界的元数据块。');
  return containerOps[structure.format].editBlock(structure, bytes, block, parseHex(hex));
}

export function addMetadataBlock(bytes: Uint8Array, kindInput: string, hex: string) {
  const structure = inspectImage(bytes);
  return containerOps[structure.format].addBlock(structure, bytes, kindInput, parseHex(hex));
}
