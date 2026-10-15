/**
 * XML/XBRL 解析模块
 *
 * 把铁路电子客票 XBRL 实例转成 `TicketData`——字段清单与类型定义见
 * `types/ticket.ts`，本模块只负责「读 XML → 按规格转换」。
 *
 * 关键配置 `parseTagValue: false`：
 * fast-xml-parser 默认会把看起来像数字的文本转成 JS number，而 XML 里
 * 「长得像数字」的东西绝大多数不是数字——
 *
 *   <rai:TrainNumber>0107</rai:TrainNumber>   → 107   前导零没了
 *   <rai:ETicketNumber>2251...（25 位）</rai:ETicketNumber>
 *                                                → 2.2513940860807977e+24
 *                                                  超出 MAX_SAFE_INTEGER，静默截断
 *
 * 所以文本一律保持字符串，只对金额 / 税率做显式数字化（见
 * `coerceTicketValue`）。
 */
import { XMLParser } from 'fast-xml-parser';
import { TICKET_FIELDS, coerceTicketValue, type TicketData, type TicketParseResult } from './types';

/** `TicketData` 的 key 列表，用于区分「规范字段」与「架构外元素」 */
const KNOWN_FIELD_NAMES = Object.keys(TICKET_FIELDS);

/** 上述 key 的集合形式，查找用 */
const KNOWN_FIELD_NAME_SET: ReadonlySet<string> = new Set(KNOWN_FIELD_NAMES);

/**
 * 非业务元素：上下文、单位、架构引用
 *
 * 按「去前缀后的本地名」匹配，所以 `context` / `xbrli:context` 都能命中。
 */
const NON_FACT_ELEMENT_NAMES = new Set(['context', 'unit', 'schemaRef']);

/** 取命名空间前缀后的本地名：`rai:TrainNumber` → `TrainNumber` */
function localName(key: string): string {
  const colon = key.indexOf(':');
  return colon === -1 ? key : key.slice(colon + 1);
}

/** 取出元素的文本内容；没有文本节点时返回 null */
function textOf(node: unknown): string | null {
  if (node === null || node === undefined) return null;
  if (typeof node === 'string') return node;
  if (typeof node !== 'object') return String(node);

  const text = (node as Record<string, unknown>)['#text'];
  return typeof text === 'string' ? text : null;
}

/**
 * 解析 XBRL XML 为车票数据结构
 *
 * @returns `ticket` 覆盖 `TicketData` 的全部字段（缺失与 nil 为 null）；
 *          `extra` 收容架构外的意外元素，避免静默丢数据。
 */
export function parseXBRL(xmlContent: string): TicketParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // 属性也保持字符串：decimals / unitRef 没有数值语义
    parseAttributeValue: false,
    // 文本不做数字化，详见本文件顶部注释
    parseTagValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent) as Record<string, unknown>;

  // 根元素是 xbrl 还是 xbrli:xbrl 取决于分类架构版本（2021-11-30 / 2023-12-31），
  // 按本地名找，别写死 `parsed.xbrl`
  const rootKey = Object.keys(parsed).find((key) => localName(key) === 'xbrl');
  const xbrl = rootKey ? (parsed[rootKey] as Record<string, unknown>) : parsed;

  // 预置为 null，保证 TicketData 的每个字段都存在：要么有值，要么显式为空。
  // 这样消费方不用区分「字段缺失」和「字段是 null」，JSON 导出也有固定结构。
  const ticket: Record<string, unknown> = Object.fromEntries(
    KNOWN_FIELD_NAMES.map((name) => [name, null])
  );
  const extra: Record<string, string | null> = {};
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(xbrl)) {
    // 属性（@_xxx）不是数据项
    if (key.startsWith('@_')) continue;

    const name = localName(key);
    if (NON_FACT_ELEMENT_NAMES.has(name)) continue;

    // 同名元素重复出现时取首个
    if (seen.has(name)) continue;
    seen.add(name);

    // 12306 每张票一个 XML，但真出现数组时取首个元素即可
    const node = Array.isArray(value) ? value[0] : value;

    let raw: string | null;
    if (node !== null && typeof node === 'object') {
      const attrs = node as Record<string, unknown>;
      // xsi:nil="true" 表示该字段为显式空值
      raw = attrs['@_xsi:nil'] === 'true' ? null : textOf(node);
    } else {
      raw = textOf(node);
    }

    // 只有登记在 TICKET_FIELDS 里的元素进 ticket，其余进 extra
    if (!KNOWN_FIELD_NAME_SET.has(name)) {
      extra[name] = raw;
      continue;
    }

    ticket[name] = coerceTicketValue(name, raw);
  }

  return { ticket: ticket as unknown as TicketData, extra };
}
