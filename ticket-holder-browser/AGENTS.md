# AGENTS.md

ticket-holder-browser —— 铁路电子客票浏览器端解析与出图。仓库根级的隐私红线、权威数据源约定见上级 `../AGENTS.md`，这里只管这个应用内部。

## 命令

```bash
pnpm install        # 或 npm install
pnpm dev            # http://localhost:5173
pnpm build          # vue-tsc -b && vite build
npx vue-tsc -b --force   # 只跑类型检查，改完类型相关的代码要单独跑
```

`tsconfig.app.json` 开了 `strict` + `noUnusedLocals` + `noUnusedParameters` + `erasableSyntaxOnly`。**没有测试框架**（无 vitest/jest），`pnpm build` 就是目前的全部质量门。

## 目录

- `src/types/ticket.ts` —— 数据模型三层中的前两层 + 辅助函数
- `src/utils/xmlParser.ts` —— XBRL XML → `TicketData`
- `src/utils/ofdParser.ts` / `pdfParser.ts` —— 从 `.ofd`（ZIP）/ `.pdf` 提取 XML
- `src/utils/ticketImageGenerator.ts` —— SVG 模板填充 + Canvas 回退 + 占位符表
- `src/components/FileUploader.vue` —— 上传、解析、字段明细、JSON 导出
- `src/components/TicketImagePreview.vue` —— 图片预览、模板切换、占位符帮助面板
- `public/*.svg` / `public/templates/*.svg` —— 车票模板

## 数据模型：三层，不可越层

```
XML  <rai:TrainNumber>G6709</rai:TrainNumber>
  ↓ ①  TICKET_FIELDS（types/ticket.ts:186）决定"不要数字化"
     TicketData.TrainNumber: string | null
  ↓ ②  toTicket()（types/ticket.ts:492）改名、合并、派生
     Ticket.trainNumber: string | null
  ↓ ③  TICKET_PLACEHOLDERS（ticketImageGenerator.ts:39）格式化
     SVG <text>{{trainNumber}}</text> → "G6709"
```

| 层 | 位置 | 职责 | 谁在用 |
|----|------|------|-------|
| ① 原始层 | `types/ticket.ts` `TicketData` + `TICKET_FIELDS` | XBRL 元素名的忠实镜像：类型、中文标签、是否隐藏 | `xmlParser.ts` |
| ② 领域层 | `types/ticket.ts` `Ticket` + `toTicket()` | 改名、合并重复概念、算派生值 | 界面、排序、分组 |
| ③ 渲染层 | `ticketImageGenerator.ts` `TICKET_PLACEHOLDERS` | 领域字段 → 模板占位符，中文说明 | SVG 模板 + Canvas |

**① 不做任何"更合理"的加工**——它的价值是「这份 JSON 就是票上写了什么」，可回溯核对。改名、合并、派生一律放 ②。

② 干的三件 ① 推不出来的事，改动时注意别把逻辑漏回 ①：`Fare` → `amount`（依据是元素清单备注列的"票价或退票费"）、`IssueParty`/`NameOfSeller` → `issuerName`（规范里两套重复表述）、`TravelDate`+`DepartureTime` → `departureAt`。

## 硬规则

1. **标识类字段永远是 `string`。**`xmlParser.ts` 必须保持 `parseTagValue: false`。车次 `0107` 一旦进 number 就变 `107`；12306 的电子客票号长达 25 位，超出 `Number.MAX_SAFE_INTEGER` 会被静默截断。只有金额和税率转 number，且由 `TICKET_FIELDS` 的 `type` 决定，不由解析器猜。
2. **`xsi:nil="true"` → `null`，不是空串。**XSD 里所有元素都 nillable。结果里每个 `TicketData` 字段都存在，要么有值要么显式为 `null`。
3. **根元素按本地名找，不要写死 `parsed.xbrl`。**分类架构有 `xbrl`（2021-11-30）和 `xbrli:xbrl`（2023-12-31）两种根，写死会拿到多包一层的对象。
4. **新增字段必须三处同步**：`TicketData` 加属性 → `TICKET_FIELDS` 补规格（类型 + 中文标签 + 是否 `display: 'hidden'`）→ 需要展示的话在 `TICKET_PLACEHOLDERS` 补一条。`TICKET_FIELDS` 的类型标注是 `Record<keyof TicketData, TicketFieldMeta>`，漏了或写错架构外字段都会让 `vue-tsc` 报错，别用 `as any` 绕过去。
5. **精简靠 `display: 'hidden'` 标记，不靠删字段。**删了就再也拿不回来。判据是「实物车票上印不印」——站名拼音看着像附属信息，但实物票上就印在站名正下方，不能隐藏。唯一硬删的是规范上不可达的字段（`rai_issuer_*.xml` 里只可能出现开具方元素，记账抵扣那 6 个只存在于接收方清单）。
6. **占位符拼错必须报错，不能静默跳过。**`fillSvgTemplate` 填完统一校验，抛 `TemplatePlaceholderError` 并用编辑距离指出最接近的正确写法。**这类错误不许回退到 Canvas**——回退只会让 `{{trainNubmer}}` 原样印在票上。只有模板 404 这类加载失败才回退。
7. **不写真实个人数据进源码**，包括注释里的"示例"。仓库要公开，`../AGENTS.md` 有完整说明。

## 时区陷阱

`getDepartureAt()` 合成绝对时刻，三条都不能违反：

- **不能用 `new Date('2025-08-16')`** —— ISO 日期串按规范解析成 UTC 午夜（北京 8:00），早 8 小时。
- **不能用 `new Date(y, m, d, h, min)`** —— 走浏览器本地时区，纽约用户打开偏 12 小时。要显式减固定 UTC+8（中国 1991 年后无夏令时，铁路时刻表全为北京时间）。
- **`DepartureTime` 规范只定义为 `text`**，没规定格式。容忍 `H:mm` / `HH:mm`，越界或格式不符返回 `null`，绝不返回 `Invalid Date`。

展示一律用 `formatDepartureAt(at)`（固定 `Asia/Shanghai`）或票面原文 `departureTime`，**不要 `toLocaleString()`**。

## 占位符

模板里写 `{{key}}`。**唯一来源是 `TICKET_PLACEHOLDERS`**，共 24 条，每条带中文说明。不要再在任何文档里抄一份清单——曾经抄了 5 份、已经漂移，全部删掉了。现在界面上的「可用占位符」折叠面板直接渲染自这个常量，模板作者在应用里看即可。

## 约定

- **Markdown 一律单行成段，不要按文字宽度手动折行。**段落、列表项各占一行。代码块和表格内除外。
- Vue 组件用 `<script setup lang="ts">`。
- 模板里不能直接写 `{{` 字面量——Vue 会当成插值开头。用脚本里的常量注入。
- 注释用中文，写"为什么"不写"做了什么"。

## 待办

### 已完成

- [x] 三层数据模型拆分，`TICKET_FIELDS` 与 `TICKET_PLACEHOLDERS` 各自单一事实来源
- [x] 字段精简 46 → 40（硬删 6），默认展示项收敛到 19
- [x] 领域层 `Ticket`：改名、合并开票方、`departureAt`、`byDepartureAt` 比较器
- [x] 占位符类型化 + 残留校验 + 拼写建议，Canvas 回退共用同表
- [x] 修 `businessTag`：原来 `type !== '正常'` 恒真，因为规范里 `TypeOfBusiness` 是「售或退」不是「正常」，导致每张正常票都挂 `【售】`
- [x] 根元素兼容 `xbrl` / `xbrli:xbrl`
- [x] 界面：字段明细表、发车时刻提示、「显示全部字段」开关、占位符帮助面板

### 未完成

- [ ] **`public/templates/red.svg` 不存在。**`design/red.ai` 待导出。列表里已标「红票（待导出）」，选中会回退到 Canvas。导出后记得去掉那个后缀。
- [ ] **两个模板都没用上拼音占位符。**`phonicsOfDepartureStation` / `phonicsOfDestinationStation` 数据层已就绪、`prepareReplacements` 也在供值，但 `ticket-template.svg` 和 `modern.svg` 里没有对应 `<text>`，所以票面不显示。实物票上拼音印在站名正下方，属于票面主要信息。见 `design/sample.jpg`。
- [ ] **多票收藏没做。**`byDepartureAt()` 和 `getDepartureAt()` 已经能排序，但 `FileUploader` 一次只处理一个文件，没有列表、没有持久化、没有排序/分组 UI。
- [ ] **没有自动化测试。**`src/` 下无 `*.test.ts`，质量门只有 `vue-tsc` + `vite build`。时区、占位符校验、字段精简这几块最适合补单测（纯函数，无 DOM 依赖）。
- [ ] `Ticket` 领域层的 `refundedAmount` 已定义但没接进 UI；`NumberOfOriginalInvoice`、`DiscountMark`、`TypeOfRailwayTicket` 等改签/优惠字段也没在界面上单独呈现。
- [ ] `pnpm-workspace.yaml` 未纳入版本库（未跟踪），确认是否该提交。
