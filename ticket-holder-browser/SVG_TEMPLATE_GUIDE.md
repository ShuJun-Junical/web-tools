# SVG 模板使用指南

## 概述

项目现在支持使用 SVG 模板生成车票图片，这样可以由设计师在 Illustrator、Figma 等工具中设计专业的模板，前端代码只需填充数据即可。

## 工作流程

```
设计师 (Illustrator/Figma)
    ↓
创建 SVG 模板 (使用占位符)
    ↓
前端读取 SVG 模板
    ↓
替换占位符为实际数据
    ↓
转换为 Canvas 并导出 PNG
```

## 创建 SVG 模板

### 1. 在 Illustrator 中设计

1. **新建文档**
   - 宽度: 1011px (85.6mm @ 300dpi)
   - 高度: 638px (54mm @ 300dpi)
   - 颜色模式: RGB

2. **添加占位符文本**
   - 使用 `{{fieldName}}` 格式作为占位符
   - 例如: `{{trainNumber}}`, `{{departureStation}}`

3. **导出 SVG**
   - 文件 → 存储为 → SVG
   - SVG 选项: 
     - SVG 配置文件: SVG 1.1
     - 字体: 转换为轮廓（或保留文本以便修改）
     - 图像位置: 嵌入
     - 小数位数: 2

### 2. 可用的占位符

```javascript
{{trainNumber}}              // 车次号，如 "G1234"
{{departureStation}}         // 发站，如 "北京西"
{{destinationStation}}       // 到站，如 "上海虹桥"
{{travelDate}}              // 格式化日期，如 "2024年11月01日"
{{travelDateRaw}}           // 原始日期，如 "2024-11-01"
{{departureTime}}           // 发车时间，如 "17:40"
{{seatLevel}}               // 席别，如 "硬座"
{{carriage}}                // 车厢，如 "05车"
{{seat}}                    // 座位，如 "008号"
{{seatInfo}}                // 完整座位信息，如 "硬座 05车008号"
{{name}}                    // 姓名
{{idNumber}}                // 证件号
{{fare}}                    // 票价（仅数字），如 "2.00"
{{fareWithSymbol}}          // 带符号票价，如 "¥ 2.00"
{{ticketNumber}}            // 票号
{{typeOfBusiness}}          // 业务类型，如 "退"、"改"
{{businessTag}}             // 业务标签，如 "【退】"（正常时为空）
{{airConditioning}}         // 空调特征，如 "新空调"
{{eTicketNumber}}           // 电子票号
```

## 使用模板

### 方法 1: 放在 public 目录（推荐）

1. 将 SVG 文件放到 `public/` 目录
2. 在代码中使用：

```typescript
import { generateTicketImage } from './utils/ticketImageGenerator'

const imageUrl = await generateTicketImage(ticketData, {
  templateUrl: '/ticket-template.svg'
})
```

### 方法 2: 使用外部 URL

```typescript
const imageUrl = await generateTicketImage(ticketData, {
  templateUrl: 'https://example.com/templates/ticket.svg'
})
```

### 方法 3: 动态加载多个模板

```typescript
// 让用户选择模板
const templates = {
  classic: '/templates/classic.svg',
  modern: '/templates/modern.svg',
  minimal: '/templates/minimal.svg'
}

const imageUrl = await generateTicketImage(ticketData, {
  templateUrl: templates[selectedTemplate]
})
```

## 在组件中使用

更新 `TicketImagePreview.vue`：

```vue
<script setup lang="ts">
const templateUrl = ref('/ticket-template.svg')

async function generateImage() {
  generating.value = true
  error.value = null
  
  try {
    const dataUrl = await generateTicketImage(props.ticketData, {
      templateUrl: templateUrl.value
    })
    imageUrl.value = dataUrl
  } catch (err) {
    error.value = err instanceof Error ? err.message : '生成图片失败'
  } finally {
    generating.value = false
  }
}
</script>
```

## 设计建议

### 1. 尺寸规范
- 标准尺寸: 85.6mm × 54mm (信用卡尺寸)
- 分辨率: 300dpi
- 像素尺寸: 1011 × 638 px
- 安全边距: 内边距至少 10-20px

### 2. 字体建议
- 中文: Microsoft YaHei, PingFang SC, Noto Sans CJK
- 英文/数字: Arial, Helvetica
- 车次号: 48-72px, 粗体
- 车站名: 48-56px, 粗体
- 正文: 28-36px
- 小字: 20-24px

### 3. 颜色方案
```css
主色调:   #0066cc (蓝色)
强调色:   #d32f2f (红色，用于票价)
文字主色: #000000 (黑色)
文字副色: #666666 (灰色)
背景色:   #ffffff (白色)
```

### 4. 布局建议
- 标题居中或左上角
- 车次号醒目显示（左上或居中）
- 发站到站用箭头连接
- 票价右侧突出显示
- 姓名证件号底部左侧
- 票号右下角小字

## 示例模板

项目中包含了一个示例模板: `public/ticket-template.svg`

这个模板展示了：
- ✅ 标准尺寸和布局
- ✅ 所有可用占位符的使用
- ✅ 合理的字体大小
- ✅ 专业的视觉设计
- ✅ 装饰元素和边框

你可以基于这个模板进行修改或创建全新的设计。

## 调试技巧

### 1. 在浏览器中预览 SVG
直接访问 `http://localhost:5174/ticket-template.svg` 查看模板效果

### 2. 检查占位符替换
在浏览器控制台中：
```javascript
console.log('Replaced SVG:', svgContent)
```

### 3. 测试模板
```typescript
// 使用测试数据
const testData = {
  TrainNumber: 'G1234',
  DepartureStation: '北京西',
  DestinationStation: '上海虹桥',
  // ...更多字段
}
```

## 优势

使用 SVG 模板的好处：

✅ **设计师友好** - 可以用专业工具设计
✅ **易于维护** - 修改模板不需要改代码
✅ **矢量图形** - 可缩放，质量不受影响
✅ **多模板支持** - 可以有多种风格的模板
✅ **版本控制** - SVG 是文本文件，便于 Git 管理
✅ **快速迭代** - 设计和开发可以并行工作

## 故障排除

**问题**: SVG 中的中文显示为方框
**解决**: 在 SVG 中嵌入字体或使用系统字体

**问题**: 图片生成失败
**解决**: 检查 SVG 格式是否正确，确保没有外部依赖

**问题**: 占位符没有被替换
**解决**: 检查占位符格式是否为 `{{fieldName}}`（双花括号）
