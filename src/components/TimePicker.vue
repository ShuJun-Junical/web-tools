<script setup lang="ts">
import { computed } from 'vue';
import { Time } from '@internationalized/date';
import { Clock } from '@lucide/vue';
import type { TimeValue } from 'reka-ui';
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  TimeFieldInput,
  TimeFieldRoot,
} from 'reka-ui';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const hour = defineModel<string>('hour', { required: true });
const minute = defineModel<string>('minute', { required: true });
const hourItems = Array.from({ length: 24 }, (_, value) => ({
  value: String(value),
  label: `${String(value).padStart(2, '0')} 时`,
}));
const minuteItems = Array.from({ length: 60 }, (_, value) => ({
  value: String(value),
  label: `${String(value).padStart(2, '0')} 分`,
}));

const time = computed<TimeValue | undefined>({
  get: () =>
    hour.value && minute.value ? new Time(Number(hour.value), Number(minute.value)) : undefined,
  set: (value) => {
    hour.value = value ? String(value.hour) : '';
    minute.value = value ? String(value.minute) : '';
  },
});
</script>

<template>
  <div class="block text-sm font-medium">
    <p id="birth-time-label">出生时间</p>
    <div class="mt-2 flex gap-2">
      <TimeFieldRoot
        v-slot="{ segments }"
        v-model="time"
        locale="zh-CN"
        :hour-cycle="24"
        granularity="minute"
        aria-labelledby="birth-time-label"
        class="border-input bg-background flex h-9 min-w-0 flex-1 items-center rounded-md border px-3 text-sm shadow-xs outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      >
        <TimeFieldInput
          v-for="segment in segments"
          :key="segment.part"
          :part="segment.part"
          :class="
            segment.part === 'literal'
              ? 'text-muted-foreground'
              : 'rounded px-0.5 tabular-nums outline-none focus:bg-accent'
          "
        >
          {{ segment.value }}
        </TimeFieldInput>
      </TimeFieldRoot>
      <PopoverRoot>
        <PopoverTrigger as-child
          ><Button type="button" variant="outline" size="icon" aria-label="打开时间选择器"
            ><Clock /></Button
        ></PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            :side-offset="4"
            align="end"
            class="z-50 w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
          >
            <p class="mb-3 text-sm font-medium">选择出生时间</p>
            <div class="grid grid-cols-2 gap-2">
              <Select v-model="hour" :items="hourItems" label="时" placeholder="时" />
              <Select v-model="minute" :items="minuteItems" label="分" placeholder="分" />
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
    </div>
  </div>
</template>
