import { createRouter, createWebHistory } from 'vue-router';
import { toolGroups } from '@/tools';

/** 仅开发环境可访问的内部测试页：生产构建里既不出现在导航，也不会被打进产物。 */
export const devToolGroups = import.meta.env.DEV
  ? [
      {
        title: '开发',
        tools: [
          {
            path: '/dev/toast',
            title: 'Toast 测试',
            description: '手动触发各类 Toast，观察堆叠顺序、上移补间和重复触发时的淡出重播。',
            component: () => import('@/pages/dev/ToastPage.vue'),
          },
        ],
      },
    ]
  : [];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
      meta: { title: '首页' },
    },
    ...toolGroups.flatMap((group) =>
      group.tools.map((tool) => ({
        path: tool.path,
        component: tool.component,
        meta: {
          title: tool.title,
          category: group.title,
          description: tool.description,
        },
      }))
    ),
    ...(import.meta.env.DEV
      ? devToolGroups.flatMap((group) =>
          group.tools.map((tool) => ({
            path: tool.path,
            component: tool.component,
            meta: {
              title: tool.title,
              category: group.title,
              description: tool.description,
            },
          }))
        )
      : []),
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { title: '页面未找到' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

export default router;
