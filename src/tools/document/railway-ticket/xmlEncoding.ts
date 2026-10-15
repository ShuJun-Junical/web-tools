/**
 * XML 字节解码模块
 *
 * OFD 与 PDF 两条路径都要把「附件 XML 的原始字节」还原成字符串，口径必须一致——
 * 否则同一个票据换个格式打开就乱码，很难排查。所以解码逻辑只保留这一份。
 *
 * 为什么不能硬 UTF-8：OFD §8.4 明确「XML 文件应采用 UTF-8 或 GB 18030 编码」，
 * 电子发票 / 国库票据等非 12306 渠道的票据大量走 GB18030。`fflate` 的
 * `strFromU8` 内部固定 UTF-8，用它会让 GB18030 票面整片 U+FFFD。
 */

/**
 * 按 BOM / encoding 声明 / 兜底选一个 TextDecoder
 *
 * 决策顺序：
 * 1. BOM：UTF-8 (EF BB BF) / UTF-16BE (FE FF) / UTF-16LE (FF FE)
 * 2. XML 声明 `<?xml encoding="...">`
 * 3. GBK / GB18030 / GB2312 都用 gb18030（GB18030 是超集）
 * 4. 默认 UTF-8
 *
 * 声明里写出来的编码找不到对应解码器（譬如生僻自定义编码）就回退 UTF-8。
 */
function getDecoder(bytes: Uint8Array): TextDecoder {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8');
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be');
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le');
  }

  // 字节够长时扫 XML 声明拿 encoding；扫前 200 字节足够覆盖各种编码声明
  const head = new TextDecoder('utf-8', { fatal: false }).decode(
    bytes.subarray(0, Math.min(200, bytes.length))
  );
  const m = head.match(/<\?xml[^>]*\bencoding=["']([^"']+)["']/i);
  if (m && m[1]) {
    const declared = m[1].toLowerCase();
    const normalized =
      declared === 'gbk' || declared === 'gb2312' || declared === 'gb18030' ? 'gb18030' : declared;
    try {
      return new TextDecoder(normalized);
    } catch {
      // 浏览器不支持该编码（如自定义别名），回退 UTF-8
    }
  }
  return new TextDecoder('utf-8');
}

/**
 * 把 XML 字节按 BOM / 声明 / 兜底解码成字符串
 *
 * 这里不做 `fatal: true`：GB18030 中混进几个非字符字节是常见现象，宁可
 * 拿到含 U+FFFD 的串也不能直接抛错让上层以为整个文件是坏的。真的坏到
 * 解不开，下游 fast-xml-parser 会自己报「非 XML」。
 */
export function decodeXmlBytes(bytes: Uint8Array): string {
  // 先按 BOM / 声明选解码器，失败回退 GB18030（OFD 规范允许）
  try {
    return getDecoder(bytes).decode(bytes);
  } catch {
    try {
      return new TextDecoder('gb18030').decode(bytes);
    } catch {
      // Node 等没有 gb18030 解码器的环境，最后再退一次 UTF-8
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}
