/// <reference lib="webworker" />
import { parseMetadata, writeMetadata } from '@uswriting/exiftool';
import wasmUrl from '@6over3/zeroperl-ts/zeroperl.wasm?url';
import { addMetadataBlock, clearImageMetadata, editMetadataBlock, inspectImage, sameImageData } from './image-container';
import { customTagConfig } from './exif-custom';
import { metadataDumpArgs, orientationFromDump } from './exif-orientation';
import type { ExifAction, ExifField, ExifResult } from './exif-types';

function progress(id: number, stage: string, percent?: number) {
  self.postMessage({ id, type: 'progress', stage, percent });
}

const localWasmFetch = () => fetch(wasmUrl);

// zeroperl-ts uses window/document existence to choose fetch over node:fs.
// A dedicated worker has neither even though it supports the required fetch API.
// 依赖升级时若上游环境探测方式变化，这里会失效；顶部 throw 会以“启动失败”形式暴露，勿静默兜底。
Object.assign(self, { window: self, document: {} });
if (typeof fetch !== 'function') throw new Error('此浏览器环境不支持 Worker fetch，无法加载本地处理引擎。');

function readBytes(file: File, id: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = event => progress(id, '读取文件', event.lengthComputable ? Math.round(event.loaded / event.total * 100) : undefined);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('读取图片失败。'));
    reader.readAsArrayBuffer(file);
  });
}

function fieldsFromJson(json: string): ExifField[] {
  const parsed = JSON.parse(json) as Record<string, unknown>[];
  const structureNames = new Set(['ImageWidth', 'ImageHeight', 'BitDepth', 'ColorType', 'Compression', 'Filter', 'Interlace', 'ImageSize', 'Megapixels']);
  return Object.entries(parsed[0] ?? {})
    .filter(([key]) => key.includes(':') && !/^(System|File|ExifTool|Composite):/.test(key) &&
      !structureNames.has(key.slice(key.indexOf(':') + 1)))
    .map(([key, value]) => {
      const separator = key.indexOf(':');
      return { key, group: key.slice(0, separator), name: key.slice(separator + 1),
        value: typeof value === 'string' ? value : JSON.stringify(value) };
    });
}

async function describe(file: File, original: File, id: number, warning = ''): Promise<ExifResult> {
  progress(id, '检查文件结构');
  const bytes = await readBytes(file, id);
  let structure;
  try {
    structure = inspectImage(bytes);
  } catch (error) {
    if (!warning) throw error;
    const originalStructure = inspectImage(new Uint8Array(await original.arrayBuffer()));
    return { file, fields: [], blocks: [], format: originalStructure.format, animated: originalStructure.animated,
      unsupportedMultiImage: false, imageUnchanged: null, signed: false,
      warning: `${warning}；文件结构无法解析：${String(error)}` };
  }
  progress(id, '解析元数据');
  const parsed = await parseMetadata(file, { args: metadataDumpArgs, fetch: localWasmFetch });
  const fields = parsed.success ? fieldsFromJson(parsed.data) : [];
  if (!parsed.success) warning = [warning, `元数据解析失败：${parsed.error}`].filter(Boolean).join('；');
  progress(id, '校验图像数据');
  const originalBytes = file === original ? bytes : await readBytes(original, id);
  let imageUnchanged: boolean | null = null;
  try { imageUnchanged = sameImageData(originalBytes, bytes); } catch { imageUnchanged = null; }
  return { file, fields, blocks: structure.blocks.filter(block => !block.image),
    format: structure.format, animated: structure.animated,
    unsupportedMultiImage: structure.unsupportedMultiImage,
    imageUnchanged, signed: structure.blocks.some(block => block.signed) || fields.some(field => /C2PA|JUMBF/i.test(field.key)), warning };
}

async function execute(action: ExifAction, id: number): Promise<ExifResult> {
  if (action.type === 'inspect') return describe(action.file, action.original, id);
  const sourceBytes = await readBytes(action.file, id);
  const structure = inspectImage(sourceBytes);
  if (structure.unsupportedMultiImage) throw new Error('此多图 JPEG 变体暂不支持编辑导出。');
  let output: Uint8Array;
  let warning = '';

  if (action.type === 'clear') {
    progress(id, action.mode === 'strong' ? '强力清理元数据' : '普通清理元数据');
    const orientationDump = action.mode === 'normal'
      ? (await parseMetadata(action.file, { args: metadataDumpArgs, fetch: localWasmFetch })) : null;
    // 只保留主 EXIF（IFD0）方向：浏览器解码 JPEG/PNG/WebP 时应用的就是它，
    // 本 wasm 版 ExifTool 的 --Orientation exact 查询无效，且 XMP 来源的值不应回写。
    const orientation = orientationDump?.success ? orientationFromDump(orientationDump.data) : undefined;
    // JPEG 走手写最小 EXIF 段（注入位置必须在 APP0 之后）而非 exiftool 回写：
    // exiftool 可能重排或规范化 APP 段，破坏“图像块字节完全一致”的校验承诺；
    // PNG/WebP 无同等低成本路径，仍经 exiftool 写入，数字值须带 -n 否则 PrintConv 反查失败。
    output = clearImageMetadata(sourceBytes, action.mode, orientation);
    if (action.mode === 'normal' && orientation && structure.format !== 'jpeg') {
      progress(id, '保留图片方向');
      const cleaned = new File([output as BlobPart], action.file.name, { type: action.file.type });
      const oriented = await writeMetadata(cleaned, { Orientation: orientation }, { args: ['-n'], fetch: localWasmFetch });
      if (!oriented.success) throw new Error(`无法保留图片方向，普通清理已取消：${oriented.error}`);
      output = new Uint8Array(oriented.data);
    }
  } else if (action.type === 'raw') {
    progress(id, '修改原始元数据块');
    output = editMetadataBlock(sourceBytes, action.blockId, action.hex);
    warning = '原始块已修改，字段含义及内部结构未经验证。';
  } else if (action.type === 'addBlock') {
    progress(id, '新增原始附加块');
    output = addMetadataBlock(sourceBytes, action.kind, action.hex);
    warning = '原始块已新增，字段含义及内部结构未经验证。';
  } else {
    progress(id, '写入字段');
    let written;
    if (action.type === 'add') {
      const directTag = `${action.group}:${action.identifier}`;
      written = await writeMetadata(action.file, { [directTag]: action.value }, { args: ['-n'], fetch: localWasmFetch });
      if (!written.success) {
        const custom = customTagConfig(action);
        const config = new File([custom.config], 'custom-exif.config', { type: 'text/plain' });
        written = await writeMetadata(action.file, { [custom.tag]: action.value }, { args: ['-n'], config, fetch: localWasmFetch });
      }
    } else {
      const args = action.value === undefined ? ['-n', `-${action.tag}=`] : ['-n'];
      const tags = action.value === undefined ? {} : { [action.tag]: action.value };
      written = await writeMetadata(action.file, tags, { args, fetch: localWasmFetch });
    }
    if (!written.success) throw new Error(`字段写入失败：${written.error}。可改用所属元数据块的原始编辑。`);
    output = new Uint8Array(written.data);
  }

  const file = new File([output as BlobPart], action.file.name, { type: action.file.type });
  if (action.type === 'clear' && action.mode === 'strong') {
    progress(id, '检查图片可显示性');
    const bitmap = await createImageBitmap(file);
    bitmap.close();
  }
  const result = await describe(file, action.original, id, warning);
  if (action.type === 'clear' && (result.imageUnchanged !== true || (action.mode === 'strong' && (result.blocks.length > 0 || result.warning !== '')))) {
    throw new Error('清理结果未通过图像数据或元数据校验，未生成新版本。');
  }
  if ((action.type === 'write' || action.type === 'add') && result.imageUnchanged !== true) {
    throw new Error('字段写入改变了原始图像数据，未生成新版本。');
  }
  if ((action.type === 'raw' || action.type === 'addBlock') && result.imageUnchanged !== true)
    result.warning = [result.warning, '图像数据无法确认与原文件一致。'].join('；');
  return result;
}

self.onmessage = async (event: MessageEvent<{ id: number; action: ExifAction }>) => {
  const { id, action } = event.data;
  try {
    const result = await execute(action, id);
    self.postMessage({ id, type: 'result', result });
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
