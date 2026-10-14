/// <reference types="node" />
/**
 * pdfParser.test.ts
 *
 * 端到端：用合成 fixture PDF 验 `extractXmlFromPDFBytes` 能拿到 rai_issuer_*.xml
 * 附件，并交给 `parseXBRL` 解析出预期字段。fixture PDF 由
 * `scripts/build-pdf-fixture.mjs` 用 pdf-lib + qpdf 合成，附件流走
 * `/FlateDecode`（12306 真实 PDF 的形态），所以这次跑通 = 真实票也能跑通。
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { extractXmlFromPDFBytes } from './pdfParser'
import { parseXBRL } from './xmlParser'

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(here, '__fixtures__', 'synthetic-ticket.pdf')

describe('extractXmlFromPDFBytes', () => {
  it('从合成 fixture PDF 拿到 rai_issuer_*.xml 附件', async () => {
    const bytes = await readFile(fixturePath)
    const result = await extractXmlFromPDFBytes(bytes)

    expect(result.fileName).toBe('rai_issuer_2099-12-31_synthetic-99.xml')
    expect(result.xmlContent).toContain('<?xml version="1.0" encoding="UTF-8"')
    expect(result.xmlContent).toContain('<rai:TrainNumber>G0001</rai:TrainNumber>')
    expect(result.xmlContent).toContain('<rai:Fare')
    // 关键：附件流走 /FlateDecode，能被正确 inflate，说明 decodePDFRawStream 路径通
    expect(result.xmlContent.length).toBeGreaterThan(1000)
  })

  it('端到端：附件 XML 喂给 parseXBRL 后字段正确填充', async () => {
    const bytes = await readFile(fixturePath)
    const { xmlContent } = await extractXmlFromPDFBytes(bytes)
    const { ticket, extra } = parseXBRL(xmlContent)

    // TrainNumber 保持 string（G0001 不是数字）
    expect(ticket.TrainNumber).toBe('G0001')
    // Fare 是 number
    expect(ticket.Fare).toBe(123.45)
    // TaxRate 是 number（percent）
    expect(ticket.TaxRate).toBe(0.09)
    // TaxAmount 是 number
    expect(ticket.TaxAmount).toBe(10)
    // DateOfIssue 是 date 字符串
    expect(ticket.DateOfIssue).toBe('2099-12-31')
    expect(ticket.DepartureStation).toBe('StationA')
    expect(ticket.DestinationStation).toBe('StationB')
    // xsi:nil 节点必须是 null
    expect(ticket.IssuePartyCode).toBeNull()
    expect(ticket.ETicketNumber).toBeNull()
    expect(ticket.IdNumber).toBeNull()
    // 架构外元素进 extra，不进 ticket
    expect((ticket as unknown as Record<string, unknown>).UnknownField).toBeUndefined()
    expect(extra.UnknownField).toBe('extra-field-test')
  })
})

describe('extractXmlFromPDFBytes 错误处理', () => {
  it('非法字节应抛错', async () => {
    // 删掉 name tree 难，但至少能跑通"非法字节"路径
    const garbage = new Uint8Array([0, 1, 2, 3])
    await expect(extractXmlFromPDFBytes(garbage)).rejects.toThrow(/PDF 解析失败/)
  })
})
