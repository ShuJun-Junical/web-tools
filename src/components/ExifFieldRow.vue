<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CircleHelp } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { fieldInfoFor } from '@/lib/exif-presets';
import type { ExifField } from '@/lib/exif-types';

const props = defineProps<{ field: ExifField; editing: boolean; busy: boolean; locked: boolean }>();
const emit = defineEmits<{ edit: []; apply: [value: string]; remove: []; cancel: [] }>();

const draft = ref('');
watch(
  () => props.editing,
  (editing) => {
    if (editing) draft.value = props.field.value;
  }
);
const composite = computed(() => /^[[{]/.test(props.field.value));
const info = computed(() => fieldInfoFor(props.field.name));
</script>

<template>
  <div class="border-b py-1.5 last:border-b-0">
    <div class="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)_auto]">
      <div class="min-w-0">
        <p class="flex items-center gap-1.5 truncate text-sm font-medium" :title="field.key">
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
        <p v-if="info" class="truncate font-mono text-xs text-muted-foreground/70">
          {{ field.name }}
        </p>
      </div>
      <p class="truncate text-sm text-muted-foreground" :title="field.value">{{ field.value }}</p>
      <div class="flex justify-end gap-1">
        <Button variant="ghost" size="sm" :disabled="busy || locked" @click="emit('edit')"
          >编辑</Button
        >
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
    <div v-if="editing" class="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Input v-model="draft" :aria-label="`修改 ${field.name}`" />
      <div class="flex gap-1">
        <Button size="sm" :disabled="busy" @click="emit('apply', draft)">应用</Button>
        <Button size="sm" variant="ghost" @click="emit('cancel')">取消</Button>
      </div>
      <p v-if="composite" class="text-xs text-muted-foreground sm:col-span-2">
        该字段是数组或复合值，将以文本写入，类型可能改变。
      </p>
    </div>
  </div>
</template>
