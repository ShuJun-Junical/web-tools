# SVG 模板功能实现总结

## ✅ 已实现的功能

### 1. 双模式支持
- **SVG 模板模式**：使用设计师制作的 SVG 模板，通过占位符替换数据
- **Canvas 绘制模式**：纯代码绘制，作为备用方案

### 2. 核心功能

#### `ticketImageGenerator.ts`
```typescript
// 主函数 - 自动选择模式
generateTicketImage(data, options)

// SVG 模板生成
generateFromSvgTemplate(data, options)

// Canvas 绘制（备用）
generateFromCanvas(data, options)

// 数据准备
prepareReplacements(data)  // 准备所有占位符替换

// SVG 转图片
svgToImage(svgContent, width, height)
```

#### `TicketImagePreview.vue`
- ✅ 模板开关（SVG 模板 / Canvas 绘制）
- ✅ 多模板选择下拉框
- ✅ 实时预览
- ✅ 下载功能
- ✅ 生成模式标识

### 3. 可用占位符（24个）

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `{{trainNumber}}` | 车次号 | G1234 |
| `{{departureStation}}` | 发站 | 北京西 |
| `{{destinationStation}}` | 到站 | 上海虹桥 |
| `{{travelDate}}` | 格式化日期 | 2024年11月01日 |
| `{{travelDateRaw}}` | 原始日期 | 2024-11-01 |
| `{{departureTime}}` | 发车时间 | 17:40 |
| `{{seatLevel}}` | 席别 | 硬座 |
| `{{carriage}}` | 车厢 | 05车 |
| `{{seat}}` | 座位号 | 008号 |
| `{{seatInfo}}` | 完整座位信息 | 硬座 05车008号 |
| `{{name}}` | 姓名 | 张三 |
| `{{idNumber}}` | 证件号 | 1234***5678 |
| `{{fare}}` | 纯数字票价 | 2.00 |
| `{{fareWithSymbol}}` | 带符号票价 | ¥ 2.00 |
| `{{ticketNumber}}` | 票号 | 12345678901234567890 |
| `{{typeOfBusiness}}` | 业务类型 | 退 |
| `{{businessTag}}` | 业务标签 | 【退】 |
| `{{airConditioning}}` | 空调 | 新空调 |
| `{{eTicketNumber}}` | 电子票号 | ... |

### 4. 提供的模板

- **经典样式** (`/ticket-template.svg`)
  - 蓝色边框
  - 传统布局
  - 装饰线条

- **现代样式** (`/templates/modern.svg`)
  - 渐变背景
  - 卡片式设计
  - 图标装饰
  - 扁平化风格

## 📁 文件结构

```
ticket-holder-browser/
├── public/
│   ├── ticket-template.svg          # 经典模板（默认）
│   └── templates/
│       ├── README.md                # 模板目录说明
│       └── modern.svg               # 现代模板
├── src/
│   ├── utils/
│   │   └── ticketImageGenerator.ts # 核心生成器
│   └── components/
│       └── TicketImagePreview.vue   # 预览组件
├── SVG_TEMPLATE_GUIDE.md            # SVG 模板使用指南
└── ILLUSTRATOR_GUIDE.md             # Illustrator 制作教程
```

## 🎨 工作流程

### 设计师工作流

1. 在 Illustrator 中设计模板（1011×638px）
2. 使用 `{{fieldName}}` 作为占位符
3. 导出为 SVG，保持文本可编辑
4. 放到 `public/templates/` 目录

### 开发者工作流

1. 引用模板 URL
2. 传入车票数据
3. 系统自动替换占位符
4. 生成 PNG 图片

### 用户工作流

1. 上传车票文件
2. 选择模板样式
3. 预览效果
4. 下载图片

## 🔧 使用示例

### 基础使用

```typescript
import { generateTicketImage } from '@/utils/ticketImageGenerator'

// 使用 SVG 模板
const imageUrl = await generateTicketImage(ticketData, {
  templateUrl: '/ticket-template.svg'
})

// 使用 Canvas 绘制（不提供 templateUrl）
const imageUrl = await generateTicketImage(ticketData)
```

### 多模板选择

```vue
<script setup>
const templates = [
  { label: '经典样式', value: '/ticket-template.svg' },
  { label: '现代样式', value: '/templates/modern.svg' },
  { label: '自定义', value: '/templates/custom.svg' }
]

const selectedTemplate = ref('/ticket-template.svg')

async function generate() {
  const imageUrl = await generateTicketImage(ticketData, {
    templateUrl: selectedTemplate.value
  })
}
</script>

<template>
  <select v-model="selectedTemplate" @change="generate">
    <option v-for="tpl in templates" :value="tpl.value">
      {{ tpl.label }}
    </option>
  </select>
</template>
```

## 🎯 技术特点

### 1. 灵活性
- ✅ 支持任意数量的模板
- ✅ 设计与代码分离
- ✅ 易于扩展新字段

### 2. 兼容性
- ✅ SVG 模板加载失败时自动回退到 Canvas
- ✅ 支持现代浏览器
- ✅ 移动端友好

### 3. 性能
- ✅ 纯前端生成，无服务器压力
- ✅ 即时预览
- ✅ Canvas 硬件加速

### 4. 可维护性
- ✅ 占位符统一管理
- ✅ 模块化设计
- ✅ 详细文档

## 📝 创建新模板步骤

1. **打开 Illustrator**
   - 新建：1011×638px, RGB, 300PPI

2. **设计布局**
   - 添加背景、边框、装饰
   - 放置文本占位符 `{{fieldName}}`

3. **导出 SVG**
   - 文件 → 存储为 → SVG
   - 字体类型：SVG（保持可编辑）
   - 图像：嵌入

4. **放置文件**
   - 保存到 `public/templates/your-template.svg`

5. **添加到选项**
   ```typescript
   const templates = [
     // ...existing
     { label: '你的模板', value: '/templates/your-template.svg' }
   ]
   ```

6. **测试**
   - 上传测试数据
   - 选择新模板
   - 检查效果

## 🚀 扩展建议

### 1. 添加更多模板
```
templates/
├── classic.svg       # 经典
├── modern.svg        # 现代
├── minimal.svg       # 简约
├── colorful.svg      # 彩色
├── dark.svg          # 暗色主题
└── premium.svg       # 高级版
```

### 2. 自定义选项
```typescript
interface TicketImageOptions {
  templateUrl?: string
  width?: number
  height?: number
  backgroundColor?: string  // 背景色
  accentColor?: string      // 强调色
  fontSize?: number         // 字体缩放
}
```

### 3. 实时编辑
- 提供可视化编辑器
- 拖拽调整元素位置
- 实时预览更改

### 4. 批量处理
```typescript
async function generateBatch(tickets: ParsedData[]) {
  return Promise.all(
    tickets.map(ticket => generateTicketImage(ticket, options))
  )
}
```

## 📚 相关文档

- `SVG_TEMPLATE_GUIDE.md` - SVG 模板使用指南
- `ILLUSTRATOR_GUIDE.md` - Illustrator 详细教程
- `public/templates/README.md` - 模板目录说明

## 💡 最佳实践

1. **设计规范**
   - 遵循尺寸标准
   - 使用安全边距
   - 保持视觉一致性

2. **占位符命名**
   - 驼峰命名法
   - 语义化清晰
   - 避免特殊字符

3. **文件管理**
   - 模板按类型分类
   - 使用版本号
   - 保留源文件

4. **测试验证**
   - 多种数据测试
   - 检查边界情况
   - 验证中文显示

## 🎉 总结

现在你的项目支持：
- ✅ 使用 Illustrator 设计专业模板
- ✅ 通过占位符自动填充数据
- ✅ 生成高质量 PNG 图片
- ✅ 多模板切换
- ✅ 灵活扩展

完全满足在浏览器端生成精美车票图片的需求！
