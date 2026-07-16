<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { castCoins, interpretYao, type PositiveCount, yaoNames } from '@/lib/iching'

const result = ref<ReturnType<typeof castCoins> | null>(null)
const reading = computed(() => result.value ? interpretYao(result.value.positiveCounts) : null)
const lineLabels = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']

function cast() {
  result.value = castCoins()
}

function isYang(count: PositiveCount, changed = false) {
  return changed ? count === 0 || count === 1 : count === 1 || count === 3
}
</script>

<template>
  <ToolPage title="周易六十四卦起卦" category="生活工具" description="使用三枚铜钱法随机起六爻，查看每次结果、本卦和变卦。">
    <Card class="bg-muted/30 py-0 shadow-none">
      <CardContent class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-muted-foreground">三枚铜钱连掷六次，自下而上成卦。</p>
        <Button size="sm" class="w-full sm:w-auto" @click="cast">{{ result ? '重新起卦' : '开始起卦' }}</Button>
      </CardContent>
    </Card>

    <template v-if="result && reading">
      <div class="grid gap-4 sm:grid-cols-2" aria-live="polite">
        <Card v-for="(hexagram, changed) in [reading.original, reading.changed]" :key="changed">
          <CardHeader>
            <CardTitle>{{ changed ? '变卦' : '本卦' }}·第 {{ hexagram.number }} 卦 {{ hexagram.name }}</CardTitle>
          </CardHeader>
          <CardContent class="flex justify-center">
            <div class="flex w-32 flex-col-reverse" :aria-label="`${hexagram.name}卦象`">
              <div v-for="(count, index) in result.positiveCounts" :key="index" class="relative flex h-3.5 items-center justify-center">
                <div class="flex w-24 gap-2" aria-hidden="true">
                  <span v-if="!isYang(count, Boolean(changed))" class="h-1.5 flex-1 rounded-full bg-foreground"></span>
                  <span class="h-1.5 flex-1 rounded-full bg-foreground"></span>
                </div>
                <span v-if="!changed && (count === 0 || count === 3)" class="absolute right-0 text-center text-sm font-bold leading-none text-primary">{{ count === 0 ? '×' : '○' }}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>六爻原始结果</CardTitle></CardHeader>
        <CardContent>
          <ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="(count, index) in result.positiveCounts" :key="index" class="rounded-lg bg-muted/60 p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="font-medium">{{ lineLabels[index] }}</span>
                <span class="font-semibold">{{ yaoNames[count] }}</span>
              </div>
              <p class="mt-2 text-sm text-muted-foreground">
                {{ result.tosses[index].map(positive => positive ? '正' : '反').join('、') }}
              </p>
            </li>
          </ol>
          <p class="mt-4 text-sm" role="status">
            {{ reading.changingLines.length ? `动爻：${reading.changingLines.map(line => lineLabels[line - 1]).join('、')}` : '无动爻，变卦与本卦相同。' }}
          </p>
        </CardContent>
      </Card>
    </template>
  </ToolPage>
</template>
