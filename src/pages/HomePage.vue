<script setup lang="ts">
import { ArrowRight } from '@lucide/vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toolGroups } from '@/tools';
</script>

<template>
  <div class="space-y-10">
    <header class="max-w-3xl space-y-4 py-6">
      <p class="text-sm font-semibold text-muted-foreground">浏览器本地工具集</p>
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">简单、直接、无需上传数据</h1>
      <p class="text-lg leading-8 text-muted-foreground">
        统计计算与编解码工具都在当前浏览器中完成。
      </p>
    </header>

    <section v-for="group in toolGroups" :key="group.title" class="space-y-4">
      <h2 class="text-xl font-semibold">{{ group.title }}</h2>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RouterLink
          v-for="tool in group.tools"
          :key="tool.path"
          :to="tool.path"
          class="group rounded-xl"
        >
          <Card class="h-full transition-colors group-hover:border-foreground/30">
            <CardHeader>
              <CardTitle class="flex items-center justify-between gap-3 text-lg">
                {{ tool.title }}
                <ArrowRight
                  class="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </CardTitle>
              <CardDescription>{{ tool.description }}</CardDescription>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">打开工具</CardContent>
          </Card>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
