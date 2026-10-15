#!/usr/bin/env node
/**
 * 合成测试用 OFD fixture
 *
 * OFD 是 GB/T 33190-2017 定义的版式文档格式，本质是 zip 容器。`ticketOfdParser.test.ts`
 * 端到端需要一份 OFD 喂给 `extractXmlFromOFDBytes`，所以用 fflate 的 `zipSync`
 * 合成。附件 XML 复用 `__fixtures__/synthetic-ticket.xml`（PDF fixture 那份），
 * 不写真实数据。
 *
 * 内容**不写真实数据**：5 位电子客票号、合成站名/车次，避开隐私规则的
 * `\d{20,25}` 长数字阈值。
 *
 * 跑一次：   `pnpm fixture:ofd`
 * 输出：     `src/tests/__fixtures__/synthetic-ticket.ofd`
 *
 * 依赖：     `fflate`（项目内已有）。无外部 CLI 依赖。
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = dirname(here);
const fixturesDir = join(pkgRoot, 'src', 'tests', '__fixtures__');
const attachmentName = 'rai_issuer_2099-12-31_synthetic-99.xml';

const ofdXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016" DocType="OFD" Version="1.1">
  <ofd:DocBody>
    <ofd:DocInfo>
      <ofd:DocID>synth-ofd-fixture</ofd:DocID>
      <ofd:CreationDate>2099-09-09</ofd:CreationDate>
    </ofd:DocInfo>
    <ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot>
  </ofd:DocBody>
</ofd:OFD>
`;

const attachmentsXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Attachments xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Attachment ID="500" Name="${attachmentName.replace(/\.xml$/, '')}" Format="xml" CreationDate="2099-09-09  8:29:59" Size="4.3193" Visible="true">
    <ofd:FileLoc>Doc_0/Attachs/${attachmentName}</ofd:FileLoc>
  </ofd:Attachment>
</ofd:Attachments>
`;

async function run() {
  await mkdir(fixturesDir, { recursive: true });

  // 复用 PDF fixture 的合成 XML，避免维护两份
  const attachmentXml = await readFile(join(fixturesDir, 'synthetic-ticket.xml'), 'utf-8');

  const ofdBytes = zipSync(
    {
      'OFD.xml': strToU8(ofdXml),
      'Doc_0/Attachs/Attachments.xml': strToU8(attachmentsXml),
      [`Doc_0/Attachs/${attachmentName}`]: strToU8(attachmentXml),
    },
    { level: 6 }
  );

  const outPath = join(fixturesDir, 'synthetic-ticket.ofd');
  await writeFile(outPath, ofdBytes);
  console.log(`fixture OFD: ${outPath}  (${ofdBytes.length} bytes)`);
}

run().catch((err) => {
  console.error('fixture 生成失败:', err);
  process.exit(1);
});
