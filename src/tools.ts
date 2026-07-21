export const toolGroups = [
  {
    title: '周易预测',
    tools: [
      {
        path: '/iching/coin',
        title: '铜钱起卦',
        description: '用三枚铜钱法随机起卦，查看本卦、动爻和变卦。',
        component: () => import('@/pages/life/IChingPage.vue'),
      },
    ],
  },
  {
    title: '校验工具',
    tools: [
      {
        path: '/validator/chinese-id',
        title: '身份证校验',
        description: '批量检查 18 位身份证号码的 MOD 11-2 校验码。',
        component: () => import('@/pages/validator/ChineseIdPage.vue'),
      },
    ],
  },
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
      {
        path: '/statistic/correlation',
        title: '线性相关关系',
        description: '计算两组数据的 Pearson 相关系数并绘制散点图。',
        component: () => import('@/pages/statistic/CorrelationPage.vue'),
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
      {
        path: '/codec/unicode-english',
        title: 'Unicode 英文字体',
        description: '将英文字母和数字转换为多种 Unicode 字符样式。',
        component: () => import('@/pages/codec/UnicodeEnglishPage.vue'),
      },
    ],
  },
] as const;
