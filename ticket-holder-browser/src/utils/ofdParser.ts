/**
 * OFD 文件解析模块
 * OFD 文件实际为 ZIP 压缩包，解压后在 Doc_0/Attachs 目录查找 rai_issuer_*.xml
 */
import { unzipSync, strFromU8 } from 'fflate'

export interface OFDParseResult {
  xmlContent: string
  fileName: string
}

/**
 * 从 OFD 文件中提取第一个以 rai_issuer_ 开头的 XML 附件
 */
export async function extractXmlFromOFD(file: File): Promise<OFDParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  
  try {
    // 解压 OFD (ZIP)
    const unzipped = unzipSync(uint8Array)
    
    // 查找 Doc_0/Attachs 目录下的 rai_issuer_*.xml
    const attachsPrefix = 'Doc_0/Attachs/'
    const candidates: { path: string; data: Uint8Array }[] = []
    
    for (const [path, data] of Object.entries(unzipped)) {
      if (path.startsWith(attachsPrefix) && path.endsWith('.xml')) {
        const fileName = path.substring(attachsPrefix.length)
        if (fileName.startsWith('rai_issuer_')) {
          candidates.push({ path: fileName, data })
        }
      }
    }
    
    if (candidates.length === 0) {
      throw new Error('未在 OFD 文件中找到 rai_issuer_ 开头的 XML 附件')
    }
    
    // 返回第一个匹配的
    const target = candidates[0]!
    const xmlContent = strFromU8(target.data)
    
    return {
      xmlContent,
      fileName: target.path
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OFD 解析失败: ${error.message}`)
    }
    throw new Error('OFD 解析失败: 未知错误')
  }
}
