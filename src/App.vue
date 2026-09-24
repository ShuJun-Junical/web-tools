<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTitle } from '@vueuse/core';
import { Menu, Wrench, X } from '@lucide/vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { Button } from '@/components/ui/button';
import { ToastHost } from '@/components/ui/toast';
import { toolGroups } from '@/tools';

const updateCheckInterval = 60 * 60 * 1000;
const route = useRoute();
const navigationOpen = ref(false);
const pageLongLived = ref(false);
const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    window.setInterval(() => {
      pageLongLived.value = true;
      if (!registration.installing && navigator.onLine) {
        void registration.update().catch(() => undefined);
      }
    }, updateCheckInterval);
  },
});
const pageTitle = computed(() => `${String(route.meta.title ?? '工具站')} | 纾浚的工具站`);

useTitle(pageTitle);
watch(
  () => route.path,
  () => {
    navigationOpen.value = false;
  }
);
</script>

<template>
  <div class="min-h-screen bg-muted/30">
    <header class="fixed inset-x-0 top-0 z-40 h-16 border-b bg-background/95 backdrop-blur">
      <div class="flex h-full items-center gap-3 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          class="lg:hidden"
          :aria-label="navigationOpen ? '关闭导航' : '打开导航'"
          :aria-expanded="navigationOpen"
          aria-controls="site-navigation"
          @click="navigationOpen = !navigationOpen"
        >
          <X v-if="navigationOpen" />
          <Menu v-else />
        </Button>
        <RouterLink to="/" class="flex items-center gap-2 rounded-md font-semibold">
          <span
            class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <Wrench class="size-4" aria-hidden="true" />
          </span>
          工具站
        </RouterLink>
      </div>
    </header>

    <button
      v-if="navigationOpen"
      class="fixed inset-0 z-20 bg-foreground/20 lg:hidden"
      aria-label="关闭导航"
      @click="navigationOpen = false"
    />

    <aside
      id="site-navigation"
      class="fixed inset-y-16 left-0 z-30 w-72 border-r bg-background p-4 transition-transform lg:translate-x-0"
      :class="navigationOpen ? 'translate-x-0' : '-translate-x-full'"
      aria-label="工具导航"
    >
      <nav class="space-y-6">
        <section v-for="group in toolGroups" :key="group.title">
          <h2 class="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ group.title }}
          </h2>
          <ul class="space-y-1">
            <li v-for="tool in group.tools" :key="tool.path">
              <RouterLink
                :to="tool.path"
                class="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                active-class="bg-accent font-medium"
              >
                {{ tool.title }}
              </RouterLink>
            </li>
          </ul>
        </section>
      </nav>
    </aside>

    <main class="pt-16 lg:pl-72">
      <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <RouterView />
      </div>
    </main>

    <ToastHost />

    <section
      v-if="pageLongLived && needRefresh"
      class="fixed inset-x-4 bottom-4 z-50 rounded-lg border bg-background p-4 shadow-lg sm:left-auto sm:right-4 sm:w-80"
      role="status"
      aria-live="polite"
    >
      <p class="text-sm font-medium">工具站已有新版本</p>
      <p class="mt-1 text-sm text-muted-foreground">更新会刷新当前页面，请先保存正在处理的内容。</p>
      <div class="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" @click="needRefresh = false"> 稍后 </Button>
        <Button size="sm" @click="updateServiceWorker()"> 立即更新 </Button>
      </div>
    </section>
  </div>
</template>
