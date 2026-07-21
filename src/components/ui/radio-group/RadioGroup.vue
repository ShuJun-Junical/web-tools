<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

const model = defineModel<string>({ required: true })
defineProps<{
  items: { value: string, label: string }[]
  label: string
}>()
</script>

<template>
  <RadioGroupRoot v-model="model" class="inline-grid grid-flow-col rounded-lg bg-muted p-1" :aria-label="label">
    <RadioGroupItem v-for="item in items" :key="item.value" :value="item.value" class="rounded-md px-5 py-1.5 text-sm text-muted-foreground outline-none transition-colors data-[state=checked]:bg-background data-[state=checked]:font-medium data-[state=checked]:text-foreground data-[state=checked]:shadow-sm focus-visible:ring-2 focus-visible:ring-ring">
      {{ item.label }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
