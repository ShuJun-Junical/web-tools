/**
 * OFD 文件解析模块
 *
 * OFD 是 GB/T 33190-2017 定义的版式文档格式，本质是 zip 容器。本模块把 zip
 * 里的嵌入附件（`rai_issuer_*.xml`）还原成字符串；XML → `TicketData` 是
 * `xmlParser.ts` 的事。
 *
 * 三个 PDF 路径上没有、OFD 路径上才有的事：
 *
 * 1. **按 OFD 规范读 `OFD.xml` + `Attachments.xml`，别硬编码路径**。原代码
 *    写死 `Doc_0/Attachs/`，12306 当前能用，但 OFD 1.1 §7.5 规定附件位置在
 *    `OFD.xml` 的 `ofd:DocRoot` 元素里声明，相对路径在
 *    `<docRoot所在目录>/Attachs/Attachments.xml` 的 `ofd:Attachment/ofd:FileLoc`
 *    里给。任何 `Doc_N` 编号变化或多文档 OFD，硬编码路径都会漏。
 *    无 `Attachments.xml` 的老版本 OFD，回退到扫 `<docDir>/Attachs/` 全 rai_issuer_*.xml。
 *
 * 2. **按 BOM / encoding 声明解码，别强制 UTF-8**。OFD §8.4 明确"XML 文件应
 *    采用 UTF-8 或 GB 18030 编码"。12306 当前给 UTF-8，但电子发票 / 国库
 *    票据等非 12306 渠道的 OFD 大量走 GB18030，硬 UTF-8 会让票面整片
 *    U+FFFD。解码策略见 `xmlEncoding.ts`，PDF 路径共用同一份。
 *
 * 3. **不要在模块顶层碰 `TextDecoder`**。`decodeXmlBytes` 内部按需构造，
 *    Node 等缺少 gb18030 解码器的环境才会走到兜底分支，不影响主流程。
 */
import { unzipSync } from 'fflate';
import { decodeXmlBytes } from './xmlEncoding';

export interface OFDParseResult {
  xmlContent: string;
  fileName: string;
}

/**
 * 从 `OFD.xml` 里抽出 `ofd:DocRoot` 的字符串值
 *
 * 用正则而不是再起一个 XML 解析器，OFD.xml 顶层结构简单，正则足够——
 * 主要收益是少一次 fast-xml-parser 启动开销，且不依赖 OFD.xml 自身编码
 * 是否能被 XML parser 接受（`decodeXmlBytes` 已经处理了）。
 */
function extractDocRoot(ofdXml: string): { docRoot: string; docDir: string } {
  const m = ofdXml.match(/<ofd:DocRoot>([^<]+)<\/ofd:DocRoot>/);
  if (!m || !m[1]) {
    throw new Error('OFD.xml 缺少 DocRoot 元素');
  }
  const docRoot = m[1].trim();
  if (!docRoot.includes('/')) {
    throw new Error(`OFD DocRoot 路径非法: ${docRoot}`);
  }
  const slash = docRoot.lastIndexOf('/');
  const docDir = docRoot.substring(0, slash + 1); // 含末尾 /
  return { docRoot, docDir };
}

/**
 * 从 `Attachments.xml` 抽出所有 `ofd:FileLoc`
 *
 * 跟 DocRoot 同理，正则足够、避免起 XML 解析器。
 * 兼容自闭合 `<ofd:Attachment .../>` 与成对标签。
 */
function extractFileLocs(attachmentsXml: string): string[] {
  const locs: string[] = [];
  // 自闭合
  const selfClosing = /<ofd:Attachment\b[^>]*\/>\s*/g;
  let m: RegExpExecArray | null;
  while ((m = selfClosing.exec(attachmentsXml)) !== null) {
    const locMatch = m[0].match(/\bFileLoc=["']([^"']+)["']/i);
    if (locMatch && locMatch[1]) locs.push(locMatch[1].trim());
  }
  // 成对标签
  const paired = /<ofd:Attachment\b[^>]*>([\s\S]*?)<\/ofd:Attachment>/g;
  while ((m = paired.exec(attachmentsXml)) !== null) {
    const inner = m[1];
    if (!inner) continue;
    const locMatch = inner.match(/<ofd:FileLoc>([^<]+)<\/ofd:FileLoc>/);
    if (locMatch && locMatch[1]) locs.push(locMatch[1].trim());
  }
  return locs;
}

/**
 * 从 OFD 字节里提取第一个以 rai_issuer_ 开头的 XML 附件
 *
 * 暴露为单独函数是给单测用的：测试里没有 `File` 对象，直接拿 `Uint8Array`
 * 喂过来能少写一层 polyfill。生产环境由 `extractXmlFromOFD` 间接调用。
 */
export async function extractXmlFromOFDBytes(bytes: Uint8Array): Promise<OFDParseResult> {
  try {
    const unzipped = unzipSync(bytes);

    // 1. 读 OFD.xml 拿 DocRoot
    const ofdXmlBytes = unzipped['OFD.xml'];
    if (!ofdXmlBytes) {
      throw new Error('OFD 文件缺少 OFD.xml 顶层描述');
    }
    const { docRoot, docDir } = extractDocRoot(decodeXmlBytes(ofdXmlBytes));

    // 2. 优先按 OFD 规范从 Attachments.xml 取附件清单
    const attachmentsXmlBytes = unzipped[docDir + 'Attachs/Attachments.xml'];
    let fileLocs: string[] = [];
    if (attachmentsXmlBytes) {
      fileLocs = extractFileLocs(decodeXmlBytes(attachmentsXmlBytes));
    }

    // 3. 筛 rai_issuer_*.xml 附件
    const candidates: { path: string; data: Uint8Array; fileName: string }[] = [];
    const seen = new Set<string>();
    const consider = (path: string) => {
      if (!path.endsWith('.xml')) return;
      const fileName = path.substring(path.lastIndexOf('/') + 1);
      if (!fileName.startsWith('rai_issuer_')) return;
      const data = unzipped[path];
      if (!data) return;
      if (seen.has(path)) return;
      seen.add(path);
      candidates.push({ path, data, fileName });
    };
    for (const loc of fileLocs) {
      consider(loc);
    }
    if (candidates.length === 0) {
      // 兜底：没有 Attachments.xml 或里面没列 rai_issuer_*，
      // 扫 docDir + Attachs/ 下所有 .xml，兼容老版本 OFD。
      const attachsPrefix = docDir + 'Attachs/';
      for (const path of Object.keys(unzipped)) {
        if (!path.startsWith(attachsPrefix)) continue;
        consider(path);
      }
    }

    if (candidates.length === 0) {
      throw new Error(`未在 OFD 文件（DocRoot=${docRoot}）中找到 rai_issuer_ 开头的 XML 附件`);
    }

    const target = candidates[0]!;
    const xmlContent = decodeXmlBytes(target.data);

    return {
      xmlContent,
      fileName: target.fileName,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OFD 解析失败: ${error.message}`);
    }
    throw new Error('OFD 解析失败: 未知错误');
  }
}

/**
 * 从 `File` 提取附件 —— 生产入口。`file.arrayBuffer()` 在浏览器与
 * Node 24+ 都能跑，把 `File` 转成 `Uint8Array` 后委托给 `extractXmlFromOFDBytes`。
 */
export async function extractXmlFromOFD(file: File): Promise<OFDParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  return extractXmlFromOFDBytes(new Uint8Array(arrayBuffer));
}
