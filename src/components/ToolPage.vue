<script setup lang="ts">
defineProps<{
  title: string
  category: string
  description: string
}>()
</script>

<template>
  <article class="mx-auto max-w-4xl space-y-6">
    <header class="space-y-2">
      <p class="text-sm font-medium text-muted-foreground">{{ category }}</p>
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{{ title }}</h1>
      <p class="max-w-2xl text-muted-foreground">{{ description }}</p>
    </header>
    <slot />
  </article>
</template>
