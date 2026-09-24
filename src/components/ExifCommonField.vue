<script setup lang="ts">
import { computed } from 'vue';
import { CircleHelp } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { fieldInfoFor } from '@/lib/exif-presets';
import type { ExifField } from '@/lib/exif-types';

const props = defineProps<{ field: ExifField; busy: boolean; locked: boolean }>();
const emit = defineEmits<{ remove: [] }>();

const info = computed(() => fieldInfoFor(props.field.name));
</script>

<template>
  <div class="border-b py-1.5 last:border-b-0">
    <div class="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[10rem_12rem_minmax(0,1fr)_auto]">
      <p class="flex items-center gap-1.5 truncate text-sm font-medium">
        {{ info?.label ?? field.name }}
        <Tooltip v-if="info?.description">
          <template #trigger>
            <button
              type="button"
              class="shrink-0 text-muted-foreground hover:text-foreground"
              :aria-label="`什么是「${info?.label}」`"
            >
              <CircleHelp class="size-3.5" aria-hidden="true" />
            </button>
          </template>
          {{ info?.description }}
        </Tooltip>
      </p>
      <p class="truncate font-mono text-xs text-muted-foreground/70" :title="field.key">
        {{ field.key }}
      </p>
      <p class="truncate text-sm" :title="field.value">{{ field.value }}</p>
      <Button
        variant="ghost"
        size="sm"
        class="hover:text-destructive"
        :disabled="busy || locked"
        @click="emit('remove')"
        >删除</Button
      >
    </div>
  </div>
</template>
