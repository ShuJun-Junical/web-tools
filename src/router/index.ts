import { createRouter, createWebHistory } from 'vue-router';
import { toolGroups } from '@/tools';

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
