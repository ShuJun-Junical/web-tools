<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { ref } from 'vue';
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps<{ class?: HTMLAttributes['class'] }>();
const open = ref(false);
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <TooltipRoot v-model:open="open" disable-closing-trigger>
      <TooltipTrigger as-child :class="cn('outline-none', $props.class)" @click="open = !open">
        <slot name="trigger" />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="top"
          :side-offset="6"
          class="z-50 w-max max-w-80 rounded-md border bg-popover px-3 py-2 text-sm leading-relaxed text-popover-foreground shadow-md"
        >
          <slot />
          <TooltipArrow class="size-2 -translate-y-1/2 fill-popover" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
