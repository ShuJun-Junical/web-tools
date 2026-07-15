<script setup lang="ts">
import { computed, ref } from 'vue'
import katex from 'katex'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { chiSquare2x2 } from '@/lib/statistics'

const cells = ref({ a: '', b: '', c: '', d: '' })
const keys = ['a', 'b', 'c', 'd'] as const
const hasInput = computed(() => keys.some(key => cells.value[key] !== ''))
const invalidKeys = computed(() => keys.filter(key => {
  const raw = cells.value[key]
  const value = Number(raw)
  return raw !== '' && (!Number.isInteger(value) || value < 0)
}))
const counts = computed(() => keys.map(key => Number(cells.value[key]) || 0) as [number, number, number, number])
const result = computed(() => invalidKeys.value.length ? null : chiSquare2x2(counts.value))
const totals = computed(() => {
  const [a, b, c, d] = counts.value
  return { ab: a + b, cd: c + d, ac: a + c, bd: b + d, n: a + b + c + d }
})
const formula = computed(() => {
  const base = 'K^2=\\frac{n(ad-bc)^2}{(a+b)(c+d)(a+c)(b+d)}'
  if (!hasInput.value || invalidKeys.value.length || result.value === null) return katex.renderToString(base)

  const [a, b, c, d] = counts.value
  const rounded = Math.round(result.value * 10000) / 10000
  return katex.renderToString(
    `${base}=\\frac{${totals.value.n}\\times(${a}\\times${d}-${b}\\times${c})^2}`
    + `{${totals.value.ab}\\times${totals.value.cd}\\times${totals.value.ac}\\times${totals.value.bd}}`
    + `${result.value === rounded ? '=' : '\\approx'}${rounded}`,
  )
})

function clear() {
  cells.value = { a: '', b: '', c: '', d: '' }
}
</script>

<template>
  <ToolPage title="列联表和独立性检验" category="统计学计算器" description="输入 2×2 列联表频数，计算 Pearson 卡方统计量。">
    <Card>
      <CardHeader><CardTitle>列联表</CardTitle></CardHeader>
      <CardContent class="space-y-5">
        <div class="grid grid-cols-3 gap-3">
          <template v-for="key in keys" :key="key">
            <div v-if="key === 'a' || key === 'c'" class="contents">
              <label :for="`cell-${key}`" class="space-y-1">
                <span class="text-sm font-medium">{{ key }}</span>
                <Input :id="`cell-${key}`" v-model="cells[key]" type="number" min="0" step="1" :aria-invalid="invalidKeys.includes(key)" />
              </label>
              <label :for="`cell-${key === 'a' ? 'b' : 'd'}`" class="space-y-1">
                <span class="text-sm font-medium">{{ key === 'a' ? 'b' : 'd' }}</span>
                <Input
                  :id="`cell-${key === 'a' ? 'b' : 'd'}`"
                  v-model="cells[key === 'a' ? 'b' : 'd']"
                  type="number"
                  min="0"
                  step="1"
                  :aria-invalid="invalidKeys.includes(key === 'a' ? 'b' : 'd')"
                />
              </label>
              <div class="space-y-1">
                <span class="text-sm font-medium">合计</span>
                <Input :model-value="key === 'a' ? totals.ab : totals.cd" disabled aria-label="行合计" />
              </div>
            </div>
          </template>
          <Input :model-value="totals.ac" disabled aria-label="第一列合计" />
          <Input :model-value="totals.bd" disabled aria-label="第二列合计" />
          <Input :model-value="totals.n" disabled aria-label="总计" />
        </div>
        <p v-if="invalidKeys.length" role="alert" class="text-sm text-destructive">
          {{ invalidKeys.join('、') }} 必须是非负整数。
        </p>
        <p v-else-if="hasInput && result === null" role="alert" class="text-sm text-destructive">
          行合计或列合计为零，无法计算卡方统计量。
        </p>
        <Button variant="outline" :disabled="!hasInput" @click="clear">清空</Button>
      </CardContent>
    </Card>

    <Card aria-live="polite">
      <CardHeader><CardTitle>计算结果</CardTitle></CardHeader>
      <CardContent>
        <div class="overflow-x-auto py-2" v-html="formula" />
      </CardContent>
    </Card>
  </ToolPage>
</template>
