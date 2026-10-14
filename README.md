# 赛博车票夹 · Ticket Holder

中国铁路自 2023 年起全面停止发行纸质报销凭证，铁路迷和旅行爱好者失去了实体车票这个收藏载体。本项目把电子发票还原成**可收藏的车票图片**，让数字化的乘车记录重新有实体感。

## 它能做什么

把 12306 下载的铁路电子客票（`.ofd` / `.pdf`）还原成标准尺寸的车票图片：

- 解析 OFD / PDF 内嵌的 XBRL 票据数据
- 按 85.6mm × 54mm @ 300dpi（1011 × 638 px）生成车票图
- 支持多套 SVG 模板，样式与代码解耦
- 支持隐藏身份证号后再分享
- **全部处理在浏览器本地完成**，票据文件不上传任何服务器

## 快速开始

### 浏览器端（推荐）

```bash
cd ticket-holder-browser
pnpm install      # 或 npm install
pnpm dev          # 访问 http://localhost:5173
```

在页面上传自己的 `.ofd` 或 `.pdf` 即可，无需任何样例文件。

### 命令行解析

```bash
python script/test.py <车票文件路径>
```

支持 `.ofd`、`.pdf`、已解包的 OFD 目录、或裸 `rai_issuer_*.xml`。把自己的车票放进 `private/` 目录后，也可以直接无参运行。

> 依赖 `lxml`：`pip install lxml`

### 隐私自检

```bash
python script/check_privacy.py            # 分级报告
python script/check_privacy.py --strict   # WARNING 也判为不通过
```

推送公开仓库前运行。检查忽略规则、已跟踪文件路径、Git 历史全部可达对象与工作区文件，检出项按严重程度分级：

| 级别 | 含义 | 默认是否阻断 |
|------|------|--------------|
| 🔴 BLOCKER | 确认敏感：完整身份证号、铁路票据身份字段、手机号 | 是 |
| 🟡 WARNING | 疑似敏感：长数字票据号、部分脱敏证件号 | 否，需人工确认 |
| ⚪ INFO | 已豁免或可忽略：`reference/` 公开文档、已知合成示例 | 否 |

脚本**刻意不硬编码任何真实姓名或证件号**，全部依赖通用模式与身份证 MOD 11-2 校验位算法，否则脚本自身就会成为泄露源。18 位证件号会经校验位二次确认以压低误报，校验位不符的降级为 INFO。

退出码：`0` 无 BLOCKER ｜ `1` 存在 BLOCKER ｜ `2` 无法执行检查

## 🔒 私人数据约定

电子客票文件包含**姓名、身份证号、完整行程（车次/日期/车厢/座位）与电子客票号**，这个组合足以在 12306 侧交叉验证到本人的真实乘车记录。

因此本仓库采取以下约定：

| 目录 | 内容 | 是否入库 |
|------|------|----------|
| `private/` | 你的真实 `.ofd` / `.pdf` 票据及解包结果 | ❌ 已忽略 |
| `design/` | 含证件信息的照片、Illustrator 源文件 | ❌ 已忽略 |
| `reference/` | 财政部公开规范与官方实例文档 | ✅ 入库 |
| `ticket-holder-browser/` | 应用源码 | ✅ 入库 |

`.gitignore` 将两个私人目录整体排除：

```gitignore
/private/
/design/
```

**请勿 `git add -f` 强行添加**——那会绕过忽略规则，把个人信息推上公开仓库。

> 目录约定以本 README 为准。`private/` 整体不入库，因此其中不放任何需要随仓库分发的说明文件。

## 项目结构

```
ticket-holder/
├── script/
│   ├── test.py             命令行解析工具
│   └── check_privacy.py    仓库隐私自检工具
├── private/                个人真实票据（git 忽略）
├── design/                 设计源文件（git 忽略）
├── reference/              财政部电子凭证标准、XSD 架构、国标
└── ticket-holder-browser/  Vue 3 + Vite 浏览器端应用
    ├── src/types/          ticket.ts 车票数据结构（字段清单与类型规格）
    ├── src/utils/          ofdParser / pdfParser / xmlParser / ticketImageGenerator
    ├── src/components/     FileUploader / TicketImagePreview
    └── public/templates/   SVG 车票模板
```

## 技术调研结论

OFD 本质是 ZIP 包，票据数据位于 `Doc_0/Attachs/` 目录下的 `rai_issuer_*.xml`，该 XML 即为全部数据源，无需解析 OFD 版式。规范依据见 `reference/`。

完整文档见 [ticket-holder-browser/README.md](ticket-holder-browser/README.md)。

## License

MIT
