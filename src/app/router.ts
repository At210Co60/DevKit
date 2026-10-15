import { createRouter, createWebHistory } from 'vue-router'

import { site } from '@/content'
import BasicLayout from '@/layouts/BasicLayout.vue'
import { getToolById } from '@/tools/registry'

/**
 * 路由表 —— 由 registry 驱动，零手写路径
 *
 * 只有一个通用的 `/tools/:id` 容器，具体渲染哪个工具由 ToolsView 查注册表决定。
 * 这样加工具时路由表永远不需要改。
 */
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: BasicLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: undefined as string | undefined },
        },
        {
          path: 'tools/:id',
          name: 'tool',
          component: () => import('@/views/ToolsView.vue'),
          meta: { title: undefined as string | undefined },
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('@/views/NotFoundView.vue'),
          meta: { title: undefined as string | undefined },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  // 工具路由从注册表查名字，标题永远和清单一致，不会出现「改名后标题忘了改」
  const title = to.name === 'tool' ? getToolById(String(to.params.id))?.name : undefined
  document.title = site.titleTemplate(title ?? (to.meta.title as string | undefined))
})
