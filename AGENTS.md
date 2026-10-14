# AGENTS.md

赛博车票夹 / Ticket Holder —— 把 12306 的铁路电子客票（`.ofd` / `.pdf`）还原成可收藏的车票图片。仓库根级的约定都在这里；子项目 `ticket-holder-browser/` 有自己的 `AGENTS.md`，只管前端应用内部的事。

## 🔒 隐私红线（最高优先级，违反即事故）

电子客票文件包含**姓名、身份证号、完整行程与电子客票号**，这个组合足以在 12306 侧交叉验证到本人的真实乘车记录。

| 目录 | 内容 | 入库 |
|------|------|------|
| `private/` | 真实 `.ofd` / `.pdf` 票据及解包结果 | ❌ 已忽略 |
| `design/` | 含证件信息的照片、Illustrator 源文件 | ❌ 已忽略 |
| `reference/` | 财政部公开规范与官方实例文档 | ✅ 入库 |
| `script/` | 命令行工具 | ✅ 入库 |
| `ticket-holder-browser/` | 应用源码 | ✅ 入库 |

硬性要求：

- **绝不 `git add -f`** 绕过 `.gitignore` 往 `private/` / `design/` 里塞东西。
- **写代码注释、文档、测试用例时，不许写真实的姓名、证件号、车票号**，包括"当例子用"的。这是实际发生过的事故，不是假设。
- 改动落地后必须跑 `python script/check_privacy.py`，结果必须是 `✅ 检查通过`。它会检查忽略规则、已跟踪路径、Git 历史全部可达对象与工作区文件。
- `script/check_privacy.py` 里的 `ALLOWLIST` 只在 Git 历史对象里命中（工作区示例早已改写或随旧文档删除）。**不要因为"扫不到"就删条目**，删了会让自检对历史提交误报。

## 权威数据源

要核对任何一个字段，认这两份，不要认代码或文档：

| 文件 | 权威范围 |
|------|---------|
| `reference/…/附件2：…元素清单.xlsx` | **开具方 / 接收方**元素清单、数据类型、以及**值域与备注**（`TypeOfBusiness` = 售或退；`Fare` = 票价或退票费）。xlsx 无需装 openpyxl，`zipfile` + `ElementTree` 就能读 |
| `reference/…/rai-20231231/rai/rai_cor-20231231.xsd` | 仅**数据类型**（`stringItemType` / `monetaryItemType` / `percentItemType` / `dateItemType` / `booleanItemType`）。**不含值域**——`售`、`退` 这类字样在 XSD 里一次都不出现 |

代码注释和 README 都是这两份的下游转写，不是依据。发现转写与规范冲突时，改代码。

## 目录职责

- `script/test.py` —— 命令行解析票据，输出 JSON
- `script/check_privacy.py` —— 仓库隐私自检，推送公开仓库前必跑
- `reference/` —— 外部公开规范，只增不改，不要往里塞自制内容
- `ticket-holder-browser/` —— Vue 3 + Vite 应用，全部处理在浏览器本地完成

## 约定

- **Markdown 一律单行成段，不要按文字宽度手动折行。**段落、列表项各占一行，由编辑器软换行。代码块和表格内除外。
- 不为项目写重复的说明文档。曾经有过 5 份互相抄写、且已经漂移的占位符清单，现已全部删除。**文档要么由代码生成，要么就别写。**

## 命令

```bash
# 隐私自检（改完必跑）
python script/check_privacy.py
python script/check_privacy.py --strict    # WARNING 也判为不通过

# 命令行解析票据
python script/test.py <车票文件路径>       # 依赖 lxml：pip install lxml

# 前端（详见 ticket-holder-browser/AGENTS.md）
cd ticket-holder-browser && pnpm install && pnpm dev
```

## 提交

- 从 `main` 切分支，不直接推 `main`。
- 用 conventional commits，但**前缀之后一律用中文**。前缀保持英文小写（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:` / `test:`），冒号后一个空格接中文摘要，不带句末标点。
- 摘要说清"改了什么"，不要只写"更新"、"修复问题"这种无信息量的词。正文和 BREAKING CHANGE 说明同样用中文。
- 改了哪一层就写哪一层的文件名，例如"前端"、"命令行"。

```
✅ fix(前端): 车次 0107 被当成数字变成 107
✅ feat(前端): 新增 departureAt 派生字段用于排序
✅ docs: 清理 7 份互相抄写且已漂移的占位符文档
✅ fix(命令行): test.py 命名空间硬编码导致 2023-12-31 规范解析为空

❌ fix: update
❌ feat(前端): 优化了一些逻辑
❌ Fix(前端): 修复车次问题
```

- 含隐私相关改动的提交，推之前先跑一遍 `check_privacy.py`。

## 待办

### 已完成

- [x] 解析层重构：`TicketData` + `TICKET_FIELDS` 单一事实来源（前端）
- [x] 修复 `fast-xml-parser` 数字化 bug：车次 `0107` 变 `107`、25 位电子客票号被静默截断成 `2.2513940860807977e+24`（前端）
- [x] 领域层 `Ticket` + `toTicket()`，`departureAt` 用固定 UTC+8（前端）
- [x] 字段精简：删 6 个 receiver-only 字段，8 个标 `display: 'hidden'`（前端）
- [x] 渲染层 `TICKET_PLACEHOLDERS` + 占位符拼错即报错（前端）
- [x] 修复 `businessTag` 在售票票上渲染出 `【售】` 的 bug（前端）
- [x] 清理 7 份过时文档（根 + 前端各一份 AGENTS.md 除外）
- [x] 隐私自检工具 `check_privacy.py`

### 未完成

- [ ] **`script/test.py` 对 2023-12-31 版规范完全失效。**`test.py:28` 把命名空间硬编码成 `2021-11-30/rai`，而官方实例用 `2023-12-31/rai`，`startswith` 过滤会把所有字段滤掉、返回空结果。已用等价实现静态确认（保留 0 个字段）。修法：别按命名空间前缀过滤，或同时接受两个版本。
- [ ] **`script/test.py` 的数据形状是旧的**：金额仍返回 `{value, unit, decimals}` 包装，没有类型分层、没有 `extra` 兜底。是否跟进前端的 `TicketData` 模型待定。
- [ ] `lxml` 未安装，`script/test.py` 目前跑不起来（README 已写依赖）。
- [ ] **多票收藏功能整体未做**：`byDepartureAt()`、`getDepartureAt()` 已就绪，但没有持久化（IndexedDB？）、没有排序 UI、没有按月/线路分组视图。用户明确说过"网站后面可能要拿来做排序"。
- [ ] 没有任何自动化测试。本轮的所有验证都是临时脚本、验完即删，`src/` 下没有 `*.test.ts`。

详细到文件行级别的待办见 `ticket-holder-browser/AGENTS.md`。
