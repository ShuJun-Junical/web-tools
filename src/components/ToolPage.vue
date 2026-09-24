<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <article class="mx-auto max-w-4xl space-y-6">
    <header class="space-y-2">
      <p class="text-sm font-medium text-muted-foreground">{{ route.meta.category }}</p>
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{{ route.meta.title }}</h1>
      <p class="max-w-2xl text-muted-foreground">{{ route.meta.description }}</p>
    </header>
    <slot />
  </article>
</template>
