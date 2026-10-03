# 快速开始 - SVG 模板生成车票图片

## 5 分钟快速上手

### 第一步：准备 SVG 模板

创建一个简单的 SVG 文件 `my-ticket.svg`：

```xml
<svg width="1011" height="638" xmlns="http://www.w3.org/2000/svg">
  <rect width="1011" height="638" fill="white"/>
  
  <text x="100" y="100" font-size="48" fill="black">
    车次: {{trainNumber}}
  </text>
  
  <text x="100" y="200" font-size="36" fill="black">
    {{departureStation}} → {{destinationStation}}
  </text>
  
  <text x="100" y="300" font-size="32" fill="red">
    票价: {{fareWithSymbol}}
  </text>
</svg>
```

### 第二步：放置模板

将 SVG 文件放到项目的 `public` 目录：

```
public/
  └── my-ticket.svg
```

### 第三步：使用模板

在代码中引用：

```typescript
import { generateTicketImage } from '@/utils/ticketImageGenerator'

const imageUrl = await generateTicketImage(ticketData, {
  templateUrl: '/my-ticket.svg'
})
```

### 第四步：查看效果

1. 启动项目: `pnpm dev`
2. 上传车票文件
3. 勾选"使用 SVG 模板"
4. 在下拉框中选择你的模板
5. 查看生成的图片

## 可用占位符速查表

### 基础信息
```
{{trainNumber}}          车次号
{{departureStation}}     发站
{{destinationStation}}   到站
```

### 时间信息
```
{{travelDate}}           2024年11月01日
{{departureTime}}        17:40
```

### 座位信息
```
{{seatLevel}}            硬座
{{carriage}}             05车
{{seat}}                 008号
{{seatInfo}}             硬座 05车008号
```

### 乘客信息
```
{{name}}                 姓名
{{idNumber}}             证件号
```

### 价格信息
```
{{fare}}                 2.00
{{fareWithSymbol}}       ¥ 2.00
```

### 其他
```
{{ticketNumber}}         票号
{{businessTag}}          【退】（仅退票/改签时显示）
```

## 在 Illustrator 中设计

### 1. 新建文档
- 宽度: 1011 px
- 高度: 638 px
- 颜色模式: RGB

### 2. 设计界面
- 添加矩形、文本、图形等
- 在需要填充数据的地方输入 `{{fieldName}}`

### 3. 导出 SVG
- 文件 → 存储为 → SVG
- **重要**: 字体类型选择 "SVG"（不要转换为轮廓）

## 添加新模板到界面

编辑 `src/components/TicketImagePreview.vue`:

```typescript
const templates = [
  { label: '经典样式', value: '/ticket-template.svg' },
  { label: '现代样式', value: '/templates/modern.svg' },
  { label: '我的模板', value: '/my-ticket.svg' }  // 添加这行
]
```

## 常见问题

**Q: 中文不显示？**
```xml
<!-- 添加字体族 -->
<text font-family="Arial, Microsoft YaHei, sans-serif">
  {{name}}
</text>
```

**Q: 占位符没替换？**
检查格式：
- ✅ `{{trainNumber}}` - 正确
- ❌ `{trainNumber}` - 错误（单花括号）
- ❌ `{{ trainNumber }}` - 错误（有空格）

**Q: 图片模糊？**
确保 SVG 尺寸正确：
```xml
<svg width="1011" height="638" viewBox="0 0 1011 638">
```

**Q: 想不用模板？**
取消勾选"使用 SVG 模板"即可使用 Canvas 模式

## 下一步

- 查看 `ILLUSTRATOR_GUIDE.md` 了解详细设计指南
- 查看 `SVG_TEMPLATE_GUIDE.md` 了解完整功能
- 查看 `public/ticket-template.svg` 参考示例模板
- 查看 `public/templates/modern.svg` 参考现代风格

## 示例项目结构

```
public/
  ├── ticket-template.svg        # 经典模板（默认）
  ├── my-ticket.svg              # 你的简单模板
  └── templates/
      ├── modern.svg             # 现代模板
      └── custom.svg             # 自定义模板

src/
  ├── utils/
  │   └── ticketImageGenerator.ts
  └── components/
      └── TicketImagePreview.vue
```

开始创建你的专属车票模板吧！🚀
