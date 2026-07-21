<script setup lang="ts">
import { ref } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import { ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxItemIndicator, ComboboxPortal, ComboboxRoot, ComboboxTrigger, ComboboxViewport } from 'reka-ui'

const model = defineModel<string>({ required: true })
const props = defineProps<{
  items: { value: string, label: string }[]
  label: string
  placeholder?: string
  resolveInput: (input: string) => string | undefined
}>()
const search = ref('')

function commitInput() {
  const value = props.resolveInput(search.value.trim())
  if (value !== undefined && props.items.some(item => item.value === value)) model.value = value
  search.value = ''
}
</script>

<template>
  <ComboboxRoot v-model="model" open-on-click open-on-focus>
    <ComboboxAnchor class="border-input bg-background flex h-9 w-full items-center rounded-md border shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <ComboboxInput v-model="search" :display-value="value => items.find(item => item.value === value)?.label ?? ''" :aria-label="label" :placeholder="placeholder" class="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground" inputmode="numeric" @blur="commitInput" @keydown.enter.prevent.stop="commitInput" />
      <ComboboxTrigger class="flex h-full items-center px-2" :aria-label="`展开${label}`"><ChevronDown class="size-4 opacity-50" /></ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent position="popper" :side-offset="4" class="z-50 max-h-72 min-w-[var(--reka-combobox-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
        <ComboboxViewport class="p-1">
          <ComboboxEmpty class="p-2 text-sm text-muted-foreground">没有匹配项</ComboboxEmpty>
          <ComboboxItem v-for="item in items" :key="item.value" :value="item.value" class="relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
            <span>{{ item.label }}</span><span class="sr-only">{{ item.value }}</span>
            <ComboboxItemIndicator class="absolute right-2"><Check class="size-4" /></ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
