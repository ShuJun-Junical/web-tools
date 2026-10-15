/**
 * 车票图片生成模块
 * 支持两种模式：
 * 1. 使用 SVG 模板生成（推荐）
 * 2. 使用 Canvas 直接绘制
 *
 * SVG 模板里用 `{{key}}` 引用数据，可用 key 由 `TICKET_PLACEHOLDERS` 定义——
 * 这是「车票数据 → 模板占位符」的唯一映射来源，模板文档也以它为准。
 */
import { formatDate, formatMoney, text, type Ticket } from './types';

export interface TicketImageOptions {
  width?: number; // 默认 1011 像素 (85.6mm @ 300dpi)
  height?: number; // 默认 638 像素 (54mm @ 300dpi)
  backgroundColor?: string;
  fontFamily?: string;
  templateUrl?: string; // SVG 模板 URL
  hideIdNumber?: boolean; // 是否隐藏身份证号
}

// ---------------------------------------------------------------------------
// 模板占位符
// ---------------------------------------------------------------------------

export interface TicketPlaceholder {
  /** 中文说明，同时用作模板制作文档的内容来源 */
  label: string;
  /** 从车票数据取值。一律返回 string——SVG 文本节点吃不了 null */
  get: (ticket: Ticket, options: TicketImageOptions) => string;
}

/**
 * 可用占位符表
 *
 * 每个 key 对应 `Ticket` 上的一个（或几个）字段，模板里写 `{{key}}` 引用。
 * 加字段就往这里加一条，模板才有办法用上——不会像以前那样只存在于代码里、
 * 任何文档都查不到。
 */
const PLACEHOLDER_DEFS = {
  trainNumber: {
    label: '车次',
    get: (t: Ticket) => text(t.trainNumber),
  },
  departureStation: {
    label: '出发站',
    get: (t: Ticket) => text(t.fromStation),
  },
  phonicsOfDepartureStation: {
    label: '出发站拼音',
    get: (t: Ticket) => text(t.fromStationPinyin),
  },
  destinationStation: {
    label: '到达站',
    get: (t: Ticket) => text(t.toStation),
  },
  phonicsOfDestinationStation: {
    label: '到达站拼音',
    get: (t: Ticket) => text(t.toStationPinyin),
  },
  travelDate: {
    label: '乘车日期（格式化，如 2025年08月16日）',
    get: (t: Ticket) => formatDate(t.travelDate),
  },
  travelDateRaw: {
    label: '乘车日期（原文，如 2025-08-16）',
    get: (t: Ticket) => text(t.travelDate),
  },
  travelYear: {
    label: '乘车年份',
    get: (t: Ticket) => text(t.travelDate).split('-')[0] ?? '',
  },
  travelMonth: {
    label: '乘车月份',
    get: (t: Ticket) => text(t.travelDate).split('-')[1] ?? '',
  },
  travelDay: {
    label: '乘车日',
    get: (t: Ticket) => text(t.travelDate).split('-')[2] ?? '',
  },
  departureTime: {
    label: '出发时间，如 17:40',
    get: (t: Ticket) => text(t.departureTime),
  },
  seatLevel: {
    label: '席别，如 二等座',
    get: (t: Ticket) => text(t.seatLevel),
  },
  carriage: {
    label: '车厢，如 06车',
    get: (t: Ticket) => text(t.carriage),
  },
  seat: {
    label: '座位，如 11A号',
    get: (t: Ticket) => text(t.seat),
  },
  seatInfo: {
    label: '席别+车厢+座位，如 二等座 06车11A号',
    get: (t: Ticket) => `${text(t.seatLevel)} ${text(t.carriage)}${text(t.seat)}`.trim(),
  },
  name: {
    label: '乘车人姓名',
    get: (t: Ticket) => text(t.passengerName),
  },
  idNumber: {
    label: '证件号（勾选隐藏后为空串）',
    get: (t: Ticket, o: TicketImageOptions) => (o.hideIdNumber ? '' : text(t.passengerIdNumber)),
  },
  fare: {
    label: '支付金额，纯数字两位小数',
    get: (t: Ticket) => formatMoney(t.amount),
  },
  fareWithSymbol: {
    label: '支付金额，带 ¥ 符号',
    get: (t: Ticket) => {
      const fare = formatMoney(t.amount);
      return fare === '' ? '' : `¥ ${fare}`;
    },
  },
  ticketNumber: {
    label: '数电票号码',
    get: (t: Ticket) => text(t.invoiceNumber),
  },
  typeOfBusiness: {
    label: '业务类型原文，如 售 / 退',
    get: (t: Ticket) => text(t.businessType),
  },
  businessTag: {
    label: '业务类型标签，退票时为 【退】；正常售票时为空串',
    get: (t: Ticket) => {
      const type = text(t.businessType);
      // 规范规定 TypeOfBusiness 取值为「售」或「退」，不会写「正常」。
      // 只给非常规业务加标签，否则每张正常票都会挂一个没有信息量的【售】。
      return type && type !== '售' && type !== '正常' ? `【${type}】` : '';
    },
  },
  airConditioning: {
    label: '空调特征，如 新空调',
    get: (t: Ticket) => text(t.airConditioning),
  },
  eTicketNumber: {
    label: '电子客票号',
    get: (t: Ticket) => text(t.eTicketNumber),
  },
} satisfies Record<string, TicketPlaceholder>;

/** 可用占位符 key 的联合类型 */
export type PlaceholderKey = keyof typeof PLACEHOLDER_DEFS;

/**
 * 占位符表（含中文说明）
 *
 * 导出来给文档与校验工具用，避免再出现「代码里有、文档里查不到」的占位符。
 */
export const TICKET_PLACEHOLDERS: Record<PlaceholderKey, TicketPlaceholder> = PLACEHOLDER_DEFS;

/**
 * 模板里出现的占位符
 *
 * 花括号内允许空格——Illustrator / Figma 导出的 SVG 里手打空格很常见，
 * 不该为此报错。
 */
const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * 模板占位符错误
 *
 * 单独一类，因为它是「模板写错了」而不是「渲染失败了」：必须冒泡到界面上，
 * 不能被 Canvas 回退逻辑吞掉——否则花括号字面量会悄悄印在票面上。
 */
export class TemplatePlaceholderError extends Error {
  readonly unknownKeys: string[];
  readonly suggestions: Record<string, PlaceholderKey | undefined>;

  constructor(unknownKeys: string[]) {
    const suggestions: Record<string, PlaceholderKey | undefined> = {};
    for (const key of unknownKeys) {
      suggestions[key] = closestPlaceholderKey(key);
    }
    const detail = unknownKeys
      .map((key) => {
        const hit = suggestions[key];
        return hit ? `{{${key}}}（是否想用 {{${hit}}}？）` : `{{${key}}}`;
      })
      .join('、');
    super(
      `模板里有 ${unknownKeys.length} 个无法识别的占位符：${detail}。` +
        `可用占位符见 TICKET_PLACEHOLDERS。`
    );
    this.name = 'TemplatePlaceholderError';
    this.unknownKeys = unknownKeys;
    this.suggestions = suggestions;
  }
}

/**
 * 找出与拼错的 key 最接近的合法占位符
 *
 * 模板多半来自 Illustrator 手工拼写，错一两个字母最常见。给出「你是不是想写
 * {{trainNumber}}」比只说「未知占位符」有用得多。
 */
function closestPlaceholderKey(key: string): PlaceholderKey | undefined {
  const valid = Object.keys(TICKET_PLACEHOLDERS);
  let best: PlaceholderKey | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of valid) {
    const distance = editDistance(key, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate as PlaceholderKey;
    }
  }
  // 差太多就不猜了，报错信息里只列原名
  return bestDistance <= Math.max(2, Math.floor(key.length / 3)) ? best : undefined;
}

/** Levenshtein 距离，占位符都是短词，直接 DP 即可 */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const current = [i, ...Array<number>(cols - 1).fill(0)];
    for (let j = 1; j < cols; j++) {
      current[j] = Math.min(
        prev[j]! + 1,
        current[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = current;
  }
  return prev[cols - 1]!;
}

/**
 * 求出所有占位符的取值
 *
 * SVG 模板与 Canvas 回退共用这一份，所以两种模式的字段口径不可能不一致。
 */
export function placeholderValues(
  ticket: Ticket,
  options: TicketImageOptions = {}
): Record<PlaceholderKey, string> {
  const values = {} as Record<PlaceholderKey, string>;
  for (const key of Object.keys(TICKET_PLACEHOLDERS) as PlaceholderKey[]) {
    values[key] = TICKET_PLACEHOLDERS[key].get(ticket, options);
  }
  return values;
}

/**
 * 把占位符填进 SVG 文本
 *
 * 一次性扫描替换，顺手完成校验：凡是扫到却认不出来的 key 都记下来，
 * 全部填完后统一抛错。所以「占位符拼错」不可能再静默印到票面上。
 *
 * @throws {TemplatePlaceholderError} 模板含未知占位符
 */
export function fillSvgTemplate(
  svgContent: string,
  ticket: Ticket,
  options: TicketImageOptions = {}
): string {
  const values: Record<string, string> = placeholderValues(ticket, options);

  const unknown = new Set<string>();
  const filled = svgContent.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    if (key in values) return values[key]!;
    unknown.add(key);
    return match;
  });

  if (unknown.size > 0) {
    throw new TemplatePlaceholderError([...unknown]);
  }
  return filled;
}

/** 扫描 SVG 里用到的占位符 key（供校验工具用） */
export function collectPlaceholderKeys(svgContent: string): string[] {
  const keys = new Set<string>();
  for (const match of svgContent.matchAll(PLACEHOLDER_PATTERN)) {
    keys.add(match[1]!);
  }
  return [...keys];
}

/**
 * 隐藏 SVG 里证件号相关的 `<text>` 元素
 *
 * `hideIdNumber` 时 `{{idNumber}}` 已经被填成空串，号码本身不会出现在票面上；
 * 这里额外把「证件号」这几个字也置为透明，免得票面留一个没有内容的标签。
 */
function hideIdNumberElements(svgContent: string): string {
  return svgContent.replace(/<text([^>]*?)>(.*?证件号.*?)<\/text>/gi, (_match, attrs, content) => {
    // 已有 opacity 就地替换，避免同时出现两个同名属性
    const nextAttrs = attrs.includes('opacity')
      ? attrs.replace(/opacity="[^"]*"/, 'opacity="0"')
      : `${attrs} opacity="0"`;
    return `<text${nextAttrs}>${content}</text>`;
  });
}

/**
 * 将车票数据生成为图片
 * @param data 解析后的车票数据
 * @param options 图片选项
 * @returns Promise<string> 返回 base64 格式的图片数据
 */
export async function generateTicketImage(
  data: Ticket,
  options: TicketImageOptions = {}
): Promise<string> {
  // 如果提供了 SVG 模板，使用模板生成
  if (options.templateUrl) {
    return generateFromSvgTemplate(data, options);
  }

  // 否则使用 Canvas 直接绘制
  return generateFromCanvas(data, options);
}

/**
 * 使用 SVG 模板生成图片
 */
async function generateFromSvgTemplate(data: Ticket, options: TicketImageOptions): Promise<string> {
  // 先取模板。fetch 失败（模板不存在 / 网络错误）是可以回退的软失败。
  let svgContent: string;
  try {
    const response = await fetch(options.templateUrl!);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    svgContent = await response.text();
  } catch (error) {
    console.error('SVG 模板加载失败，回退到 Canvas 模式:', error);
    return generateFromCanvas(data, options);
  }

  // 填占位符。这一步失败说明模板写错了，不能回退——回退只会把
  // 「{{trainNubmer}}」这种花括号字面量印在票面上还不报错。
  const filled = fillSvgTemplate(svgContent, data, options);

  if (options.hideIdNumber) {
    return svgToImage(hideIdNumberElements(filled), options.width || 1011, options.height || 638);
  }
  return svgToImage(filled, options.width || 1011, options.height || 638);
}

/**
 * 将 SVG 字符串转换为图片
 */
async function svgToImage(svgContent: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // 创建图片元素
    const img = new Image();

    // 将 SVG 转换为 Data URL
    const svgBlob = new Blob([svgContent], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // 创建 Canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // 绘制图片到 Canvas
      ctx.drawImage(img, 0, 0, width, height);

      // 转换为 PNG
      const dataUrl = canvas.toDataURL('image/png');

      // 清理
      URL.revokeObjectURL(url);

      resolve(dataUrl);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    img.src = url;
  });
}

/**
 * 使用 Canvas 直接绘制（原有方法）
 */
function generateFromCanvas(data: Ticket, options: TicketImageOptions = {}): string {
  // 85.6mm x 54mm @ 300dpi
  const width = options.width || 1011;
  const height = options.height || 638;
  const backgroundColor = options.backgroundColor || '#ffffff';
  const fontFamily = options.fontFamily || 'Arial, "Microsoft YaHei", "Helvetica Neue", sans-serif';

  // 创建 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 填充背景
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // 设置字体
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  // 绘制标题
  ctx.font = `bold ${48}px ${fontFamily}`;
  ctx.fillText('中国铁路电子客票', 50, 40);

  // 提取车票信息。与 SVG 模板模式共用同一张占位符表，两种模式口径一致
  const v = placeholderValues(data, options);
  const trainNumber = v.trainNumber;
  const departureStation = v.departureStation;
  const destinationStation = v.destinationStation;
  const travelDate = v.travelDateRaw;
  const departureTime = v.departureTime;
  const seatLevel = v.seatLevel;
  const carriage = v.carriage;
  const seat = v.seat;
  const name = v.name;
  // hideIdNumber 时 idNumber 已被占位符填成空串，和 SVG 模板模式口径一致：
  // 勾选「隐藏身份证号」就是整块不画证件号，不是画一个掩码号
  const idNumber = v.idNumber;
  const fare = v.fare;
  const ticketNumber = v.ticketNumber;
  const businessTag = v.businessTag;

  // 绘制车次信息
  ctx.font = `bold ${72}px ${fontFamily}`;
  ctx.fillText(trainNumber, 50, 120);

  // 绘制发站到站
  ctx.font = `bold ${56}px ${fontFamily}`;
  const stationY = 220;
  ctx.fillText(departureStation, 50, stationY);

  // 绘制箭头
  ctx.font = `${48}px ${fontFamily}`;
  const arrLength = departureStation.length * 56 + 70;
  ctx.fillText('→', arrLength, stationY);

  // 绘制到站
  ctx.font = `bold ${56}px ${fontFamily}`;
  ctx.fillText(destinationStation, arrLength + 70, stationY);

  // 绘制日期时间
  ctx.font = `${36}px ${fontFamily}`;
  ctx.fillText(`${formatDate(travelDate)} ${departureTime} 开`, 50, 310);

  // 绘制席别车厢座位
  ctx.font = `${36}px ${fontFamily}`;
  const seatInfo = `${seatLevel} ${carriage}${seat}`;
  ctx.fillText(seatInfo, 50, 370);

  // 绘制票价
  ctx.font = `bold ${42}px ${fontFamily}`;
  ctx.fillStyle = '#d32f2f';
  ctx.fillText(`¥ ${fare}`, 50, 430);
  ctx.fillStyle = '#000000';

  // 如果是退票或改签，标注业务类型（判据与 SVG 模板共用同一张占位符表）
  if (businessTag) {
    ctx.font = `bold ${48}px ${fontFamily}`;
    ctx.fillStyle = '#d32f2f';
    ctx.fillText(businessTag, 200, 430);
    ctx.fillStyle = '#000000';
  }

  // 绘制姓名和证件号
  ctx.font = `${28}px ${fontFamily}`;
  ctx.fillText(`姓名: ${name}`, 50, 500);

  // 只有在不隐藏身份证号时才绘制
  if (!options.hideIdNumber) {
    ctx.fillText(`证件号: ${idNumber}`, 50, 540);
  }

  // 绘制票号（右下角，小字）
  ctx.font = `${20}px ${fontFamily}`;
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'right';
  ctx.fillText(`票号: ${ticketNumber}`, width - 30, height - 40);

  // 返回 base64 图片
  return canvas.toDataURL('image/png');
}

/**
 * 下载图片
 */
export function downloadImage(dataUrl: string, fileName: string = 'ticket.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
