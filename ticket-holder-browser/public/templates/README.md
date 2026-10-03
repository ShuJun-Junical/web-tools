# 车票 SVG 模板

把设计好的车票 SVG 放进这个目录，在应用顶部的模板下拉框里就会出现。

## 尺寸

票面规格 **85.6mm × 54mm @ 300dpi**，即 `viewBox="0 0 1011 638"`。应用会把 SVG 拉伸到这个尺寸后转成 PNG，所以只要 `viewBox` 对，元素用什么单位写都行。

## 占位符

在需要填数据的位置写 `{{key}}`，例如：

```svg
<text>{{trainNumber}}</text>
<text>{{departureStation}}</text>
<text>{{phonicsOfDepartureStation}}</text>
```

**可用 key 及说明以 `src/utils/ticketImageGenerator.ts` 的 `TICKET_PLACEHOLDERS` 为准**，那一份是唯一来源。应用界面里展开「可用占位符」能看到同一份清单，永远不会过期。

模板里写错 key 会在应用内直接报错，并指出最接近的正确写法（`{{trainNubmer}}` → 提示 `{{trainNumber}}`），不会出现花括号原样印在票面上的情况。花括号内可以有空格，`{{ trainNumber }}` 同样有效。

## 隐藏证件号

勾选界面的「隐藏身份证号」后，`{{idNumber}}` 会被填成空串，同时模板中含有「证件号」字样的 `<text>` 元素会被置为 `opacity="0"`。
