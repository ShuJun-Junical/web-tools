# 车票模板目录

将你的 SVG 模板放在这个目录中。

## 目录结构

```
public/templates/
  ├── README.md           # 本文件
  ├── classic.svg         # 经典样式模板
  ├── modern.svg          # 现代样式模板
  └── minimal.svg         # 简约样式模板
```

## 使用方法

在代码中引用：

```typescript
// 单个模板
const imageUrl = await generateTicketImage(ticketData, {
  templateUrl: '/templates/classic.svg'
})

// 多模板选择
const templates = {
  classic: '/templates/classic.svg',
  modern: '/templates/modern.svg',
  minimal: '/templates/minimal.svg'
}

const imageUrl = await generateTicketImage(ticketData, {
  templateUrl: templates[selectedTemplate]
})
```

## 模板要求

1. 尺寸: 1011 × 638 px (85.6mm × 54mm @ 300dpi)
2. 格式: SVG 1.1
3. 使用 `{{fieldName}}` 作为占位符
4. 文本不要转换为轮廓（保持可编辑）

详细说明请查看 `ILLUSTRATOR_GUIDE.md` 和 `SVG_TEMPLATE_GUIDE.md`。
