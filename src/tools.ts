export const toolGroups = [
  {
    title: '统计学计算器',
    tools: [
      {
        path: '/statistic/data',
        title: '描述统计',
        description: '计算一组数据的常用描述统计量。',
        component: () => import('@/pages/statistic/DataPage.vue'),
      },
      {
        path: '/statistic/independence',
        title: '列联表和独立性检验',
        description: '计算 2×2 列联表的 Pearson 卡方统计量。',
        component: () => import('@/pages/statistic/IndependencePage.vue'),
      },
    ],
  },
  {
    title: '编解码工具',
    tools: [
      {
        path: '/codec/base64',
        title: 'Base64 文本',
        description: '在 UTF-8 文本与 Base64 之间转换。',
        component: () => import('@/pages/codec/Base64Page.vue'),
      },
      {
        path: '/codec/base64img',
        title: 'Base64 图片',
        description: '在图片文件与 Data URL 之间转换。',
        component: () => import('@/pages/codec/Base64ImagePage.vue'),
      },
      {
        path: '/codec/urlcodec',
        title: 'URL 编解码',
        description: '对 URL 组件进行编码和解码。',
        component: () => import('@/pages/codec/UrlCodecPage.vue'),
      },
    ],
  },
] as const
