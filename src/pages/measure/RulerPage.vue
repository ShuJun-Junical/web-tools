<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Expand } from '@lucide/vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioGroup } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { calculatePpi, cssPixelsPerMillimeter, wholeMillimetersThatFit } from '@/lib/ruler'

type Source = 'reference' | 'preset' | 'custom' | 'calibration'
type Edge = 'top' | 'right' | 'bottom' | 'left'

const source = ref<Source>('reference')
const preset = ref('desktop-24-fhd')
const customPpi = ref('')
const displayWidth = ref('')
const displayHeight = ref('')
const diagonal = ref('')
const calibrationWidth = ref('320')
const devicePixelRatio = ref(1)
const isImmersive = ref(false)
const rulerEdge = ref<Edge>('top')
const normalRulerViewport = ref<HTMLElement>()
const normalVisibleMillimeters = ref(0)

const sourceItems = [
  { value: 'reference', label: 'CSS 参考值' },
  { value: 'preset', label: '设备预设' },
  { value: 'custom', label: '手动输入' },
  { value: 'calibration', label: '银行卡校准' },
]

const presetItems = [
  { value: 'desktop-24-fhd', label: '24 英寸显示器 · 1920×1080 · 91.8 PPI', ppi: 91.79 },
  { value: 'desktop-27-qhd', label: '27 英寸显示器 · 2560×1440 · 108.8 PPI', ppi: 108.79 },
  { value: 'desktop-27-4k', label: '27 英寸显示器 · 3840×2160 · 163.2 PPI', ppi: 163.18 },
  { value: 'macbook-air-13', label: 'MacBook Air 13.6 英寸 · 224 PPI', ppi: 224 },
  { value: 'ipad', label: 'iPad（Retina）· 264 PPI', ppi: 264 },
  { value: 'iphone', label: 'iPhone（Super Retina）· 460 PPI', ppi: 460 },
  { value: 'galaxy-s24-ultra', label: 'Samsung Galaxy S24 Ultra · 505 PPI', ppi: 505 },
]

const rulerLengthMillimeters = 500
const rulerMarks = Array.from({ length: rulerLengthMillimeters + 1 }, (_, value) => value)
const edgeItems: { value: Edge, label: string }[] = [
  { value: 'top', label: '靠上' },
  { value: 'right', label: '靠右' },
  { value: 'bottom', label: '靠下' },
  { value: 'left', label: '靠左' },
]
const selectedPreset = computed(() => presetItems.find(item => item.value === preset.value)!)
const customCalculatedPpi = computed(() => calculatePpi(Number(displayWidth.value), Number(displayHeight.value), Number(diagonal.value)))
const customEnteredPpi = computed(() => {
  const value = Number(customPpi.value)
  return Number.isFinite(value) && value > 0 ? value : null
})
const calibrationPixelsPerMillimeter = computed(() => {
  const width = Number(calibrationWidth.value)
  return Number.isFinite(width) && width > 0 ? width / 85.6 : null
})
const ppi = computed(() => {
  if (source.value === 'reference') return 96 * devicePixelRatio.value
  if (source.value === 'preset') return selectedPreset.value.ppi
  if (source.value === 'calibration') return calibrationPixelsPerMillimeter.value === null
    ? null
    : calibrationPixelsPerMillimeter.value * devicePixelRatio.value * 25.4
  return customEnteredPpi.value ?? customCalculatedPpi.value
})
const pixelsPerMillimeter = computed(() => ppi.value === null ? null : cssPixelsPerMillimeter(ppi.value, devicePixelRatio.value))
const rulerStyle = computed(() => ({
  width: `${(pixelsPerMillimeter.value ?? 0) * rulerLengthMillimeters}px`,
  '--mark-width': `${pixelsPerMillimeter.value ?? 0}px`,
}))
const verticalRulerStyle = computed(() => ({
  height: `${(pixelsPerMillimeter.value ?? 0) * rulerLengthMillimeters}px`,
  '--mark-width': `${pixelsPerMillimeter.value ?? 0}px`,
}))
const normalRulerMarks = computed(() => Array.from({ length: normalVisibleMillimeters.value + 1 }, (_, value) => value))
const normalRulerStyle = computed(() => ({
  width: `${(pixelsPerMillimeter.value ?? 0) * normalVisibleMillimeters.value}px`,
  '--mark-width': `${pixelsPerMillimeter.value ?? 0}px`,
}))
const isVertical = computed(() => isImmersive.value && ['left', 'right'].includes(rulerEdge.value))
const availableEdges = computed(() => edgeItems.filter(item => item.value !== rulerEdge.value))
const ppiLabel = computed(() => ppi.value === null ? '请填写有效的 PPI，或完整填写分辨率和对角线尺寸。' : `${ppi.value.toFixed(1)} PPI`)

function updateDevicePixelRatio() {
  devicePixelRatio.value = window.devicePixelRatio || 1
}

function updateNormalVisibleMillimeters() {
  if (!normalRulerViewport.value || pixelsPerMillimeter.value === null) return

  normalVisibleMillimeters.value = wholeMillimetersThatFit(
    normalRulerViewport.value.clientWidth,
    pixelsPerMillimeter.value,
    rulerLengthMillimeters,
  )
}

let normalRulerResizeObserver: ResizeObserver | undefined

onMounted(() => {
  updateDevicePixelRatio()
  window.addEventListener('resize', updateDevicePixelRatio)
  updateNormalVisibleMillimeters()
  if ('ResizeObserver' in window) {
    normalRulerResizeObserver = new ResizeObserver(updateNormalVisibleMillimeters)
    if (normalRulerViewport.value) normalRulerResizeObserver.observe(normalRulerViewport.value)
  }
})

watch(pixelsPerMillimeter, updateNormalVisibleMillimeters, { flush: 'post' })

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateDevicePixelRatio)
  normalRulerResizeObserver?.disconnect()
})
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader>
        <CardTitle>显示比例</CardTitle>
        <CardDescription>浏览器无法读取真实屏幕 PPI；请按当前设备选择合适的来源。</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-5">
        <RadioGroup v-model="source" label="显示比例来源" :items="sourceItems" />

        <div v-if="source === 'preset'" class="flex flex-col gap-2">
          <label for="ruler-preset" class="text-sm font-medium">设备预设</label>
          <Select id="ruler-preset" v-model="preset" label="设备预设" :items="presetItems" />
        </div>

        <div v-if="source === 'custom'" class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label for="ruler-ppi" class="text-sm font-medium">直接输入 PPI</label>
            <Input id="ruler-ppi" v-model="customPpi" inputmode="decimal" placeholder="例如：109" />
          </div>
          <p class="text-sm text-muted-foreground">或者用分辨率和屏幕对角线自动计算 PPI。</p>
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="flex flex-col gap-2">
              <label for="ruler-width" class="text-sm font-medium">宽度（px）</label>
              <Input id="ruler-width" v-model="displayWidth" inputmode="numeric" placeholder="2560" />
            </div>
            <div class="flex flex-col gap-2">
              <label for="ruler-height" class="text-sm font-medium">高度（px）</label>
              <Input id="ruler-height" v-model="displayHeight" inputmode="numeric" placeholder="1440" />
            </div>
            <div class="flex flex-col gap-2">
              <label for="ruler-diagonal" class="text-sm font-medium">对角线（英寸）</label>
              <Input id="ruler-diagonal" v-model="diagonal" inputmode="decimal" placeholder="27" />
            </div>
          </div>
        </div>

        <div v-if="source === 'calibration'" class="flex flex-col gap-4">
          <p class="text-sm text-muted-foreground">将实体银行卡横放在下方参照条上，调整宽度直到两者对齐。银行卡标准宽度为 85.60 mm。</p>
          <div class="overflow-x-auto rounded-lg border bg-muted/40 p-4">
            <div class="calibration-card" :style="{ width: `${Number(calibrationWidth) || 0}px` }" aria-label="银行卡宽度参照条">85.60 mm</div>
          </div>
          <div class="flex max-w-xs flex-col gap-2">
            <label for="ruler-calibration-width" class="text-sm font-medium">参照条宽度（CSS px）</label>
            <Input id="ruler-calibration-width" v-model="calibrationWidth" inputmode="decimal" placeholder="320" />
          </div>
        </div>

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
          <div ref="normalRulerViewport" class="overflow-hidden" aria-label="横向尺子">
            <div class="ruler" :style="normalRulerStyle">
              <div v-for="mark in normalRulerMarks" :key="mark" class="ruler-mark" :class="{ 'ruler-mark--major': mark % 10 === 0, 'ruler-mark--medium': mark % 5 === 0, 'ruler-mark--start': mark === 0, 'ruler-mark--end': mark === normalVisibleMillimeters }">
              <span v-if="mark % 10 === 0" class="ruler-label">{{ mark / 10 }}</span>
              </div>
            </div>
          </div>
        </div>
        <p v-else role="alert" class="text-sm text-destructive">请先提供有效的显示比例。</p>
        <Button variant="secondary" @click="isImmersive = true"><Expand data-icon="inline-start" />进入沉浸模式</Button>
      </CardContent>
    </Card>

    <Card v-else :class="['ruler-focus-mode', `ruler-focus--${rulerEdge}`]">
      <CardHeader class="sr-only">
        <CardTitle>屏幕尺子</CardTitle>
        <CardDescription>当前换算：{{ ppiLabel }}；设备像素比 {{ devicePixelRatio }}。</CardDescription>
      </CardHeader>
      <CardContent class="ruler-focus-content">
        <div v-if="pixelsPerMillimeter" class="ruler-scroll overflow-x-auto rounded-lg border bg-muted/40 p-4" :class="{ 'ruler-scroll--vertical': isVertical }" :aria-label="isVertical ? '纵向尺子' : '横向尺子'">
          <div class="ruler" :class="{ 'ruler--vertical': isVertical }" :style="isVertical ? verticalRulerStyle : rulerStyle">
            <div v-for="mark in rulerMarks" :key="mark" class="ruler-mark" :class="{ 'ruler-mark--major': mark % 10 === 0, 'ruler-mark--medium': mark % 5 === 0, 'ruler-mark--start': mark === 0, 'ruler-mark--end': mark === rulerLengthMillimeters }">
              <span v-if="mark % 10 === 0" class="ruler-label">{{ mark / 10 }}</span>
            </div>
          </div>
        </div>
        <p v-else role="alert" class="text-sm text-destructive">请先提供有效的显示比例。</p>
        <div class="ruler-edge-actions" aria-label="尺子贴边位置">
          <Button v-for="edge in availableEdges" :key="edge.value" variant="outline" :class="['ruler-edge-button', `ruler-edge-button--${edge.value}`]" @click="rulerEdge = edge.value">{{ edge.label }}</Button>
          <Button variant="outline" class="ruler-exit-button" @click="isImmersive = false">退出沉浸模式</Button>
        </div>
      </CardContent>
    </Card>
  </ToolPage>
</template>

<style scoped>
.ruler {
  position: relative;
  display: flex;
  height: 5rem;
  border-top: 1px solid var(--foreground);
}

.ruler-mark {
  position: relative;
  width: var(--mark-width);
  min-width: var(--mark-width);
  height: 0.6rem;
  border-left: 1px solid var(--foreground);
}

.ruler-mark--medium { height: 1rem; }
.ruler-mark--major { height: 1.5rem; }
.ruler-mark--end { width: 0; min-width: 0; }

.ruler-label {
  position: absolute;
  top: 1.75rem;
  left: -0.35rem;
  font-size: 0.75rem;
  line-height: 1;
}

.ruler-mark--start .ruler-label { left: 0.2rem; }

.ruler--vertical {
  flex-direction: column;
  width: 5rem;
  height: auto;
  border-top: 0;
  border-left: 1px solid var(--foreground);
}

.ruler--vertical .ruler-mark {
  width: 0.6rem;
  min-width: 0;
  height: var(--mark-width);
  min-height: var(--mark-width);
  border-top: 1px solid var(--foreground);
  border-left: 0;
}

.ruler--vertical .ruler-mark--medium { width: 1rem; }
.ruler--vertical .ruler-mark--major { width: 1.5rem; }
.ruler--vertical .ruler-mark--end { height: 0; min-height: 0; }

.ruler--vertical .ruler-label {
  top: -0.35rem;
  left: 1.75rem;
}

.ruler--vertical .ruler-mark--start .ruler-label { top: 0.2rem; }

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

.ruler-focus-mode .ruler-scroll {
  position: absolute;
  padding: 0;
  border: 0;
  border-radius: 0;
}

.ruler-focus--top .ruler-scroll,
.ruler-focus--bottom .ruler-scroll {
  right: 0;
  left: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.ruler-focus--top .ruler-scroll { top: 0; }
.ruler-focus--bottom .ruler-scroll { bottom: 0; }

.ruler-focus--bottom .ruler {
  align-items: flex-end;
  border-top: 0;
  border-bottom: 1px solid var(--foreground);
}

.ruler-focus--bottom .ruler-mark { align-self: flex-end; }

.ruler-focus--bottom .ruler-label {
  top: auto;
  bottom: 1.75rem;
}

.ruler-focus--left .ruler-scroll,
.ruler-focus--right .ruler-scroll {
  top: 0;
  bottom: 0;
  width: 5rem;
  overflow-x: hidden;
  overflow-y: auto;
}

.ruler-focus--left .ruler-scroll { left: 0; }
.ruler-focus--right .ruler-scroll { right: 0; }

.ruler-focus--right .ruler--vertical {
  align-items: flex-end;
  border-right: 1px solid var(--foreground);
  border-left: 0;
}

.ruler-focus--right .ruler-mark { align-self: flex-end; }

.ruler-focus--right .ruler-label {
  right: 1.75rem;
  left: auto;
  text-align: right;
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

.ruler-edge-button--right { top: 50%; right: 1rem; transform: translateY(-50%); }
.ruler-edge-button--bottom { bottom: 1rem; left: 50%; transform: translateX(-50%); }
.ruler-edge-button--left { top: 50%; left: 1rem; transform: translateY(-50%); }

.ruler-exit-button {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
