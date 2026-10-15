/**
 * 铁路电子客票数据结构定义
 *
 * 本模块分两层：
 *
 * - **`TicketData`（原始层）**——XSD 的忠实镜像，一字不改地还原票据原文。
 *   「这份 JSON 就是票上写了什么」是可回溯核对的前提，所以这里不合并、不重命名、
 *   不做任何"更合理"的加工。
 * - **`Ticket`（领域层）**——由 `toTicket()` 从 `TicketData` 派生。给界面、排序、
 *   分组等业务逻辑用，可以自由合并重复概念、生成派生值。
 *
 * 分层的理由：派生值一旦混进原始层就无法回溯（比如 `Date` 序列化成 UTC 串会
 * 让人误以为票上时间错了 8 小时），而原始层又天然不适合直接做业务计算。
 *
 * 字段清单与类型取自财政部《电子凭证会计数据标准——全面数字化的电子发票
 * （铁路电子客票）（推广应用版）》2023-12-31 分类架构，核对的是该规范附件里的
 * 开具方（issuer）元素清单共 42 项，以及 `rai_cor-20231231.xsd` 的类型定义。
 * 规范原文在财政部会计司官网发布，不随本仓库存放。
 *
 * 三条硬规则：
 *
 * 1. **标识类字段永远是 string**。车次 `0107` 不是 107；12306 的电子客票号
 *    长达 25 位，更不能进 JS number——超出 Number.MAX_SAFE_INTEGER 会被静默
 *    截断。只有金额和税率是 number。
 * 2. **一切可为 null**。XSD 里所有元素都是 nillable，XML 中以
 *    `xsi:nil="true"` 出现，解析成 null 而不是空字符串，这样"字段缺失"
 *    和"字段是空串"在数据上可区分。
 * 3. **精简靠标记，不靠删除**。乘车凭证用不上的字段（税额、企业专票的
 *    开户行等）标 `display: 'hidden'`，默认不展示但照常解析、照常导出。
 *    真删掉就再也拿不回来了。判据是「实物车票上印不印」——站名拼音看着像附属
 *    信息，但实物票上就印在站名正下方，不能隐藏。唯一硬删的是规范上不可达的
 *    字段——见下方注释。
 *
 * 新增字段时：先在 `TicketData` 加属性，再在 `TICKET_FIELDS` 加规格条目。
 * `satisfies` 会在编译期强制这一步，漏了直接报错。
 */

/**
 * 字段的运行时类型，决定 XML 文本如何被转换
 *
 * 这里只列当前架构里真实存在的类型。规范没有布尔字段（开票 / 退票是字符串枚举），
 * 所以不预留 `'boolean'`——真出现时再加，否则它的转换分支永远进不去，测试也够不着。
 */
export type TicketFieldType =
  /** 文本。车次 / 票号 / 证件号 / 站名 等一切标识类字段 */
  | 'string'
  /** 金额，单位元，如 78.00 → 78 */
  | 'money'
  /** 税率，如 0.09 */
  | 'percent'
  /** 日期，保留 XML 原样 "2025-08-16"（不做时区换算） */
  | 'date';

export interface TicketFieldMeta {
  type: TicketFieldType;
  /** 中文标签，用于界面展示与调试 */
  label: string;
  /**
   * 默认不展示的字段
   *
   * 乘车凭证用不上的概念：税额明细、企业专票才有的地址电话与开户行。
   * 照常解析、照常导出 JSON，只是不进默认视图。
   *
   * 判据是「实物车票上印不印」。站名拼音虽然看着像附属信息，但实物票上就印在
   * 站名正下方，属于票面主要信息，不能隐藏。
   */
  display?: 'hidden';
}

/**
 * 一张铁路电子客票的完整原始数据
 *
 * 字段名与 XBRL 元素本地名一一对应（已去掉 `rai:` 前缀），因为这套名字
 * 同时也是导出 JSON 的 key，换名字等于破坏对外接口。
 *
 * 范围限定为**开具方（issuer）**元素。规范里的「红字发票 / 已入账 / 已抵扣 /
 * 抵扣税期 / 记账主体」等记账抵扣字段只存在于**接收方（receiver）**元素清单，
 * 而本项目只读取 `rai_issuer_*.xml`，这些字段物理上不可能出现，因此不予收录。
 */
export interface TicketData {
  // ---- 票据头 ----
  /** 票据类型，恒为「电子发票（铁路电子客票）」，信息量为零故默认隐藏 */
  TypeOfVoucher: string | null;
  /** 数电票号码，作为票据的唯一标识 */
  ElectronicInvoiceRailwayETicketNumber: string | null;
  /** 开票日期 */
  DateOfIssue: string | null;
  /** 开票单位。规范里与 NameOfSeller 是同一概念的两套表述，12306 只填一套 */
  IssueParty: string | null;
  /** 开票单位代码。同上，与 UnifiedSocialCreditCodeOfSeller 重复 */
  IssuePartyCode: string | null;
  /** 业务类型，「售」或「退」 */
  TypeOfBusiness: string | null;

  // ---- 行程信息 ----
  /** 出发站 */
  DepartureStation: string | null;
  /** 出发站拼音。实物车票印在站名正下方，属票面主要信息 */
  PhonicsOfDepartureStation: string | null;
  /** 到达站 */
  DestinationStation: string | null;
  /** 到达站拼音。实物车票印在站名正下方，属票面主要信息 */
  PhonicsOfDestinationStation: string | null;
  /**
   * 车次，如 `G6709`、`Z37`、`6437`、`0107`
   *
   * 永远是字符串：`0107`（管内临客前导零车次）一旦被当成数字就变成 `107`，
   * 这张票就认不出来了。
   */
  TrainNumber: string | null;
  /** 乘车日期 */
  TravelDate: string | null;
  /** 出发时间，如 "17:40" */
  DepartureTime: string | null;
  /** 票种，「全」「孩」「学」「残」等 */
  TypeOfRailwayTicket: string | null;
  /** 空调特征，如「新空调」。普速车概念，高铁票恒为 null */
  AirConditioningCharacteristics: string | null;
  /** 席别，如「二等座」 */
  SeatLevel: string | null;
  /** 车厢，如「06车」 */
  Carriage: string | null;
  /** 席位，如「11A号」「021号下铺」 */
  Seat: string | null;
  /** 优惠标识 */
  DiscountMark: string | null;
  /**
   * 支付金额（元）
   *
   * 注意命名陷阱：规范给 `Fare` 的展示标签是「支付金额」而非「票价」，备注
   * 写明"票价或退票费"——退票票据里这个值是退票费。领域层因此叫 `amount`。
   */
  Fare: number | null;
  /** 已退金额（元） */
  AmountRefunded: number | null;
  /** 原票票价（元），改签场景用 */
  FareOfOriginalRailwayTicket: number | null;
  /** 原票出发站，改签场景用 */
  DepartureStationOfOriginalRailwayTicket: string | null;
  /** 原票到达站，改签场景用 */
  DestinationStationOfOriginalRailwayTicket: string | null;
  /** 电子客票号，12306 出票时的长串号码 */
  ETicketNumber: string | null;

  // ---- 乘车人信息 ----
  /** 证件号，12306 通常已做中间掩码 */
  IdNumber: string | null;
  /** 姓名 */
  Name: string | null;

  // ---- 税额信息（乘车凭证用不上，默认隐藏）----
  /** 金额（不含税） */
  TotalAmountExcludingTax: number | null;
  /** 税率 */
  TaxRate: number | null;
  /** 税额 */
  TaxAmount: number | null;

  // ---- 购买方 ----
  NameOfPurchaser: string | null;
  UnifiedSocialCreditCodeOfPurchaser: string | null;
  /** 企业专票才有 */
  AddressPhoneNumberOfPurchaser: string | null;
  /** 企业专票才有 */
  DepositBankAndAccountNumberOfPurchaser: string | null;

  // ---- 销售方 ----
  /** 与 IssueParty 是同一概念的另一套表述 */
  NameOfSeller: string | null;
  /** 与 IssuePartyCode 重复 */
  UnifiedSocialCreditCodeOfSeller: string | null;
  AddressPhoneNumberOfSeller: string | null;
  DepositBankAndAccountNumberOfSeller: string | null;

  // ---- 其他 ----
  /** 原发票号码，换开或红冲时填报 */
  NumberOfOriginalInvoice: string | null;
  /** 备注 */
  Remarks: string | null;
}

/**
 * 字段规格表：解析器靠它决定类型，界面靠它取中文标签
 *
 * 类型标注成 `Record<keyof TicketData, TicketFieldMeta>` 是刻意的：它同时锁死
 * 两侧——往 `TicketData` 加字段却忘了在这里登记会编译失败（少了 key），写了
 * 架构外的字段也会失败（多了 key），不会静默按 string 处理。
 */
export const TICKET_FIELDS: Record<keyof TicketData, TicketFieldMeta> = {
  TypeOfVoucher: { type: 'string', label: '票据类型', display: 'hidden' },
  ElectronicInvoiceRailwayETicketNumber: { type: 'string', label: '数电票号码' },
  DateOfIssue: { type: 'date', label: '开票日期' },
  IssueParty: { type: 'string', label: '开票单位' },
  IssuePartyCode: { type: 'string', label: '开票单位代码' },
  TypeOfBusiness: { type: 'string', label: '业务类型' },

  DepartureStation: { type: 'string', label: '出发站' },
  PhonicsOfDepartureStation: { type: 'string', label: '出发站拼音' },
  DestinationStation: { type: 'string', label: '到达站' },
  PhonicsOfDestinationStation: { type: 'string', label: '到达站拼音' },
  TrainNumber: { type: 'string', label: '车次' },
  TravelDate: { type: 'date', label: '乘车日期' },
  DepartureTime: { type: 'string', label: '出发时间' },
  TypeOfRailwayTicket: { type: 'string', label: '票种' },
  AirConditioningCharacteristics: { type: 'string', label: '空调特征' },
  SeatLevel: { type: 'string', label: '席别' },
  Carriage: { type: 'string', label: '车厢' },
  Seat: { type: 'string', label: '席位' },
  DiscountMark: { type: 'string', label: '优惠标识' },
  Fare: { type: 'money', label: '支付金额' },
  AmountRefunded: { type: 'money', label: '已退金额' },
  FareOfOriginalRailwayTicket: { type: 'money', label: '原票票价' },
  DepartureStationOfOriginalRailwayTicket: { type: 'string', label: '原票出发站' },
  DestinationStationOfOriginalRailwayTicket: { type: 'string', label: '原票到达站' },
  ETicketNumber: { type: 'string', label: '电子客票号' },

  IdNumber: { type: 'string', label: '证件号' },
  Name: { type: 'string', label: '姓名' },

  TotalAmountExcludingTax: { type: 'money', label: '金额（不含税）', display: 'hidden' },
  TaxRate: { type: 'percent', label: '税率', display: 'hidden' },
  TaxAmount: { type: 'money', label: '税额', display: 'hidden' },

  NameOfPurchaser: { type: 'string', label: '购买方名称' },
  UnifiedSocialCreditCodeOfPurchaser: { type: 'string', label: '购买方统一社会信用代码' },
  AddressPhoneNumberOfPurchaser: { type: 'string', label: '购买方地址、电话', display: 'hidden' },
  DepositBankAndAccountNumberOfPurchaser: {
    type: 'string',
    label: '购买方开户行及账号',
    display: 'hidden',
  },

  NameOfSeller: { type: 'string', label: '销售方名称' },
  UnifiedSocialCreditCodeOfSeller: { type: 'string', label: '销售方统一社会信用代码' },
  AddressPhoneNumberOfSeller: { type: 'string', label: '销售方地址、电话', display: 'hidden' },
  DepositBankAndAccountNumberOfSeller: {
    type: 'string',
    label: '销售方开户行及账号',
    display: 'hidden',
  },

  NumberOfOriginalInvoice: { type: 'string', label: '原发票号码' },
  Remarks: { type: 'string', label: '备注' },
};

/** `TICKET_FIELDS` 的 key 联合，等价于 `keyof TicketData` */
export type TicketFieldName = keyof typeof TICKET_FIELDS;

/** 解析结果：原始层 + 架构外元素的兜底 */
export interface TicketParseResult {
  ticket: TicketData;
  /**
   * 架构里没有的意外元素，原样保留（string）
   *
   * 宁可多看一眼，也不要因为架构升级后新增字段而静默丢数据。
   */
  extra: Record<string, string | null>;
}

/** 字段规格表的类型化视图 */
const FIELD_SPEC: Partial<Record<string, TicketFieldMeta>> = TICKET_FIELDS;

/**
 * 把 XML 原始文本转成该字段的运行时类型
 *
 * @param fieldName 去掉命名空间前缀后的元素名，如 `TrainNumber`
 * @param raw       XML 中的文本内容；`xsi:nil` 元素传 `null`
 * @returns 转换后的值；未登记字段按 `string` 处理；`raw` 为 null 时返回 null
 */
export function coerceTicketValue(fieldName: string, raw: string | null): string | number | null {
  if (raw === null) return null;

  // 未登记的元素：原样返回字符串，宁可类型宽松也不能丢数据
  const type = FIELD_SPEC[fieldName]?.type ?? 'string';

  switch (type) {
    case 'money':
    case 'percent': {
      const num = Number(raw);
      // Number('') === 0，空串要当缺失处理，否则票价会莫名变成 ¥0.00
      if (raw.trim() === '' || Number.isNaN(num)) return null;
      return num;
    }
    case 'date':
    case 'string':
    default:
      // 关键：此处返回原始字符串，不做任何数字化。车次 / 票号 / 证件号
      // 全部走这条路，前导零与超长数字都原样保住。
      return raw;
  }
}

/** 取字符串字段，null 归一成空串，方便直接进模板 */
export function text(value: string | null | undefined): string {
  return value ?? '';
}

/** 金额格式化为两位小数，如 78 → "78.00"；null → 空串 */
export function formatMoney(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : value.toFixed(2);
}

/** 税率格式化为百分比，如 0.09 → "9%" */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return `${Number((value * 100).toFixed(4))}%`;
}

/**
 * 日期 "2025-08-16" → "2025年08月16日"；非标准格式原样返回
 *
 * 用正则而不是 `split('-')` 数段数：`N/A-B-C` 这类带两个连字符的脏值会数出
 * 3 段，被当成日期拼成 "N/A年B月C日"，比原样展示更难读。
 */
export function formatDate(value: string | null | undefined): string {
  const raw = text(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return raw;
  return `${m[1]}年${m[2]}月${m[3]}日`;
}

// ---------------------------------------------------------------------------
// 发车时刻
// ---------------------------------------------------------------------------

/**
 * 北京时间相对 UTC 的固定偏移（分钟）
 *
 * 中国自 1991 年起不再实行夏令时，铁路时刻表全部为北京时间，所以这里用固定
 * +08:00 即可，无需查时区库——比用 `Asia/Shanghai` 的 IANA 时区更轻，也避免
 * 依赖运行环境的 tzdata。
 */
const BEIJING_OFFSET_MINUTES = 8 * 60;

/** 解析 "H:mm" / "HH:mm" 为当日分钟数；格式不符或越界返回 null */
function parseClockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 解析 "yyyy-mm-dd" 并校验是真实存在的日期（如 2025-02-30 会被拒） */
function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC 会把 2 月 30 日静默进位到 3 月 2 日，所以要回检
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return probe;
}

/**
 * 由乘车日期 + 出发时间构造发车时刻
 *
 * 返回的 `Date` 是**绝对时刻**（UTC 时间轴上的一个点），所以在任何时区打开
 * 页面排序结果都一样。三条容易踩的坑，这里都规避了：
 *
 * 1. **不能用 `new Date('2025-08-16')`**。ISO 日期串按规范被解析成 **UTC
 *    午夜**，即北京 8:00，比真实时刻早 8 小时。
 * 2. **不能用 `new Date(y, m, d, h, min)`**。那走浏览器本地时区，人在纽约
 *    打开就会偏 12 小时。这里显式减去 UTC+8 偏移，与浏览器时区无关。
 * 3. **`DepartureTime` 规范只定义为 text**，没规定格式。容忍 `H:mm` 与
 *    `HH:mm`，不符合的一律返回 null 而不是 Invalid Date。
 *
 * @returns 发车时刻；日期或时间缺失 / 格式非法时为 null
 */
export function getDepartureAt(ticket: TicketData): Date | null {
  const date = parseCalendarDate(text(ticket.TravelDate));
  const minutes = parseClockMinutes(text(ticket.DepartureTime));
  if (!date || minutes === null) return null;

  const utcMs = date.getTime() + (minutes - BEIJING_OFFSET_MINUTES) * 60_000;
  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** 按北京时间展示发车时刻，不受浏览器所在时区影响 */
export function formatDepartureAt(at: Date | null): string {
  if (!at) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
}

/** 发车星期，如「周一」；无发车时刻时返回空串 */
export function departureWeekday(at: Date | null): string {
  if (!at) return '';
  const weekday = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  }).format(at);
  return weekday;
}

// ---------------------------------------------------------------------------
// 领域层
// ---------------------------------------------------------------------------

/**
 * 领域模型：给界面、排序、分组等业务逻辑用
 *
 * 与 `TicketData` 的差别是刻意的——这里允许合并重复概念、修正误导命名、
 * 提供派生值。原始层永远保持忠实。
 */
export interface Ticket {
  /** 数电票号码 */
  invoiceNumber: string | null;
  /** 电子客票号 */
  eTicketNumber: string | null;
  /** 开票日期 */
  issuedAt: string | null;
  /** 业务类型，「售」或「退」 */
  businessType: string | null;

  // 行程
  trainNumber: string | null;
  fromStation: string | null;
  fromStationPinyin: string | null;
  toStation: string | null;
  toStationPinyin: string | null;
  travelDate: string | null;
  /** 出发时间原文，如 "17:40" */
  departureTime: string | null;
  /**
   * 发车时刻，排序 / 分组 / 比较大小都用它
   *
   * 注意它与 `departureTime` 的区别：后者是票面原文（字符串），前者是绝对
   * 时刻（Date）。展示用原文，逻辑用 Date。
   */
  departureAt: Date | null;

  // 席位
  seatLevel: string | null;
  carriage: string | null;
  seat: string | null;
  /** 票种，「全」「孩」「学」「残」 */
  ticketType: string | null;
  discountMark: string | null;
  airConditioning: string | null;

  // 乘车人
  passengerName: string | null;
  passengerIdNumber: string | null;

  /**
   * 支付金额（元）
   *
   * 售票时是票价，退票时是退票费——所以不叫 fare。
   */
  amount: number | null;
  /** 已退金额（元） */
  refundedAmount: number | null;

  // 购销双方
  purchaserName: string | null;
  purchaserTaxId: string | null;
  /** 开票方。规范里 IssueParty/IssuePartyCode 与 NameOfSeller/…Seller 重复，此处合并 */
  issuerName: string | null;
  issuerTaxId: string | null;

  remarks: string | null;
}

/**
 * 原始层 → 领域层
 *
 * 开票方做了合并：规范把「开票单位」和「销售方」列成两套字段，实测 12306 只填
 * 其中一套，另一套是 null，所以取第一个非空的即可。
 */
export function toTicket(data: TicketData): Ticket {
  return {
    invoiceNumber: data.ElectronicInvoiceRailwayETicketNumber,
    eTicketNumber: data.ETicketNumber,
    issuedAt: data.DateOfIssue,
    businessType: data.TypeOfBusiness,

    trainNumber: data.TrainNumber,
    fromStation: data.DepartureStation,
    fromStationPinyin: data.PhonicsOfDepartureStation,
    toStation: data.DestinationStation,
    toStationPinyin: data.PhonicsOfDestinationStation,
    travelDate: data.TravelDate,
    departureTime: data.DepartureTime,
    departureAt: getDepartureAt(data),

    seatLevel: data.SeatLevel,
    carriage: data.Carriage,
    seat: data.Seat,
    ticketType: data.TypeOfRailwayTicket,
    discountMark: data.DiscountMark,
    airConditioning: data.AirConditioningCharacteristics,

    passengerName: data.Name,
    passengerIdNumber: data.IdNumber,

    amount: data.Fare,
    refundedAmount: data.AmountRefunded,

    purchaserName: data.NameOfPurchaser,
    purchaserTaxId: data.UnifiedSocialCreditCodeOfPurchaser,
    issuerName: text(data.IssueParty) || text(data.NameOfSeller) || null,
    issuerTaxId: text(data.IssuePartyCode) || text(data.UnifiedSocialCreditCodeOfSeller) || null,

    remarks: data.Remarks,
  };
}

/** 发车时刻升序（最近的在后），无发车时刻的排最后 */
export function byDepartureAt(a: Ticket, b: Ticket): number {
  if (!a.departureAt && !b.departureAt) return 0;
  if (!a.departureAt) return 1;
  if (!b.departureAt) return -1;
  return a.departureAt.getTime() - b.departureAt.getTime();
}

// ---------------------------------------------------------------------------
// 展示
// ---------------------------------------------------------------------------

/** 可读字段行，供界面按中文标签展示 */
export interface TicketFieldRow {
  name: TicketFieldName;
  label: string;
  /** 已按字段类型格式化，可直接展示 */
  value: string;
  /** 该字段是否被标记为默认隐藏 */
  hidden: boolean;
}

function formatFieldValue(field: TicketFieldName, value: string | number | null): string {
  if (value === null) return '';
  const type = TICKET_FIELDS[field].type;
  if (type === 'money') return formatMoney(value as number);
  if (type === 'percent') return formatPercent(value as number);
  return String(value);
}

export interface TicketFieldRowOptions {
  /** 是否包含 `display: 'hidden'` 的字段，默认 false */
  includeHidden?: boolean;
}

/**
 * 生成非空字段的可读列表
 *
 * 顺序即 `TICKET_FIELDS` 的书写顺序（票头 → 行程 → 席位 → 乘车人 → 金额 →
 * 购销双方），界面上比一坨 JSON 直观得多。
 */
export function ticketFieldRows(
  ticket: TicketData,
  options: TicketFieldRowOptions = {}
): TicketFieldRow[] {
  const rows: TicketFieldRow[] = [];
  for (const name of Object.keys(TICKET_FIELDS) as TicketFieldName[]) {
    const meta = TICKET_FIELDS[name];
    const hidden = meta.display === 'hidden';
    if (hidden && !options.includeHidden) continue;

    const value = formatFieldValue(name, ticket[name]);
    if (value === '') continue;

    rows.push({ name, label: meta.label, value, hidden });
  }
  return rows;
}
