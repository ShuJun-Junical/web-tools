/**
 * PDF 文件解析模块
 * 使用 pdf-lib 从 PDF 嵌入附件中提取 rai_issuer_*.xml
 */
import { PDFDocument, PDFDict, PDFName, PDFStream } from 'pdf-lib'

export interface PDFParseResult {
  xmlContent: string
  fileName: string
}

/**
 * 从 PDF 文件中提取第一个以 rai_issuer_ 开头的 XML 附件
 */
export async function extractXmlFromPDF(file: File): Promise<PDFParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  
  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    
    // 获取嵌入文件 - 使用正确的 pdf-lib API
    const catalogDict = pdfDoc.catalog as PDFDict
    const namesRef = catalogDict.get(PDFName.of('Names'))
    if (!namesRef) {
      throw new Error('PDF 中未找到 Names 字典')
    }
    
    const namesDict = pdfDoc.context.lookup(namesRef) as PDFDict
    const embeddedFilesRef = namesDict.get(PDFName.of('EmbeddedFiles'))
    if (!embeddedFilesRef) {
      throw new Error('PDF 中未找到嵌入文件')
    }
    
    const embeddedFilesDict = pdfDoc.context.lookup(embeddedFilesRef) as PDFDict
    const namesArrayRef = embeddedFilesDict.get(PDFName.of('Names'))
    if (!namesArrayRef) {
      throw new Error('PDF 嵌入文件结构异常')
    }
    
    const namesArray = pdfDoc.context.lookup(namesArrayRef)
    if (!Array.isArray((namesArray as any).array)) {
      throw new Error('PDF Names 不是数组')
    }
    
    // Names 数组格式: [name1, fileSpec1, name2, fileSpec2, ...]
    const array = (namesArray as any).array
    for (let i = 0; i < array.length; i += 2) {
      const nameObj = array[i]
      const fileSpecRef = array[i + 1]
      
      if (!fileSpecRef) continue
      
      const fileName = nameObj.toString().replace(/^\(|\)$/g, '')
      
      if (fileName.startsWith('rai_issuer_') && fileName.endsWith('.xml')) {
        // 获取文件规范
        const fileSpec = pdfDoc.context.lookup(fileSpecRef) as PDFDict
        if (!fileSpec) continue
        
        // 获取嵌入文件流 (/EF -> /F)
        const efDictRef = fileSpec.get(PDFName.of('EF'))
        if (!efDictRef) continue
        
        const efDict = pdfDoc.context.lookup(efDictRef) as PDFDict
        const streamRef = efDict.get(PDFName.of('F')) || efDict.get(PDFName.of('UF'))
        if (!streamRef) continue
        
        const stream = pdfDoc.context.lookup(streamRef) as PDFStream
        if (!stream) continue
        
        // 提取流数据
        const uint8Array = stream.getContents()
        const xmlContent = new TextDecoder('utf-8').decode(uint8Array)
        
        return {
          xmlContent,
          fileName
        }
      }
    }
    
    throw new Error('未在 PDF 中找到 rai_issuer_ 开头的 XML 附件')
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`PDF 解析失败: ${error.message}`)
    }
    throw new Error('PDF 解析失败: 未知错误')
  }
}
