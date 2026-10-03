# Ticket Holder Browser

铁路电子客票浏览器端解析工具 - 使用 Vue 3 + Vite 开发。

## 功能特性

- ✅ **OFD 文件解析**：自动解压 OFD 文件（ZIP 格式），提取附件中的 XML
- ✅ **PDF 文件解析**：从 PDF 嵌入附件中提取 XML 数据
- ✅ **XBRL 解析**：将铁路电子客票 XML 数据解析为易读的字典格式
- ✅ **车票图片生成**：生成标准尺寸（85.6mm × 54mm @ 300dpi）的车票图片
- ✅ **SVG 模板支持**：使用 Illustrator 设计的 SVG 模板自动填充数据
- ✅ **多模板选择**：支持多种样式模板切换
- ✅ **纯浏览器处理**：所有操作在浏览器本地完成，无需上传到服务器
- ✅ **结果导出**：支持将解析结果导出为 JSON 文件，图片导出为 PNG

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
4. 查看解析结果（JSON 格式）
5. 可选操作：
   - 切换 SVG 模板样式
   - 下载车票图片（PNG 格式）
   - 下载 JSON 数据

### SVG 模板功能

项目支持使用 SVG 模板生成车票图片：

1. **使用内置模板**
   - 勾选"使用 SVG 模板"
   - 从下拉框选择模板样式
   - 自动生成对应风格的车票图片

2. **创建自定义模板**
   - 查看 [快速开始指南](QUICK_START.md)
   - 查看 [Illustrator 制作教程](ILLUSTRATOR_GUIDE.md)
   - 查看 [SVG 模板指南](SVG_TEMPLATE_GUIDE.md)

## 项目结构

```
ticket-holder-browser/
├── public/
│   ├── ticket-template.svg      # 经典样式模板
│   └── templates/
│       └── modern.svg           # 现代样式模板
├── src/
│   ├── components/
│   │   ├── FileUploader.vue     # 文件上传和解析界面
│   │   └── TicketImagePreview.vue  # 车票图片预览组件
│   ├── utils/
│   │   ├── ofdParser.ts         # OFD 文件解析
│   │   ├── pdfParser.ts         # PDF 文件解析
│   │   ├── xmlParser.ts         # XML/XBRL 解析
│   │   └── ticketImageGenerator.ts  # 车票图片生成器
│   ├── App.vue
│   └── main.ts
├── QUICK_START.md               # 快速开始指南
├── SVG_TEMPLATE_GUIDE.md        # SVG 模板使用指南
├── ILLUSTRATOR_GUIDE.md         # Illustrator 制作教程
├── SVG_IMPLEMENTATION_SUMMARY.md  # 实现总结
└── README.md
```

## 支持的文件格式

- `.ofd` - 电子发票 OFD 文件
- `.pdf` - 包含嵌入附件的 PDF 文件

解析器会自动查找文件中第一个以 `rai_issuer_` 开头的 XML 附件。

## 注意事项

- 所有文件处理均在浏览器本地完成，不会上传到任何服务器
- 支持现代浏览器（Chrome、Firefox、Safari、Edge 等）
- 大文件可能需要较长处理时间，请耐心等待

## License

MIT
