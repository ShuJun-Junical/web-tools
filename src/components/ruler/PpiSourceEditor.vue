<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { calculatePpi, ppiPresets, type PresetId } from '@/lib/ruler';

export type PpiSourceKind = 'reference' | 'preset' | 'custom' | 'calibration';

export interface PpiSourceFields {
  kind: PpiSourceKind;
  preset: PresetId;
  ppi: string;
  width: string;
  height: string;
  diagonal: string;
  pxWidth: string;
}

const props = defineProps<{ modelValue: PpiSourceFields; devicePixelRatio: number }>();
const emit = defineEmits<{
  'update:modelValue': [PpiSourceFields];
  'update:ppi': [number | null];
}>();

// 内部 reactive 副本：切换 kind 时旧字段保留在同一个对象上，避免来回切丢信息。
const local = reactive<PpiSourceFields>({ ...props.modelValue });
watch(
  () => props.modelValue,
  (v) => Object.assign(local, v)
);
watch(
  local,
  (v) => emit('update:modelValue', { ...v }),
  { deep: true }
);

const sourceItems: { value: PpiSourceKind; label: string }[] = [
  { value: 'reference', label: 'CSS 参考值' },
  { value: 'preset', label: '设备预设' },
  { value: 'custom', label: '手动输入' },
  { value: 'calibration', label: '银行卡校准' },
];

const presetItems = ppiPresets.map(({ value, label }) => ({ value, label }));

const customCalculatedPpi = computed(() =>
  calculatePpi(Number(local.width), Number(local.height), Number(local.diagonal))
);
const customEnteredPpi = computed(() => {
  const v = Number(local.ppi);
  return Number.isFinite(v) && v > 0 ? v : null;
});
const calibrationPixelsPerMillimeter = computed(() => {
  const w = Number(local.pxWidth);
  return Number.isFinite(w) && w > 0 ? w / 85.6 : null;
});

const ppi = computed<number | null>(() => {
  switch (local.kind) {
    case 'reference':
      return 96 * props.devicePixelRatio;
    case 'preset':
      return ppiPresets.find((p) => p.value === local.preset)?.ppi ?? null;
    case 'custom':
      return customEnteredPpi.value ?? customCalculatedPpi.value;
    case 'calibration':
      return calibrationPixelsPerMillimeter.value === null
        ? null
        : calibrationPixelsPerMillimeter.value * props.devicePixelRatio * 25.4;
  }
});

watch(ppi, (v) => emit('update:ppi', v), { immediate: true });
</script>

<template>
  <RadioGroup v-model="local.kind" :items="sourceItems" label="显示比例来源" />

  <div v-if="local.kind === 'preset'" class="flex flex-col gap-2">
    <label for="ruler-preset" class="text-sm font-medium">设备预设</label>
    <Select id="ruler-preset" v-model="local.preset" :items="presetItems" label="设备预设" />
  </div>

  <div v-else-if="local.kind === 'custom'" class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label for="ruler-ppi" class="text-sm font-medium">直接输入 PPI</label>
      <Input id="ruler-ppi" v-model="local.ppi" inputmode="decimal" placeholder="例如：109" />
    </div>
    <p class="text-sm text-muted-foreground">或者用分辨率和屏幕对角线自动计算 PPI。</p>
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="flex flex-col gap-2">
        <label for="ruler-width" class="text-sm font-medium">宽度（px）</label>
        <Input id="ruler-width" v-model="local.width" inputmode="numeric" placeholder="2560" />
      </div>
      <div class="flex flex-col gap-2">
        <label for="ruler-height" class="text-sm font-medium">高度（px）</label>
        <Input id="ruler-height" v-model="local.height" inputmode="numeric" placeholder="1440" />
      </div>
      <div class="flex flex-col gap-2">
        <label for="ruler-diagonal" class="text-sm font-medium">对角线（英寸）</label>
        <Input id="ruler-diagonal" v-model="local.diagonal" inputmode="decimal" placeholder="27" />
      </div>
    </div>
  </div>

  <div v-else-if="local.kind === 'calibration'" class="flex flex-col gap-4">
    <p class="text-sm text-muted-foreground">
      将实体银行卡横放在下方参照条上，调整宽度直到两者对齐。银行卡标准宽度为 85.60 mm。
    </p>
    <div class="overflow-x-auto rounded-lg border bg-muted/40 p-4">
      <div
        class="calibration-card"
        :style="{ width: `${Number(local.pxWidth) || 0}px` }"
        aria-label="银行卡宽度参照条"
      >
        85.60 mm
      </div>
    </div>
    <div class="flex max-w-xs flex-col gap-2">
      <label for="ruler-calibration-width" class="text-sm font-medium"
        >参照条宽度（CSS px）</label
      >
      <Input
        id="ruler-calibration-width"
        v-model="local.pxWidth"
        inputmode="decimal"
        placeholder="320"
      />
    </div>
  </div>
</template>
