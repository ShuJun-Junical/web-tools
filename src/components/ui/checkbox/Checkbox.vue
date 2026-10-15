<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Check } from '@lucide/vue';
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
import { cn } from '@/lib/utils';

/**
 * 复选框
 *
 * 外层是 `<label>`，插槽内容同时充当可访问名称——这样「勾选框 + 说明文字」在
 * 标签、点击热区和读屏朗读上是同一个整体，不必再单独写 `aria-label`。
 * 键盘与 `aria-checked` 语义由 Reka UI 的 CheckboxRoot 提供。
 */
const model = defineModel<boolean>({ required: true });
const props = defineProps<{
  disabled?: boolean;
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <label class="flex items-center gap-1.5 text-sm">
    <CheckboxRoot
      v-model="model"
      :disabled="props.disabled"
      class="flex size-4 shrink-0 items-center justify-center rounded-sm border border-input bg-transparent shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      :class="props.class"
    >
      <CheckboxIndicator class="flex items-center justify-center">
        <Check class="size-3.5" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <slot />
  </label>
</template>
