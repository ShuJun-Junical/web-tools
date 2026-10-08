import path from 'node:path'
import { createRequire } from 'node:module'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

const require = createRequire(import.meta.url)

/**
 * 命名实体解码器 decode-named-character-reference 的无 DOM 入口。
 *
 * 它在 `browser` 条件下会切到 index.dom.js，而那个文件在模块顶层就 `document.createElement`，
 * 于是 docx 的 Web Worker 求值时直接抛 `document is not defined`，整个 worker 起不来——
 * zip 和文件夹两条路都会失败。index.js 是同包的 character-entities 查表实现，浏览器里可用。
 *
 * 它是 micromark 的传递依赖，pnpm 不会提升到根目录，所以借 remark-parse 的位置向上定位，
 * 这样拿到的是 micromark 实际装的那一份，不会和上游版本漂移，也不用把它提成直接依赖。
 */
const entityDecoderEntry = require.resolve('decode-named-character-reference', {
  paths: [path.dirname(require.resolve('remark-parse'))],
})

export default defineConfig({
  test: {
    setupFiles: ['src/tests/setup.ts'],
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            // zeroperl wasm（约 24MB）供 EXIF 工具懒加载：不进预缓存清单，
            // 避免所有访客安装 PWA 时立即下载；首次使用时缓存，之后可离线处理图片。
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              cacheableResponse: {
                statuses: [0, 200],
              },
              precacheFallback: {
                fallbackURL: '/index.html',
              },
            },
          },
        ],
      },
      manifest: {
        name: '纾浚的工具站',
        short_name: '工具站',
        description: '完全在浏览器本地运行的实用工具集',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#171717',
        background_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Web Worker 里没有 document，必须走查表版解码器；dev 预构建与生产 worker 都吃这条 alias。
      'decode-named-character-reference': entityDecoderEntry,
    },
  },
})
