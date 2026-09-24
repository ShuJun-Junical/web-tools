<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { Check, ChevronDown } from '@lucide/vue';
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';
import { cn } from '@/lib/utils';

const model = defineModel<AcceptableValue>({ required: true });
const props = defineProps<{
  items: { value: AcceptableValue; label: string }[];
  label?: string;
  placeholder?: string;
  class?: HTMLAttributes['class'];
}>();

const selectedLabel = computed(
  () => props.items.find((item) => Object.is(item.value, model.value))?.label
);
</script>

<template>
  <SelectRoot v-model="model">
    <SelectTrigger
      :aria-label="label"
      :class="
        cn(
          'border-input bg-background flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          props.class
        )
      "
    >
      <SelectValue :placeholder="placeholder">{{ selectedLabel ?? placeholder }}</SelectValue>
      <ChevronDown class="size-4 opacity-50" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        <SelectViewport class="p-1">
          <SelectItem
            v-for="item in items"
            :key="String(item.value)"
            :value="item.value"
            class="relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            <SelectItemText>{{ item.label }}</SelectItemText>
            <SelectItemIndicator class="absolute right-2 flex size-4 items-center justify-center"
              ><Check class="size-4"
            /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
