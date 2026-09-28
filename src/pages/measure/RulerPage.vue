<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { Expand } from '@lucide/vue';
import PpiSourceEditor, {
  type PpiSourceFields,
} from '@/components/ruler/PpiSourceEditor.vue';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  cssPixelsPerMillimeter,
  snapToLayoutPixels,
  wholeMillimetersThatFit,
} from '@/lib/ruler';

type Edge = 'top' | 'right' | 'bottom' | 'left';

let source = reactive<PpiSourceFields>({
  kind: 'reference',
  preset: 'desktop-24-fhd',
  ppi: '',
  width: '',
  height: '',
  diagonal: '',
  pxWidth: '320',
});
const ppi = ref<number | null>(96);
const devicePixelRatio = ref(1);
const isImmersive = ref(false);
const rulerEdge = ref<Edge>('top');
const rulerViewport = ref<HTMLElement>();
const visibleMillimeters = ref(0);

const rulerLengthMillimeters = 500;
const edgeItems: { value: Edge; label: string }[] = [
  { value: 'top', label: '靠上' },
  { value: 'right', label: '靠右' },
  { value: 'bottom', label: '靠下' },
  { value: 'left', label: '靠左' },
];
const pixelsPerMillimeter = computed(() =>
  ppi.value === null ? null : cssPixelsPerMillimeter(ppi.value, devicePixelRatio.value)
);
const millimeter = computed(() => snapToLayoutPixels(pixelsPerMillimeter.value ?? 0));
const rulerStyle = computed(() => ({
  '--ruler-length': `${millimeter.value * visibleMillimeters.value}px`,
  '--millimeter': `${millimeter.value}px`,
}));
const rulerMarks = computed(() =>
  Array.from({ length: visibleMillimeters.value + 1 }, (_, value) => value)
);
const isVertical = computed(() => isImmersive.value && ['left', 'right'].includes(rulerEdge.value));
const availableEdges = computed(() => edgeItems.filter((item) => item.value !== rulerEdge.value));
const ppiLabel = computed(() =>
  ppi.value === null
    ? '请填写有效的 PPI，或完整填写分辨率和对角线尺寸。'
    : `${ppi.value.toFixed(1)} PPI`
);

function updateDevicePixelRatio() {
  devicePixelRatio.value = window.devicePixelRatio || 1;
}

function updateVisibleMillimeters() {
  if (!rulerViewport.value || pixelsPerMillimeter.value === null) return;

  visibleMillimeters.value = wholeMillimetersThatFit(
    isVertical.value ? rulerViewport.value.clientHeight : rulerViewport.value.clientWidth,
    millimeter.value,
    rulerLengthMillimeters
  );
}

onMounted(() => {
  updateDevicePixelRatio();
  window.addEventListener('resize', updateDevicePixelRatio);
});

useResizeObserver(rulerViewport, updateVisibleMillimeters);
watch([pixelsPerMillimeter, isVertical], updateVisibleMillimeters, { flush: 'post' });

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateDevicePixelRatio);
});
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader>
        <CardTitle>显示比例</CardTitle>
        <CardDescription>浏览器无法读取真实屏幕 PPI；请按当前设备选择合适的来源。</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-5">
        <PpiSourceEditor v-model="source" :device-pixel-ratio="devicePixelRatio" @update:ppi="ppi = $event" />

        <p role="status" aria-live="polite" class="text-sm text-muted-foreground">
          当前换算：{{ ppiLabel }}；设备像素比 {{ devicePixelRatio }}。
        </p>
      </CardContent>
    </Card>

    <Card v-if="!isImmersive">
      <CardHeader>
        <CardTitle>尺子</CardTitle>
        <CardDescription>每个小刻度为 1 mm。</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="pixelsPerMillimeter" class="rounded-lg border bg-muted/40 p-4">
          <div ref="rulerViewport" aria-label="横向尺子">
            <div class="ruler" :style="rulerStyle">
              <div
                v-for="mark in rulerMarks"
                :key="mark"
                class="ruler-mark"
                :class="{
                  'ruler-mark--major': mark % 10 === 0,
                  'ruler-mark--medium': mark % 5 === 0,
                  'ruler-mark--start': mark === 0,
                  'ruler-mark--end': mark === visibleMillimeters,
                }"
              >
                <span v-if="mark % 10 === 0" class="ruler-label">{{ mark / 10 }}</span>
              </div>
            </div>
          </div>
        </div>
        <p v-else role="alert" class="text-sm text-destructive">请先提供有效的显示比例。</p>
        <Button variant="secondary" @click="isImmersive = true"
          ><Expand data-icon="inline-start" />进入沉浸模式</Button
        >
      </CardContent>
    </Card>

    <Card v-else :class="['ruler-focus-mode', `ruler-focus--${rulerEdge}`]">
      <CardHeader class="sr-only">
        <CardTitle>屏幕尺子</CardTitle>
        <CardDescription
          >当前换算：{{ ppiLabel }}；设备像素比 {{ devicePixelRatio }}。</CardDescription
        >
      </CardHeader>
      <CardContent class="ruler-focus-content">
        <div
          v-if="pixelsPerMillimeter"
          ref="rulerViewport"
          class="ruler-viewport"
          :aria-label="isVertical ? '纵向尺子' : '横向尺子'"
        >
          <div class="ruler" :class="{ 'ruler--vertical': isVertical }" :style="rulerStyle">
            <div
              v-for="mark in rulerMarks"
              :key="mark"
              class="ruler-mark"
              :class="{
                'ruler-mark--major': mark % 10 === 0,
                'ruler-mark--medium': mark % 5 === 0,
                'ruler-mark--start': mark === 0,
                'ruler-mark--end': mark === visibleMillimeters,
              }"
            >
              <span v-if="mark % 10 === 0" class="ruler-label">{{ mark / 10 }}</span>
            </div>
          </div>
        </div>
        <p v-else role="alert" class="text-sm text-destructive">请先提供有效的显示比例。</p>
        <div class="ruler-edge-actions" aria-label="尺子贴边位置">
          <Button
            v-for="edge in availableEdges"
            :key="edge.value"
            variant="outline"
            :class="['ruler-edge-button', `ruler-edge-button--${edge.value}`]"
            @click="rulerEdge = edge.value"
            >{{ edge.label }}</Button
          >
          <Button variant="outline" class="ruler-exit-button" @click="isImmersive = false"
            >退出沉浸模式</Button
          >
        </div>
      </CardContent>
    </Card>
  </ToolPage>
</template>

<style scoped>
.ruler {
  /* 尺寸常量；--millimeter（1 毫米多少 CSS 像素）和 --ruler-length 由脚本按当前 PPI 写入 */
  --tick: 0.6rem;
  --tick-medium: 1rem;
  --tick-major: 1.5rem;
  --label-gap: 1.75rem;
  position: relative;
  display: flex;
  width: var(--ruler-length);
  height: 5rem;
  border-top: 1px solid var(--foreground);
}

/* --advance 是刻度沿尺子方向占的长度；flex 保证刻度不被压缩，间距始终是 1 毫米 */
.ruler-mark {
  --advance: var(--millimeter);
  position: relative;
  flex: 0 0 var(--advance);
  height: var(--tick);
  border-left: 1px solid var(--foreground);
}

.ruler-mark--medium {
  --tick: var(--tick-medium);
}
.ruler-mark--major {
  --tick: var(--tick-major);
}
.ruler-mark--end {
  --advance: 0;
}

/* 数字挂在刻线一侧，并沿刻线方向居中；--label-gap 是数字到刻线的距离 */
.ruler-label {
  position: absolute;
  top: var(--label-gap);
  left: 0;
  font-size: 0.75rem;
  line-height: 1;
  transform: translateX(-50%);
}

/* 沉浸模式的尺子紧贴屏幕边缘，起点没有让数字居中的空间，改为贴住刻线 */
.ruler-focus-mode .ruler-mark--start .ruler-label {
  transform: none;
}

/* 纵向尺子：主轴变竖向，刻度线由宽度决定，刻度线改画在上边框 */
.ruler--vertical {
  flex-direction: column;
  width: 5rem;
  height: var(--ruler-length);
  border-top: 0;
  border-left: 1px solid var(--foreground);
}

.ruler--vertical .ruler-mark {
  width: var(--tick);
  height: auto;
  border-top: 1px solid var(--foreground);
  border-left: 0;
}

.ruler--vertical .ruler-label {
  top: 0;
  left: var(--label-gap);
  transform: translateY(-50%);
}

.calibration-card {
  display: grid;
  min-width: 1px;
  height: 3rem;
  place-items: center;
  border: 1px solid var(--foreground);
  border-radius: 0.375rem;
  font-size: 0.75rem;
}

.ruler-focus-mode {
  position: fixed;
  inset: 0;
  z-index: 50;
  min-height: 100dvh;
  overflow: auto;
  border-radius: 0;
  background: var(--background);
}

.ruler-focus-content {
  flex: 1;
  padding: 0;
}

.ruler-focus-mode .ruler-viewport {
  position: absolute;
  overflow: hidden;
}

.ruler-focus--top .ruler-viewport,
.ruler-focus--bottom .ruler-viewport {
  right: 0;
  left: 0;
}

.ruler-focus--top .ruler-viewport {
  top: 0;
}
.ruler-focus--bottom .ruler-viewport {
  bottom: 0;
}

.ruler-focus--bottom .ruler {
  align-items: flex-end;
  border-top: 0;
  border-bottom: 1px solid var(--foreground);
}

.ruler-focus--bottom .ruler-mark {
  align-self: flex-end;
}

.ruler-focus--bottom .ruler-label {
  top: auto;
  bottom: var(--label-gap);
}

.ruler-focus--left .ruler-viewport,
.ruler-focus--right .ruler-viewport {
  top: 0;
  bottom: 0;
  width: 5rem;
}

.ruler-focus--left .ruler-viewport {
  left: 0;
}
.ruler-focus--right .ruler-viewport {
  right: 0;
}

.ruler-focus--right .ruler--vertical {
  align-items: flex-end;
  border-right: 1px solid var(--foreground);
  border-left: 0;
}

.ruler-focus--right .ruler-mark {
  align-self: flex-end;
}

.ruler-focus--right .ruler-label {
  right: var(--label-gap);
  left: auto;
}

.ruler-edge-button,
.ruler-exit-button {
  position: absolute;
}

.ruler-edge-button--top {
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
}

.ruler-edge-button--right {
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
}
.ruler-edge-button--bottom {
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
}
.ruler-edge-button--left {
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
}

.ruler-exit-button {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
