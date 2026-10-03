/**
 * 车票图片生成模块
 * 支持两种模式：
 * 1. 使用 SVG 模板生成（推荐）
 * 2. 使用 Canvas 直接绘制
 */
import type { ParsedData } from './xmlParser';

export interface TicketImageOptions {
  width?: number; // 默认 1011 像素 (85.6mm @ 300dpi)
  height?: number; // 默认 638 像素 (54mm @ 300dpi)
  backgroundColor?: string;
  fontFamily?: string;
  templateUrl?: string; // SVG 模板 URL
  hideIdNumber?: boolean; // 是否隐藏身份证号
}

/**
 * 隐藏身份证号中间部分
 */
function maskIdNumber(idNumber: string): string {
  if (!idNumber || idNumber.length < 8) {
    return idNumber;
  }

  // 保留前 6 位和后 4 位，中间用 * 替换
  // 如：123456200401011234 -> 123456********1234
  // （123456 非真实行政区划代码，此处仅为格式示例）
  const start = idNumber.slice(0, 6);
  const end = idNumber.slice(-4);
  const middle = '*'.repeat(idNumber.length - 10);

  return `${start}${middle}${end}`;
}

/**
 * 隐藏 SVG 中包含身份证号的元素
 */
function hideIdNumberElements(svgContent: string): string {
  // 查找包含 "证件号" 或 "idNumber" 的 text 元素，将其 opacity 设为 0 或删除
  // 方法1: 查找包含 {{idNumber}} 或 "证件号:" 的 text 元素
  // 由于占位符已经被替换，我们查找包含 "证件号" 文本的元素

  // 简单方法：将包含"证件号"的 text 元素设置为不可见
  svgContent = svgContent.replace(
    /(<text[^>]*>)(.*?证件号.*?)(<\/text>)/gi,
    '$1$2$3'.replace(/<text/, '<text opacity="0"')
  );

  // 更精确的方法：使用正则匹配并添加 opacity 属性
  svgContent = svgContent.replace(
    /<text([^>]*?)>(.*?证件号.*?)<\/text>/gi,
    (_match, attrs, content) => {
      // 如果已有 opacity 属性，则替换；否则添加
      if (attrs.includes('opacity')) {
        attrs = attrs.replace(/opacity="[^"]*"/, 'opacity="0"');
      } else {
        attrs += ' opacity="0"';
      }
      return `<text${attrs}>${content}</text>`;
    }
  );

  return svgContent;
}

/**
 * 将车票数据生成为图片
 * @param data 解析后的车票数据
 * @param options 图片选项
 * @returns Promise<string> 返回 base64 格式的图片数据
 */
export async function generateTicketImage(
  data: ParsedData,
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
async function generateFromSvgTemplate(
  data: ParsedData,
  options: TicketImageOptions
): Promise<string> {
  try {
    // 获取 SVG 模板
    const response = await fetch(options.templateUrl!);
    let svgContent = await response.text();

    // 准备替换数据
    const replacements = prepareReplacements(data, options);

    // 替换占位符
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      svgContent = svgContent.replace(regex, value);
    }

    // 如果需要隐藏身份证号，隐藏包含 idNumber 的文本元素
    if (options.hideIdNumber) {
      svgContent = hideIdNumberElements(svgContent);
    }

    // 将 SVG 转换为图片
    return await svgToImage(
      svgContent,
      options.width || 1011,
      options.height || 638
    );
  } catch (error) {
    console.error('SVG 模板生成失败，回退到 Canvas 模式:', error);
    return generateFromCanvas(data, options);
  }
}

/**
 * 准备替换数据的键值对
 */
function prepareReplacements(
  data: ParsedData,
  options: TicketImageOptions = {}
): Record<string, string> {
  // 处理身份证号：隐藏时返回空字符串
  const idNumber = options.hideIdNumber ? '' : data.IdNumber || '';

  return {
    // 基本信息
    trainNumber: data.TrainNumber || '',
    departureStation: data.DepartureStation || '',
    phonicsOfDepartureStation: data.PhonicsOfDepartureStation || '',
    destinationStation: data.DestinationStation || '',
    phonicsOfDestinationStation: data.PhonicsOfDestinationStation || '',

    // 日期时间
    travelDate: formatDate(data.TravelDate || ''),
    travelDateRaw: data.TravelDate || '',
    travelYear: data.TravelDate?.split('-')[0] || '',
    travelMonth: data.TravelDate?.split('-')[1] || '',
    travelDay: data.TravelDate?.split('-')[2] || '',
    departureTime: data.DepartureTime || '',

    // 座位信息
    seatLevel: data.SeatLevel || '',
    carriage: data.Carriage || '',
    seat: data.Seat || '',
    seatInfo: `${data.SeatLevel || ''} ${data.Carriage || ''}${
      data.Seat || ''
    }`,

    // 乘客信息
    name: data.Name || '',
    idNumber: idNumber,

    // 票价信息
    fare: String(data.Fare?.value || data.Fare || ''),
    fareWithSymbol: `¥ ${data.Fare?.value || data.Fare || ''}`,

    // 票号
    ticketNumber: data.ElectronicInvoiceRailwayETicketNumber || '',

    // 业务类型
    typeOfBusiness: data.TypeOfBusiness || '',
    businessTag:
      data.TypeOfBusiness && data.TypeOfBusiness !== '正常'
        ? `【${data.TypeOfBusiness}】`
        : '',

    // 其他信息
    airConditioning: data.AirConditioningCharacteristics || '',
    eTicketNumber: data.ETicketNumber || '',
  };
}

/**
 * 将 SVG 字符串转换为图片
 */
async function svgToImage(
  svgContent: string,
  width: number,
  height: number
): Promise<string> {
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

    img.onerror = error => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    img.src = url;
  });
}

/**
 * 使用 Canvas 直接绘制（原有方法）
 */
function generateFromCanvas(
  data: ParsedData,
  options: TicketImageOptions = {}
): string {
  // 85.6mm x 54mm @ 300dpi
  const width = options.width || 1011;
  const height = options.height || 638;
  const backgroundColor = options.backgroundColor || '#ffffff';
  const fontFamily =
    options.fontFamily ||
    'Arial, "Microsoft YaHei", "Helvetica Neue", sans-serif';

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

  // 提取车票信息
  const trainNumber = data.TrainNumber || '';
  const departureStation = data.DepartureStation || '';
  const destinationStation = data.DestinationStation || '';
  const travelDate = data.TravelDate || '';
  const departureTime = data.DepartureTime || '';
  const seatLevel = data.SeatLevel || '';
  const carriage = data.Carriage || '';
  const seat = data.Seat || '';
  const name = data.Name || '';
  const rawIdNumber = data.IdNumber || '';
  const idNumber = options.hideIdNumber
    ? maskIdNumber(rawIdNumber)
    : rawIdNumber;
  const fare = data.Fare?.value || data.Fare || '';
  const ticketNumber = data.ElectronicInvoiceRailwayETicketNumber || '';
  const typeOfBusiness = data.TypeOfBusiness || '';

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

  // 如果是退票或改签，标注业务类型
  if (typeOfBusiness && typeOfBusiness !== '正常') {
    ctx.font = `bold ${48}px ${fontFamily}`;
    ctx.fillStyle = '#d32f2f';
    ctx.fillText(`【${typeOfBusiness}】`, 200, 430);
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
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';

  // 输入格式: 2024-11-01
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts;
  return `${year}年${month}月${day}日`;
}

/**
 * 下载图片
 */
export function downloadImage(
  dataUrl: string,
  fileName: string = 'ticket.png'
) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
