import { AlignmentType, HeadingLevel, type IStylesOptions, LineRuleType } from 'docx';

/**
 * 中英文混排的默认样式。
 *
 * docx 的字号单位是半磅，正文 10.5pt 对应 21；行距 1.5 倍写作 360/240。
 * 字体按 ascii / eastAsia 分开指定，否则中文段落会被西文字体接管，字形和标点位置都不对。
 */
const serifLatin = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体' };
const sansLatin = { ascii: 'Segoe UI', hAnsi: 'Segoe UI', eastAsia: '微软雅黑' };

/** HeadingLevel 里还有 Title，这里只覆盖六个标题级别。 */
type HeadingKey = 'Heading1' | 'Heading2' | 'Heading3' | 'Heading4' | 'Heading5' | 'Heading6';

const headingSizes: Record<HeadingKey, number> = {
  [HeadingLevel.HEADING_1]: 32,
  [HeadingLevel.HEADING_2]: 28,
  [HeadingLevel.HEADING_3]: 24,
  [HeadingLevel.HEADING_4]: 22,
  [HeadingLevel.HEADING_5]: 21,
  [HeadingLevel.HEADING_6]: 21,
};

const headingSpacing: Record<HeadingKey, { before: number; after: number }> = {
  [HeadingLevel.HEADING_1]: { before: 360, after: 180 },
  [HeadingLevel.HEADING_2]: { before: 300, after: 150 },
  [HeadingLevel.HEADING_3]: { before: 240, after: 120 },
  [HeadingLevel.HEADING_4]: { before: 200, after: 100 },
  [HeadingLevel.HEADING_5]: { before: 180, after: 90 },
  [HeadingLevel.HEADING_6]: { before: 180, after: 90 },
};

function headingStyle(level: HeadingKey) {
  return {
    run: { font: sansLatin, size: headingSizes[level], bold: true, color: '1F2937' },
    paragraph: {
      spacing: { ...headingSpacing[level] },
      keepNext: true,
    },
  };
}

export function createChineseStyles(): IStylesOptions {
  return {
    default: {
      document: {
        run: { font: serifLatin, size: 21 },
        paragraph: { spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 120 } },
      },
      title: {
        run: { font: sansLatin, size: 44, bold: true },
        paragraph: { spacing: { before: 0, after: 360 }, alignment: AlignmentType.CENTER },
      },
      heading1: headingStyle(HeadingLevel.HEADING_1),
      heading2: headingStyle(HeadingLevel.HEADING_2),
      heading3: headingStyle(HeadingLevel.HEADING_3),
      heading4: headingStyle(HeadingLevel.HEADING_4),
      heading5: headingStyle(HeadingLevel.HEADING_5),
      heading6: headingStyle(HeadingLevel.HEADING_6),
      strong: { run: { bold: true } },
      hyperlink: { run: { color: '2563EB', underline: {} } },
      footnoteText: { run: { font: serifLatin, size: 18 } },
      footnoteReference: { run: { superScript: true } },
      listParagraph: {
        paragraph: { spacing: { line: 360, lineRule: LineRuleType.AUTO, after: 60 } },
      },
    },
    paragraphStyles: [
      {
        id: 'CodeBlock',
        name: 'Code Block',
        basedOn: 'Normal',
        quickFormat: true,
        run: {
          font: { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: '宋体' },
          size: 19,
          color: '1F2937',
        },
        paragraph: {
          spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 120, after: 120 },
          shading: { type: 'clear', color: 'auto', fill: 'F3F4F6' },
          indent: { left: 240, right: 240 },
        },
      },
    ],
  };
}
