<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="mx-auto max-w-xl py-24 text-center">
    <p class="text-sm font-semibold text-muted-foreground">404</p>
    <h1 class="mt-2 text-3xl font-bold">页面未找到</h1>
    <p class="mt-3 text-muted-foreground">这个地址没有对应的工具。</p>
    <Button as-child class="mt-6">
      <RouterLink to="/">返回首页</RouterLink>
    </Button>
  </div>
</template>
