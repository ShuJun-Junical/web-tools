<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { linearCorrelation, parseNumberLines } from '@/lib/statistics'

const xText = ref('')
const yText = ref('')
const x = computed(() => parseNumberLines(xText.value))
const y = computed(() => parseNumberLines(yText.value))
const hasErrors = computed(() => x.value.invalidLines.length > 0 || y.value.invalidLines.length > 0)
const sameLength = computed(() => x.value.values.length === y.value.values.length)
const result = computed(() => hasErrors.value || !sameLength.value
  ? null
  : linearCorrelation(x.value.values, y.value.values))

const relation = computed(() => {
  if (!result.value) return ''
  const absolute = Math.abs(result.value.coefficient)
  const strength = absolute >= 0.8 ? '高度' : absolute >= 0.5 ? '中度' : absolute >= 0.3 ? '低度' : '极弱'
  const direction = result.value.coefficient > 0 ? '正' : result.value.coefficient < 0 ? '负' : ''
  return `${strength}${direction}线性相关`
})

const plot = computed(() => {
  if (!result.value) return null
  const valuesX = x.value.values
  const valuesY = y.value.values
  const rawMinX = Math.min(...valuesX)
  const rawMaxX = Math.max(...valuesX)
  const rawMinY = Math.min(...valuesY)
  const rawMaxY = Math.max(...valuesY)
  const lineY1 = result.value.slope * rawMinX + result.value.intercept
  const lineY2 = result.value.slope * rawMaxX + result.value.intercept
  const paddingX = (rawMaxX - rawMinX || 1) * 0.08
  const plotMinY = Math.min(rawMinY, lineY1, lineY2)
  const plotMaxY = Math.max(rawMaxY, lineY1, lineY2)
  const paddingY = (plotMaxY - plotMinY || 1) * 0.08
  const minX = rawMinX - paddingX
  const maxX = rawMaxX + paddingX
  const minY = plotMinY - paddingY
  const maxY = plotMaxY + paddingY
  const left = 56
  const top = 20
  const width = 560
  const height = 290
  const px = (value: number) => left + ((value - minX) / (maxX - minX)) * width
  const py = (value: number) => top + height - ((value - minY) / (maxY - minY)) * height

  return {
    points: valuesX.map((value, index) => ({ x: px(value), y: py(valuesY[index]) })),
    line: { x1: px(rawMinX), y1: py(lineY1), x2: px(rawMaxX), y2: py(lineY2) },
    labels: { minX, maxX, minY, maxY },
  }
})

function format(value: number) {
  return Number(value.toPrecision(6)).toString()
}

function clear() {
  xText.value = ''
  yText.value = ''
}
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader><CardTitle>输入数据</CardTitle></CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium">x（每行一个数字）</span>
            <Textarea v-model="xText" class="min-h-52 resize-y" monospace placeholder="1&#10;2&#10;3" :aria-invalid="x.invalidLines.length > 0" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium">y（每行一个数字）</span>
            <Textarea v-model="yText" class="min-h-52 resize-y" monospace placeholder="2&#10;4&#10;5" :aria-invalid="y.invalidLines.length > 0" />
          </label>
        </div>
        <p v-if="hasErrors" role="alert" class="text-sm text-destructive">
          <template v-if="x.invalidLines.length">x 的第 {{ x.invalidLines.join('、') }} 行不是有效数字。</template>
          <template v-if="y.invalidLines.length"> y 的第 {{ y.invalidLines.join('、') }} 行不是有效数字。</template>
        </p>
        <p v-else-if="!sameLength" role="alert" class="text-sm text-destructive">x 和 y 的数据数量必须相同。</p>
        <p v-else class="text-sm text-muted-foreground">空行会被忽略，至少需要两对数据，且 x、y 都必须有变化。</p>
        <Button variant="outline" :disabled="!xText && !yText" @click="clear">清空</Button>
      </CardContent>
    </Card>

    <Card aria-live="polite">
      <CardHeader><CardTitle>计算结果</CardTitle></CardHeader>
      <CardContent class="space-y-5">
        <p v-if="!result" class="text-sm text-muted-foreground">
          {{ x.values.length >= 2 && sameLength && !hasErrors ? 'x 或 y 没有变化，无法计算相关系数。' : '输入有效的成对数据后显示结果。' }}
        </p>
        <template v-else>
          <dl class="grid gap-4 sm:grid-cols-3">
            <div class="rounded-lg bg-muted/60 p-3">
              <dt class="text-sm text-muted-foreground">Pearson r</dt>
              <dd class="mt-1 font-semibold tabular-nums">{{ format(result.coefficient) }}</dd>
            </div>
            <div class="rounded-lg bg-muted/60 p-3">
              <dt class="text-sm text-muted-foreground">关系判断</dt>
              <dd class="mt-1 font-semibold">{{ relation }}</dd>
            </div>
            <div class="rounded-lg bg-muted/60 p-3">
              <dt class="text-sm text-muted-foreground">回归方程</dt>
              <dd class="mt-1 font-semibold tabular-nums">y = {{ format(result.slope) }}x {{ result.intercept < 0 ? '−' : '+' }} {{ format(Math.abs(result.intercept)) }}</dd>
            </div>
          </dl>

          <div class="overflow-hidden" role="img" :aria-label="`${x.values.length} 个数据点的散点图和线性回归直线`">
            <svg viewBox="0 0 640 350" class="h-auto w-full text-muted-foreground">
              <line x1="56" y1="20" x2="56" y2="310" stroke="currentColor" />
              <line x1="56" y1="310" x2="616" y2="310" stroke="currentColor" />
              <text x="56" y="333" text-anchor="middle" fill="currentColor" font-size="13">{{ format(plot!.labels.minX) }}</text>
              <text x="616" y="333" text-anchor="middle" fill="currentColor" font-size="13">{{ format(plot!.labels.maxX) }}</text>
              <text x="46" y="314" text-anchor="end" fill="currentColor" font-size="13">{{ format(plot!.labels.minY) }}</text>
              <text x="46" y="24" text-anchor="end" fill="currentColor" font-size="13">{{ format(plot!.labels.maxY) }}</text>
              <line v-bind="plot!.line" class="text-primary" stroke="currentColor" stroke-width="2" />
              <circle v-for="(point, index) in plot!.points" :key="index" :cx="point.x" :cy="point.y" r="4" class="text-primary" fill="currentColor">
                <title>x={{ x.values[index] }}, y={{ y.values[index] }}</title>
              </circle>
              <text x="625" y="314" fill="currentColor" font-size="14">x</text>
              <text x="56" y="14" fill="currentColor" font-size="14">y</text>
            </svg>
          </div>
        </template>
      </CardContent>
    </Card>
  </ToolPage>
</template>
