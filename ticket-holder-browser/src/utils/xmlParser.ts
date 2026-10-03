/**
 * XML/XBRL 解析模块
 * 解析铁路电子客票 XBRL 实例为字典格式
 */
import { XMLParser } from 'fast-xml-parser'

export interface ParsedData {
  [key: string]: any
}

/**
 * 解析 XBRL XML 为字典格式
 */
export function parseXBRL(xmlContent: string): ParsedData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true
  })
  
  const parsed = parser.parse(xmlContent)
  const xbrl = parsed.xbrl || parsed
  
  const result: ParsedData = {}
  
  // 遍历所有字段
  for (const [key, value] of Object.entries(xbrl)) {
    // 跳过非业务字段
    if (key.startsWith('@_') || key === 'context' || key === 'unit' || key === 'link:schemaRef') {
      continue
    }
    
    // 提取本地名（移除命名空间前缀）
    const localName: string = key.includes(':') ? key.split(':')[1]! : key
    
    if (typeof value === 'object' && value !== null) {
      const obj = value as any
      
      // 处理 xsi:nil="true"
      if (obj['@_xsi:nil'] === 'true') {
        result[localName] = null
        continue
      }
      
      // 判断是否为数值类型（有 unitRef 或 decimals 属性）
      if (obj['@_unitRef'] || obj['@_decimals']) {
        const numericValue: any = {
          value: obj['#text'] || null
        }
        
        if (obj['@_unitRef']) {
          numericValue.unit = obj['@_unitRef']
        }
        
        if (obj['@_decimals']) {
          numericValue.decimals = parseInt(obj['@_decimals'], 10)
        }
        
        result[localName] = numericValue
      } else {
        // 普通文本值
        result[localName] = obj['#text'] || obj
      }
    } else {
      // 简单文本值
      result[localName] = value
    }
  }
  
  return result
}
