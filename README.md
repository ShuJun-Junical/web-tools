# 极客学园工具站

一个基于 Vue 3、Vite、Tailwind CSS、shadcn-vue 和 VueUse 的纯前端工具站。所有输入数据都只在浏览器中处理。

## 环境

- Node.js `^20.19.0 || >=22.12.0`
- pnpm 11

## 开发

```bash
pnpm install
pnpm dev
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm outdated
```

生产构建输出到 `dist/`。

TypeScript 暂时固定在最新的 6.x 稳定版；TypeScript 7 移除了 `vue-tsc` 当前依赖的导出路径，待 `vue-tsc` 支持后再升级。

## 静态部署

项目使用 Vue Router HTML5 History 模式。静态托管平台需要把不存在的文件路径回退到 `/index.html`，否则直接访问 `/codec/base64` 等地址会返回 404。

Nginx 示例：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Netlify 可以在 `public/_redirects` 中配置：

```text
/* /index.html 200
```
