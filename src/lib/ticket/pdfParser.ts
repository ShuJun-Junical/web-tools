/**
 * PDF 文件解析模块
 *
 * 从 PDF 嵌入附件（`rai_issuer_*.xml`）里提取 XML 文本。本模块只做"PDF 标准
 * 解码"——把 PDF 字节流还原成字符串；XML → `TicketData` 是 `xmlParser.ts` 的事。
 *
 * 提取链路里要解两道 PDF 层编码，缺一就会让前端拿到废字符串：
 *
 * 1. **流 /Filter**。`stream.getContents()` 在 `PDFRawStream` 上返回的是**未应用
 *    /Filter 的原始字节**。12306 输出的 PDF 附件常用 `/FlateDecode`，首字节
 *    就是 zlib magic `0x78 0x9C`，被 `TextDecoder('utf-8')` 一过就成 U+FFFD
 *    替换符，再交给 `xmlParser` 就只剩乱码 + 全 null 字段。`decodePDFRawStream()`
 *    按 /Filter 串起对应的解码器链（FlateDecode / LZWDecode / ASCII85Decode /
 *    ASCIIHexDecode / RunLengthDecode）。
 *
 * 2. **FileSpec /F / /UF 字符串字段**。按 PDF 1.7 §7.11.2，FileSpec 里 `/F` 是
 *    人类可读的文件名（PDFDocEncoding 或 UTF-16BE BOM），`/UF` 是显式
 *    UTF-16BE 版本。Name tree key 在不同生成器下形态差异巨大（PDFName /
 *    PDFString / PDFHexString，12306 甚至直接写数字 `0`），所以筛附件必须
 *    看 FileSpec 的 `/F` / `/UF`，不能拿 name tree key 匹配。
 */
import type { PDFDict, PDFRawStream, PDFRef } from 'pdf-lib';
import { decodeXmlBytes } from './xmlEncoding';

export interface PDFParseResult {
  xmlContent: string;
  fileName: string;
}

/**
 * 把 PDF 字符串类对象还原成原始字符串
 *
 * 三种输入：
 * - `PDFName` —— 直接是 PDFDocEncoding 名字（`asString()`）
 * - `PDFString` —— 含 BOM 的 UTF-16BE 串或 PDFDocEncoding 串（`decodeText()`）
 * - `PDFHexString` —— 十六进制编码的同样两种串（`decodeText()`）
 *
 * `decodeText()` 内部按 BOM 切 UTF-16BE / PDFDocEncoding，所以不用在这里判 BOM。
 * 返回 null 用于无法识别的类型，让调用方按需兜底。
 *
 * pdf-lib 是动态加载的，`instanceof` 需要运行时类引用，所以把整个 lib 传进来
 * 而不是模块顶层解构。
 */
function decodePDFString(lib: typeof import('pdf-lib'), value: unknown): string | null {
  if (value instanceof lib.PDFName) return value.asString();
  if (value instanceof lib.PDFString) return value.decodeText();
  if (value instanceof lib.PDFHexString) return value.decodeText();
  return null;
}

let pdfLibPromise: Promise<typeof import('pdf-lib')> | null = null;

/**
 * 动态加载 pdf-lib
 *
 * pdf-lib 压缩后约 400 kB，占了铁路客票页面 chunk 的绝大部分。OFD 才是 12306 的
 * 主流格式，没必要让只上传 OFD 的用户先付这笔首访成本，所以等真要解析 PDF 时
 * 才加载，并缓存 Promise，避免同一页面反复点击重复下载。
 */
function loadPdfLib(): Promise<typeof import('pdf-lib')> {
  pdfLibPromise ??= import('pdf-lib');
  return pdfLibPromise;
}

/**
 * 从 PDF 字节里提取第一个以 rai_issuer_ 开头的 XML 附件
 *
 * 暴露为单独函数是给单测用的：测试里没有 `File` 对象，直接拿 `Uint8Array`
 * 喂过来能少写一层 polyfill。生产环境由 `extractXmlFromPDF` 间接调用。
 */
export async function extractXmlFromPDFBytes(bytes: Uint8Array): Promise<PDFParseResult> {
  try {
    const lib = await loadPdfLib();
    const { PDFDocument, PDFName, decodePDFRawStream } = lib;
    const pdfDoc = await PDFDocument.load(bytes);

    // 获取嵌入文件 - 使用正确的 pdf-lib API
    const catalogDict = pdfDoc.catalog as PDFDict;
    const namesRef = catalogDict.get(PDFName.of('Names'));
    if (!namesRef) {
      throw new Error('PDF 中未找到 Names 字典');
    }

    const namesDict = pdfDoc.context.lookup(namesRef) as PDFDict;
    const embeddedFilesRef = namesDict.get(PDFName.of('EmbeddedFiles'));
    if (!embeddedFilesRef) {
      throw new Error('PDF 中未找到嵌入文件');
    }

    const embeddedFilesDict = pdfDoc.context.lookup(embeddedFilesRef) as PDFDict;
    const namesArrayRef = embeddedFilesDict.get(PDFName.of('Names'));
    if (!namesArrayRef) {
      throw new Error('PDF 嵌入文件结构异常');
    }

    const namesArray = pdfDoc.context.lookup(namesArrayRef);
    if (!Array.isArray((namesArray as unknown as { array: unknown[] }).array)) {
      throw new Error('PDF Names 不是数组');
    }

    // Names 数组格式: [name1, fileSpec1, name2, fileSpec2, ...]
    const array = (namesArray as unknown as { array: unknown[] }).array;
    for (let i = 0; i < array.length; i += 2) {
      const fileSpecRef = array[i + 1] as PDFRef | undefined;
      if (!fileSpecRef) continue;

      // FileSpec 才是附件的真相：拿它的 /F（PDFDocEncoding）/ /UF（UTF-16BE）
      // 取可读文件名。Name tree key 在 12306 这边是数字 `0`，不能当筛选项。
      const fileSpec = pdfDoc.context.lookup(fileSpecRef) as PDFDict;
      if (!fileSpec) continue;

      const fileName =
        decodePDFString(lib, fileSpec.get(PDFName.of('F'))) ??
        decodePDFString(lib, fileSpec.get(PDFName.of('UF')));
      if (!fileName) continue;

      if (fileName.startsWith('rai_issuer_') && fileName.endsWith('.xml')) {
        // 获取嵌入文件流 (/EF -> /F -> /UF)
        const efDictRef = fileSpec.get(PDFName.of('EF')) as PDFRef | undefined;
        if (!efDictRef) continue;

        const efDict = pdfDoc.context.lookup(efDictRef) as PDFDict;
        const streamRef =
          (efDict.get(PDFName.of('F')) as PDFRef | undefined) ??
          (efDict.get(PDFName.of('UF')) as PDFRef | undefined);
        if (!streamRef) continue;

        // 流本体：附件这一层按规范就是 PDFRawStream（未应用 /Filter）。
        // 强转避免 pdf-lib 类型是 PDFStream 时 getContents() 跳过 inflate。
        const rawStream = pdfDoc.context.lookup(streamRef) as PDFRawStream;
        if (!rawStream) continue;

        // 按 /Filter 解码链：FlateDecode / LZWDecode / ASCII85Decode /
        // ASCIIHexDecode / RunLengthDecode，多个 filter 串行也由它处理。
        const decoded = decodePDFRawStream(rawStream);
        const uint8Array = decoded.decode();

        // 与 OFD 路径共用同一套解码策略：12306 自身是 UTF-8，但非 12306 渠道
        // 的附件可能是 GB18030，硬 UTF-8 会整片 U+FFFD。
        const xmlContent = decodeXmlBytes(uint8Array);

        return {
          xmlContent,
          fileName,
        };
      }
    }

    throw new Error('未在 PDF 中找到 rai_issuer_ 开头的 XML 附件');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`PDF 解析失败: ${error.message}`);
    }
    throw new Error('PDF 解析失败: 未知错误');
  }
}

/**
 * 从 `File` 提取附件 —— 生产入口。`file.arrayBuffer()` 在浏览器与
 * Node 24+ 都能跑，把 `File` 转成 `Uint8Array` 后委托给 `extractXmlFromPDFBytes`。
 */
export async function extractXmlFromPDF(file: File): Promise<PDFParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  return extractXmlFromPDFBytes(new Uint8Array(arrayBuffer));
}
