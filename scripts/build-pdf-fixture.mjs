#!/usr/bin/env node
/**
 * 合成测试用 PDF fixture
 *
 * 真实 12306 PDF 含 PII，不能进仓库。`ticketPdfParser.test.ts` 跑端到端需要一份
 * PDF 喂给 `extractXmlFromPDFBytes`，所以用 pdf-lib + qpdf 合成一个
 * 形态接近 12306 输出的 fixture：含 `rai_issuer_*.xml` 附件流、附件
 * 走 `/FlateDecode` 压缩（这是 12306 的常用形态）。
 *
 * 合成内容**不写真实数据**：
 * - 站点 `StationA` / `StationB`、车次 `G0001`、电子客票号 `12345`（5 位，
 *   远低于真实电子客票号的长度，不命中长数字隐私规则）
 * - 部分字段用 `xsi:nil="true"`，部分用合成值；放一个架构外字段
 *   `rai:UnknownField` 测 `xmlParser` 的 `extra` 兜底
 *
 * 跑一次：   `pnpm fixture:pdf`
 * 输出：     `src/tools/document/railway-ticket/__fixtures__/synthetic-ticket.pdf`
 *           `src/tools/document/railway-ticket/__fixtures__/synthetic-ticket.xml`
 *
 * 依赖：     `qpdf` ≥ 9.1（需在 PATH 里）。只有重新生成 fixture 才需要它——
 *           产物已提交进仓库，`pnpm test` 与 `pnpm build` 都不依赖 qpdf。
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = dirname(here);
const fixturesDir = join(pkgRoot, 'src', 'tests', '__fixtures__');
const xmlPath = join(fixturesDir, 'synthetic-ticket.xml');
const pdfOutPath = join(fixturesDir, 'synthetic-ticket.pdf');

// 合成 XML——所有数值/字符串都是合成数据，避开隐私规则
// （电子客票号用 5 位数 12345 远低于 20 位阈值）
const syntheticXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance"
      xmlns:rai="http://xbrl.mof.gov.cn/taxonomy/2021-11-30/rai"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:link="http://www.xbrl.org/2003/linkbase"
      xsi:schemaLocation="http://www.xbrl.org/2003/linkbase http://www.xbrl.org/2003/xbrl-linkbase-2003-12-31.xsd">
  <link:schemaRef xlink:href="http://www.xbrl.org/2003/xbrl-linkbase-2003-12-31.xsd" xlink:type="simple"/>
  <context id="As_Of_2099_12_31">
    <entity><identifier scheme="http://example">synth</identifier></entity>
    <period><instant>2099-12-31</instant></period>
  </context>
  <unit id="CNY"><measure>iso4217:CNY</measure></unit>
  <rai:ElectronicInvoiceRailwayETicketNumber>12345</rai:ElectronicInvoiceRailwayETicketNumber>
  <rai:DateOfIssue>2099-12-31</rai:DateOfIssue>
  <rai:IssueParty>Test Issuer</rai:IssueParty>
  <rai:IssuePartyCode xsi:nil="true"/>
  <rai:TypeOfBusiness>S</rai:TypeOfBusiness>
  <rai:DepartureStation>StationA</rai:DepartureStation>
  <rai:PhonicsOfDepartureStation>StationApinyin</rai:PhonicsOfDepartureStation>
  <rai:DestinationStation>StationB</rai:DestinationStation>
  <rai:PhonicsOfDestinationStation>StationBpinyin</rai:PhonicsOfDestinationStation>
  <rai:TrainNumber>G0001</rai:TrainNumber>
  <rai:TravelDate>2099-09-09</rai:TravelDate>
  <rai:DepartureTime>08:08</rai:DepartureTime>
  <rai:SeatLevel>SecondClass</rai:SeatLevel>
  <rai:Carriage>08</rai:Carriage>
  <rai:Seat>10A</rai:Seat>
  <rai:Fare contextRef="As_Of_2099_12_31" unitRef="CNY" decimals="2">123.45</rai:Fare>
  <rai:ETicketNumber xsi:nil="true"/>
  <rai:IdNumber xsi:nil="true"/>
  <rai:Name xsi:nil="true"/>
  <rai:TotalAmountExcludingTax contextRef="As_Of_2099_12_31" unitRef="CNY" decimals="2">115.00</rai:TotalAmountExcludingTax>
  <rai:TaxRate>0.09</rai:TaxRate>
  <rai:TaxAmount contextRef="As_Of_2099_12_31" unitRef="CNY" decimals="2">10.00</rai:TaxAmount>
  <rai:NameOfPurchaser xsi:nil="true"/>
  <rai:UnifiedSocialCreditCodeOfPurchaser xsi:nil="true"/>
  <rai:NumberOfOriginalInvoice xsi:nil="true"/>
  <rai:Remarks>Synth remark</rai:Remarks>
  <rai:UnknownField>extra-field-test</rai:UnknownField>
</xbrl>
`;

const attachmentName = 'rai_issuer_2099-12-31_synthetic-99.xml';

async function run() {
  await mkdir(fixturesDir, { recursive: true });

  // 1. 写合成 XML
  await writeFile(xmlPath, syntheticXml, 'utf-8');

  // 2. 用 pdf-lib 生成空 PDF
  const emptyPdf = await PDFDocument.create();
  emptyPdf.addPage();
  const emptyBytes = await emptyPdf.save();

  // 3. 用 qpdf 加附件到 name tree
  const tmpEmpty = join(tmpdir(), `empty-${Date.now()}.pdf`);
  const tmpOut = join(tmpdir(), `out-${Date.now()}.pdf`);
  await writeFile(tmpEmpty, emptyBytes);

  // qpdf 9+ 语法：`--add-attachment <file> --filename=<name> -- output.pdf`
  // `--filename` 写进 FileSpec 的 /F 与 /UF，并作为 name tree key
  // qpdf 12 强制等号形式：`--filename=foo`，空格形式会被拒
  await new Promise((resolve, reject) => {
    const args = [
      '--empty',
      '--pages',
      tmpEmpty,
      '--',
      '--add-attachment',
      xmlPath,
      `--filename=${attachmentName}`,
      '--',
      tmpOut,
    ];
    const p = spawn('qpdf', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    p.on('exit', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`qpdf exit ${code}: ${stderr}`));
    });
    p.on('error', reject);
  });

  // 4. 移动到 fixtures 目录
  const outBytes = await readFile(tmpOut);
  await writeFile(pdfOutPath, outBytes);

  // 5. 清理临时文件
  await unlink(tmpEmpty).catch(() => {});
  await unlink(tmpOut).catch(() => {});

  console.log(`fixture PDF: ${pdfOutPath}  (${outBytes.length} bytes)`);
  console.log(`fixture XML: ${xmlPath}`);
}

run().catch((err) => {
  console.error('fixture 生成失败:', err);
  process.exit(1);
});
