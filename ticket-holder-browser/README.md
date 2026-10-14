# Ticket Holder Browser

铁路电子客票浏览器端解析工具 - 使用 Vue 3 + Vite 开发。

## 功能特性

- ✅ **OFD 文件解析**：自动解压 OFD 文件（ZIP 格式），提取附件中的 XML
- ✅ **PDF 文件解析**：从 PDF 嵌入附件中提取 XML 数据
- ✅ **XBRL 解析**：将铁路电子客票 XML 解析为结构化的车票数据
- ✅ **车票图片生成**：生成标准尺寸（85.6mm × 54mm @ 300dpi）的车票图片
- ✅ **SVG 模板支持**：使用 Illustrator 设计的 SVG 模板自动填充数据
- ✅ **多模板选择**：支持多种样式模板切换
- ✅ **纯浏览器处理**：所有操作在浏览器本地完成，无需上传到服务器
- ✅ **结果导出**：解析结果导出为 JSON，图片导出为 PNG

## 技术栈

- **Vue 3** - 响应式前端框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **fflate** - OFD/ZIP 解压
- **pdf-lib** - PDF 附件提取
- **fast-xml-parser** - XML 解析

## 快速开始

### 安装依赖

```bash
pnpm install
# 或
npm install
```

### 开发模式

```bash
pnpm dev
# 或
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
pnpm build
# 或
npm run build
```

构建产物在 `dist` 目录。

### 预览生产构建

```bash
pnpm preview
# 或
npm run preview
```

## 使用说明

### 基本使用

1. 点击"选择文件"按钮，选择 `.ofd` 或 `.pdf` 格式的铁路电子客票文件
2. 点击"开始解析"按钮
3. 自动生成车票图片预览
4. 查看解析结果（字段明细 + 原始 JSON）
5. 可选操作：切换 SVG 模板样式、隐藏身份证号、下载车票图片（PNG）、下载 JSON 数据

### 自定义 SVG 模板

把 SVG 放进 `public/templates/`，在需要填数据处写 `{{key}}`。可用 key 见 [SVG 模板占位符](#svg-模板占位符)，模板规范见 [public/templates/README.md](public/templates/README.md)。

## 项目结构

```
ticket-holder-browser/
├── public/
│   ├── ticket-template.svg      # 经典样式模板
│   └── templates/
│       ├── modern.svg           # 现代样式模板
│       └── README.md            # 模板制作规范
├── src/
│   ├── types/
│   │   └── ticket.ts            # 车票数据结构（字段规格 + 领域模型 + 辅助函数）
│   ├── components/
│   │   ├── FileUploader.vue     # 文件上传和解析界面
│   │   └── TicketImagePreview.vue  # 车票图片预览组件
│   ├── utils/
│   │   ├── ofdParser.ts         # OFD 文件解析
│   │   ├── pdfParser.ts         # PDF 文件提取
│   │   ├── xmlParser.ts         # XML/XBRL 解析
│   │   └── ticketImageGenerator.ts  # 车票图片生成 + 模板占位符
│   ├── App.vue
│   └── main.ts
└── README.md
```

## 支持的文件格式

- `.ofd` - 电子发票 OFD 文件
- `.pdf` - 包含嵌入附件的 PDF 文件

解析器会自动查找文件中第一个以 `rai_issuer_` 开头的 XML 附件。

## 车票数据结构

数据结构定义在 `src/types/ticket.ts`，分两层。

### 原始层 `TicketData` — 票据原文的忠实镜像

字段清单取自财政部《电子凭证会计数据标准》**开具方元素清单**（`reference/…/附件2：…元素清单.xlsx`，42 项）与 2023-12-31 分类架构。

```ts
interface TicketData {
  TrainNumber: string | null     // 车次，如 "G6709" / "6437" / "0107"
  ETicketNumber: string | null   // 电子客票号，12306 出票时长达 25 位
  Fare: number | null            // 支付金额，单位元
  Carriage: string | null        // 车厢，如 "06车"
  // …共 40 个字段
}

interface TicketParseResult {
  ticket: TicketData
  extra: Record<string, string | null> // 架构外的意外元素，原样保留
}
```

这一层不合并、不重命名、不做任何"更合理"的加工——「这份 JSON 就是票上写了什么」必须可回溯核对。

### 领域层 `Ticket` — 给业务逻辑用

由 `toTicket(data)` 派生，可以自由合并重复概念、生成派生值。界面、排序、分组都只用这一层。

```ts
const ticket = toTicket(data)

ticket.departureAt   // Date | null，绝对时刻，排序/分组直接用
ticket.departureTime // "11:55"，票面原文，展示用
ticket.amount        // 支付金额：售票=票价，退票=退票费
ticket.fromStation   // 出发站
```

### 约定

1. **标识类字段永远是 `string`**。车次 `0107` 一旦被当成数字就变成 `107`；12306 的电子客票号长达 25 位，更超出 `Number.MAX_SAFE_INTEGER`，进 number 会被静默截断。因此 `xmlParser.ts` 显式设置 `parseTagValue: false`，文本一律保持字符串，只对金额和税率做数字化。
2. **一切可为 `null`**。XSD 中所有元素都是 nillable，XML 里以 `xsi:nil="true"` 出现，解析为 `null` 而非空串。`TicketData` 的每个字段都会出现在结果里，要么有值要么显式为 `null`。
3. **新增字段必须登记**。`TICKET_FIELDS` 的类型标注为 `Record<keyof TicketData, TicketFieldMeta>`，往 `TicketData` 加属性却忘了登记（或登记了架构外的字段）都会让 `vue-tsc` 报错。漏登记的运行时字段会落进 `extra` 而不是被丢弃。

### 字段精简

- **硬删 6 个**：红字发票、已入账、已抵扣、抵扣税期、记账主体税号/名称。它们只存在于规范的**接收方**元素清单，而本项目只读 `rai_issuer_*.xml`，物理上不可能出现。
- **默认隐藏 8 个**（`display: 'hidden'`）：票据类型、税额三项、购销双方的地址电话与开户行。乘车凭证用不上，但**照常解析、照常导出 JSON**，界面上勾选「显示全部字段」即可看到。删掉就再也拿不回来了，所以只筛不删。
- **判据是「实物车票上印不印」**。站名拼音（`Beijing` / `Qinhuangdao`）看着像附属信息，但实物票上就印在站名正下方，属票面主要信息，不隐藏。开票单位（`中国铁路沈阳局集团公司`）同理。

效果：一张 G6709 的票默认展示 19 项，勾选后 23 项。

### 发车时刻与时区

`getDepartureAt()` 把 `TravelDate` + `DepartureTime` 合成绝对时刻，规避了三个坑：

- **不能用 `new Date('2025-08-16')`**。ISO 日期串按规范被解析成 **UTC 午夜**，即北京 8:00，比真实时刻早 8 小时。
- **不能用 `new Date(y, m, d, h, min)`**。那走浏览器本地时区，人在纽约打开就偏 12 小时。这里显式减去固定 UTC+8 偏移——中国 1991 年后无夏令时，铁路时刻表全为北京时间——与运行环境无关。
- **`DepartureTime` 规范只定义为 `text`**，没规定格式。容忍 `H:mm` 与 `HH:mm`，越界或格式不符一律返回 `null` 而不是 `Invalid Date`。

展示用 `formatDepartureAt(at)`（固定 `Asia/Shanghai`）或直接用票面原文 `departureTime`，不要 `toLocaleString()`——那会跟着浏览器时区跑。

### 辅助函数

| 函数 | 用途 |
|------|------|
| `text(v)` | 字符串字段归一为 `''` |
| `formatMoney(v)` | `78` → `"78.00"` |
| `formatPercent(v)` | `0.09` → `"9%"` |
| `formatDate(v)` | `"2025-08-16"` → `"2025年08月16日"` |
| `maskIdNumber(v)` | 证件号中间掩码 |
| `getDepartureAt(d)` | 合成发车时刻 `Date` |
| `formatDepartureAt(at)` | 按北京时间展示发车时刻 |
| `departureWeekday(at)` | 「周一」… |
| `byDepartureAt(a, b)` | 发车时刻升序比较，无时刻排最后 |
| `ticketFieldRows(d, { includeHidden })` | 按中文标签生成可读字段列表 |

## SVG 模板占位符

SVG 模板里用 `{{key}}` 引用车票数据，例如 `<text>{{trainNumber}}</text>`。

**唯一来源是 `src/utils/ticketImageGenerator.ts` 的 `TICKET_PLACEHOLDERS`**——每条带一个中文说明，同时供模板渲染器和界面上的「可用占位符」折叠面板使用。所以模板作者在应用里看到的清单永远和实际支持的一致，不需要查文档。

```ts
trainNumber: {
  label: '车次',
  get: (t) => text(t.trainNumber),
},
```

加一个占位符只要往这张表里加一条，类型 `PlaceholderKey` 会自动跟着更新。共 24 个。

### 写错会直接报错

模板里的未知 key 不会被静默跳过——替换完成后统一校验并抛 `TemplatePlaceholderError`，错误信息会指出最接近的正确写法：

```
模板里有 1 个无法识别的占位符：{{trainNubmer}}（是否想用 {{trainNumber}}？）。
可用占位符见 TICKET_PLACEHOLDERS。
```

这类错误**不会**回退到 Canvas 绘制，因为回退只会让 `{{trainNubmer}}` 这样的花括号字面量原样印在票面上。模板加载失败（404 等）才回退。

花括号内允许空格，`{{ trainNumber }}` 同样有效——Illustrator / Figma 导出的 SVG 里手打空格很常见。

## 注意事项

- 所有文件处理均在浏览器本地完成，不会上传到任何服务器
- 支持现代浏览器（Chrome、Firefox、Safari、Edge 等）
- 大文件可能需要较长处理时间，请耐心等待

## License

MIT
