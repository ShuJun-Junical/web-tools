# 工具站开发约定

## 约定维护

- 项目级别的约定、技术选型、目录职责、测试策略或验证要求发生变更时，必须在同一次修改中同步更新本文件。

## 提交约定

### 消息格式

```
<类型>: <简短描述>
```

- 使用中文描述
- 类型小写（如 `fix:`、`feat:`、`style:`）
- 描述简洁，不超过 50 字

### 常用类型

| 类型 | 说明 |
|------|------|
| `fix:` | 缺陷修复 |
| `feat:` | 新功能 |
| `style:` | 代码格式、样式（不影响功能的改动） |
| `refactor:` | 重构（不改变功能） |
| `docs:` | 文档更新 |
| `deps:` | 依赖变更 |
| `test:` | 测试相关 |

### 示例

```
fix: 支持多条 toast 队列与去重
feat: 新增 Base64 图片编解码工具
style: 格式化所有源文件
deps: 添加 prettier 作为开发依赖
```

## 项目定位

- 本项目是纯前端静态工具站，所有数据默认只在浏览器本地处理，不上传用户输入或文件。
- 技术栈为 Vue 3、Vite、TypeScript、Vue Router、Tailwind CSS、shadcn-vue 和 VueUse；文档转换另用 remark 生态（`remark-parse`、`remark-gfm`、`remark-docx`、`docx`）和 `fflate` 处理 zip。
- 构建产物为 `dist/`，不增加后端、Nuxt、SSG、Pinia 等能力，除非当前需求明确需要。
- 路由使用 HTML5 History 模式，部署端必须将未知路径回退到 `/index.html`。

## 文档转换引擎

- Markdown 转 Word 固定用 `remark-docx`，在 Web Worker 内运行，不进首包。
- 不要改用 pandoc.wasm：它需要额外下载约 15MB，且 WASI 虚拟文件系统按扁平 Map 存放文件，`![](images/a.png)` 这类子目录引用会只报 WARNING 并把图片替换成说明文字，官方 app 只能靠「压平文件名 + resource-path」绕过，会丢失目录语义。
- 需要 PDF 输出时走 `remark-pdf`（pdfkit），不引入 Typst 或 headless 浏览器。
- `remark-docx` 对缺失、超限格式和代码块都是静默降级。自建管线必须自己拦截并把失败原因回传页面，禁止让转换"看起来成功但内容缺失"。
- `docx` 必须与 `remark-docx` 锁定同一版本，避免重复打包两份。
- Web Worker 里没有 `document`。客户端构建会按 `browser` 条件解析到依赖的 DOM 版本，模块顶层一求值整个 worker 就起不来，页面只显示"转换引擎启动失败"。`decode-named-character-reference` 已知会切到用 `document` 的 `index.dom.js`，已在 `vite.config.ts` 用 `resolve.alias` 钉回查表版 `index.js`。新增会进这条链的依赖前，先确认它在 worker 里求值不碰 DOM；Vite 8/Rolldown 下自定义插件的 `resolveId` 对 `node_modules` 内部的裸导入不生效，只能靠 `resolve.alias`。
- `File` 的 `webkitRelativePath` 不会被结构化克隆带走，`postMessage` 把 File 发进 worker 会退化成只有文件名。文件夹来源必须由主线程把相对路径一起发过去，否则主文档丢目录、图片只能靠文件名唯一性兜底。
- Worker 里无法把 SVG 栅格化成 PNG，`remark-docx` 会静默丢弃。SVG 与 WebP 一并在 `load` 里拦下并回报原因。
- 拖拽区要同时吃下 zip 和文件夹：`dataTransfer.files` 遇到目录只会给一个读不出字节的空壳 File，只有 `webkitGetAsEntry` 能拿到目录树，必须自己递归（`readEntries` 一次最多一批，读到空批次才算完）。相对路径按 `webkitdirectory` 的口径拼，两种来源才能共用一套解析。
- 发给 worker 的载荷不能是 Vue 的 reactive Proxy，`postMessage` 会报 `[object Array] could not be cloned`。这类"整份替换、只用于发消息"的状态用 `shallowRef`，不要用 `ref`。
- 拖进来的文件先校验 zip 魔数再报错。系统读文件失败抛的是 `NSFileNoSuchFileError` 这类原始文案，对用户没有指导意义，一律换成能照做的提示。
- `run()` 里 `postMessage` 同步抛错时走不到 `onmessage`/`onerror`，`busy` 必须在 `convert()` 的 catch 里兜住，否则界面永远停在"转换中"。

## PWA 更新与缓存

- 使用 `vite-plugin-pwa` 的 `generateSW` 模式和 `prompt` 更新策略，不维护自定义 Service Worker。
- 页面导航请求使用 Workbox `NetworkFirst`：在线时优先获取最新 HTML，网络失败时回退运行时缓存或预缓存的 `/index.html`。
- 页面首次打开和主动刷新不展示更新提示；页面持续打开满 1 小时后，每小时检查一次 Service Worker，有新版时才提示用户更新。
- 部署端需避免长期缓存 `index.html` 和 `sw.js`，否则线上版本生效会被延迟。

## 目录职责

```text
src/
├── pages/          # 路由页面；按工具类别分目录；只放路由组件
├── components/     # 站点通用组件；非路由的页面专属子组件也放这里（如 ExifFieldRow）
│   └── ui/         # shadcn-vue 基础组件源码
├── composables/    # 依赖 Vue 响应式、生命周期或浏览器状态的复用逻辑
├── lib/            # 与 Vue 无关的纯 TypeScript 逻辑
├── router/         # 路由实例
├── tests/          # Vitest 纯逻辑与组件交互测试
├── tools.ts        # 工具目录、导航和路由的唯一数据源
├── App.vue         # 全站外壳与响应式导航
└── style.css       # Tailwind 入口与全局设计变量
```

## 新增和修改工具

- 新工具页面使用 PascalCase 命名，放入对应的 `src/pages/<category>/` 目录。
- 在 `src/tools.ts` 登记路径、标题、说明和懒加载组件。首页、侧栏和工具路由都由这份数据生成，不在其他位置重复维护工具列表。
- 工具页使用 `ToolPage` 保持标题、分类、说明和内容宽度一致。
- 页面内出现第二处使用的交互模板（如 EXIF 页的字段编辑行）提取为组件；非路由页面根组件一律不得放入 `src/pages/`，统一放在 `src/components/`。
- 保留已发布 URL；确需改路径时，同时处理旧链接和部署影响。
- 仅供开发和调试的页面（如 Toast 测试页）放在 `src/pages/dev/`，并在 `src/tools.ts` 中用 `import.meta.env.DEV` 挂载：生产构建既不进导航，也不会打包该页面。
- 简单工具优先写在单个 `.vue` 文件内。出现以下情况再提取：
  - 逻辑需要独立测试；
  - 已被第二处使用；
  - 包含较复杂的异步状态、资源释放或生命周期；
  - 页面已难以看清输入、处理和输出流程。
- 纯计算、解析和格式转换放在 `src/lib/`，不得依赖 Vue 或 DOM。
- 只有依赖 `ref`、`computed`、生命周期或浏览器响应式状态的逻辑才写 composable。

## UI 与交互

- 涉及 shadcn-vue、Reka UI 或基础 UI 控件的新增、修改、修复和调试时，必须先使用项目提供的 `shadcn` skill，并遵循其组件检索、文档核对和复用流程。
- 组件 API、属性、事件、组合方式和无障碍行为以官方 LLM 文档为依据：
  - Reka UI：https://reka-ui.com/llms.txt
  - shadcn/ui：https://ui.shadcn.com/llms.txt
- 页面布局和视觉优先使用 Tailwind CSS；复用已有 shadcn-vue 组件，只添加当前功能实际需要的组件。
- 新增按钮、单选组、复选框、选择器、弹层、日期选择器等基础交互控件前，必须先检查 `src/components/ui/`、shadcn-vue 和已安装的 Reka UI；已有对应 primitive 时直接复用或按 shadcn-vue 规范补充到 `src/components/ui/`，不得用原生标签加样式仿写同类基础组件。原生控件仅在其平台能力本身就是需求，或现有 UI 库没有对应能力时使用。
- 通用页面结构使用现有组件，避免为单个页面创建一层包装组件。
- 图标使用已安装的 `@lucide/vue`。
- 优先使用原生 HTML 和浏览器能力；VueUse 已有合适 composable 时按需使用，例如剪贴板、文件选择、拖放和页面标题。
- 浏览器 API 必须处理不支持、权限拒绝和失败场景，并在页面中给出可见反馈。
- 表单控件必须有可访问名称；错误和异步结果使用 `role="alert"`、`role="status"` 或 `aria-live`；交互同时支持键盘。
- 表单实时校验错误优先在相关控件附近就地展示；互斥提示放入预留最小高度的固定区域，避免出现或消失时引发布局跳动。Toast 用于页面级、跨区域或操作结果提示，避免承载随输入实时变化的表单状态。
- 输入能够直接、低成本地产生结果的工具，优先随输入实时计算，不额外设置“开始”“转换”等提交按钮。页面首次打开且输入不完整或无效时不展示结果；已经产生过有效结果后，修改过程中出现临时无效值时保留最后一次有效结果并暂停更新，待输入重新有效后再刷新。日期、文件等关键输入默认保持未选择状态，除非产品需求明确要求预填；交互可参考硬币起卦页“未录入不展示结果、录入后即时更新”的方式。
- 不记录、上传或持久化用户输入，除非需求明确要求并说明存储位置。

## 代码约定

- 使用 TypeScript 严格模式和 `@/` 路径别名。
- 路由页面保持懒加载，避免重型工具进入首页首包。
- 先复用现有代码、标准库、浏览器原生能力和已安装依赖，再考虑增加代码或依赖。
- 不为假设中的未来需求增加抽象、兼容分支、配置项或目录。
- 修复故障前阅读完整调用链并确认根因；原因不确定时先补充最小调试信息，不基于猜测修改。
- 用户可见错误不得只写入控制台；避免吞掉异常后继续展示可能错误的结果。
- 修改 shadcn-vue 组件时保留其无障碍行为和 `cn()` 类名合并方式。
- `CalendarDatePicker` 使用 `shallowRef<CalendarDate | null>` 保存公历日期，避免 Vue 深层解包带私有字段的 `CalendarDate` 实例。

## 依赖约定

- 使用 pnpm，保持 `pnpm-lock.yaml` 与 `package.json` 同步。
- 新依赖必须解决当前明确需求；已有依赖或少量原生代码可以完成时不新增。
- 更新依赖时使用最新稳定兼容版本，不使用 beta、RC 或 canary。
- TypeScript 当前固定在最新 6.x；升级到 7.x 前必须先确认 `vue-tsc` 已兼容。
- 仅修改依赖时运行 `pnpm outdated` 并检查 peer dependency 警告。
- `docx` 是 `remark-docx` 的直接依赖，必须与 `remark-docx` 锁定同一版本，避免同一份库打包两遍。`unified` 由本项目直接声明：remark-docx 只在类型里引用它，不会带进来，保持单一版本即可。

### Agent 沙箱下的安装

带 Agent 沙箱的 Harness 通常只授予工作区写权限，而 pnpm 出于跨项目复用把 store 放在工作区之外，两者必然冲突。已知表现和解法：

- **工作区外全部只读**：`/tmp`、`/var/tmp`、`~`、`~/Library/pnpm/store` 都写不了，npm 因缓存不可写完全不可用。优先申请提权放开全局 store；提不了权时，所有 pnpm 命令必须显式指定项目内 store（`.pnpm-store` 已在 `.gitignore`）：

  ```bash
  pnpm add <pkg> --store-dir ./.pnpm-store
  ```

  省略该参数时 pnpm 会自行改指别处，报 `ERR_PNPM_UNEXPECTED_STORE`。
- **store 记录不一致没有原地修复**：既有 `node_modules` 链接自 A store、而 pnpm 想用 B store 时，`pnpm install` 只会回答 `Already up to date` 并且拒绝重链，`--force` 也无效。唯一解法是把 `node_modules` 移到回收站后重装，不要反复重试参数。
- **tarball 带 IDE 目录的包会以 `ERR_PNPM_EPERM` 中断**：沙箱禁止在 `.idea` 内创建子项，而 `iconv-lite@0.6.3` 的官方包内含 `.idea/`，部分包还带 `.gitmodules`。报错表象是 pnpm 损坏，真因是包作者把 IDE 配置发上了 npm。手工补装该包、跳过点目录，再让 pnpm 收尾：

  ```bash
  # 作用包名为 pkg@ver，scoped 包把 tarball 路径换成 /@scope/name/-/name-ver.tgz
  mkdir -p "node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>"
  curl -sL "https://registry.npmjs.org/<pkg>/-/<pkg>-<ver>.tgz" \
    | tar -xz -C "node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>" \
      --strip-components=1 --exclude='package/.idea' --exclude='package/.gitmodules'
  ```

- pnpm 在写顶层软链之前中止，所以安装失败不会留下半坏的 `node_modules`；遇到 `ERR_PNPM_EPERM` 时可直接补包继续，不必整体重来。
- 不要为了验证而在项目目录里建临时目录、探针目录或临时压缩包；验证产物只落在系统临时目录或回收站。

## 验证要求

- 分支、循环、解析器、统计公式和编解码等非平凡纯逻辑必须有最小 Vitest 覆盖。
- 修改对应逻辑时至少覆盖正常输入、空输入和已知失败边界；不为一行直观模板代码增加测试。
- 页面中有自有交互逻辑时，使用 `@vue/test-utils` 挂载组件，并通过 `jsdom` 环境验证用户输入、触发事件后的可见结果或控件状态；无需为静态模板添加测试。
- Vitest 通过 `src/tests/setup.ts` 为 jsdom 提供 `ResizeObserver` 存根，使 Reka portal 定位组件（Tooltip 等）展开态可在测试中断言。
- 测试范围按单个导出函数判断，先阅读其完整实现和调用链，不得按文件、模块或功能分组一并保留或删除测试。
- 仅当某个函数完全直接委托现有 npm 包的方法，且未增加任何项目逻辑时才不写单测，信任依赖本身的测试；同模块中的正则识别、校验、转换、组合、错误处理等自有逻辑必须分别保留或补充测试。
- 删除已有测试前，逐项确认被测函数和断言的归属；仅删除直接验证第三方实现的断言，保留验证项目自有行为的断言。
- 完成代码修改后运行：

```bash
pnpm typecheck
pnpm test
pnpm build
```

- 涉及导航、文件、剪贴板、下载或响应式布局时，再做对应浏览器手工验证。
- 不提交 `dist/`、缓存、日志或本地环境文件。
