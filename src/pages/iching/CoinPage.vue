<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useClipboardActions } from '@/composables/useClipboardActions'
import { castCoins, countPositiveCoins, interpretYao, type Hexagram, yaoNames } from '@/lib/iching'
import { hexagramTexts } from '@/lib/iching-text'

const coinTosses = ref(Array.from({ length: 6 }, () => [false, false, false]))
const hasResult = ref(false)
const result = computed<ReturnType<typeof castCoins> | null>(() => {
  if (!hasResult.value) return null
  const tosses = coinTosses.value.map(coins => [...coins])
  return { tosses, positiveCounts: tosses.map(countPositiveCoins) }
})
const reading = computed(() => result.value ? interpretYao(result.value.positiveCounts) : null)
const originalText = computed(() => reading.value ? hexagramTexts[reading.value.original.number - 1] : null)
const changedText = computed(() => reading.value ? hexagramTexts[reading.value.changed.number - 1] : null)
const lineLabels = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
const hexagrams = computed(() => reading.value ? [
  { label: '本卦', value: reading.value.original, showChanges: true },
  { label: '变卦', value: reading.value.changed, showChanges: false },
  { label: '互卦', value: reading.value.mutual, showChanges: false },
] : [])
const { copyPending, clipboardError, copyText } = useClipboardActions()

const resultText = computed(() => {
  if (!result.value || !reading.value || !originalText.value || !changedText.value) return ''
  const describe = (hexagram: Hexagram) =>
    `${hexagram.name}（${hexagram.upperTrigram.image}${hexagram.upperTrigram.name}上·${hexagram.lowerTrigram.image}${hexagram.lowerTrigram.name}下）`
  const lines = result.value.positiveCounts.map((count, index) =>
    `${lineLabels[index]}：${result.value!.tosses[index].map(positive => positive ? '正' : '反').join('、')}（${yaoNames[count]}）`,
  )
  const movingLines = reading.value.changingLines.flatMap(line => [
    `动爻爻辞：${originalText.value!.lines[line - 1]}`,
    `小象传：${originalText.value!.xiaoxiang[line - 1]}`,
  ])
  return [
    `本卦：${describe(reading.value.original)}`,
    `变卦：${describe(reading.value.changed)}`,
    `互卦：${describe(reading.value.mutual)}`,
    `动爻：${reading.value.changingLines.length ? reading.value.changingLines.map(line => lineLabels[line - 1]).join('、') : '无'}`,
    '',
    ...lines,
    '',
    `本卦卦辞：${originalText.value.guaci}`,
    ...movingLines,
    `变卦卦辞：${changedText.value.guaci}`,
  ].join('\n')
})

function cast(event: MouseEvent) {
  coinTosses.value = castCoins(event.timeStamp).tosses
  hasResult.value = true
}

function clearResult() {
  coinTosses.value = Array.from({ length: 6 }, () => [false, false, false])
  hasResult.value = false
}

function toggleCoin(line: number, coin: number) {
  coinTosses.value[line][coin] = !coinTosses.value[line][coin]
  hasResult.value = true
}

function lineResult(coins: boolean[]) {
  return yaoNames[countPositiveCoins(coins)]
}
</script>

<template>
  <ToolPage>
    <Card class="bg-muted/30 py-0 shadow-none">
      <CardContent class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="text-sm text-muted-foreground">
          <p>三枚铜钱连掷六次，自下而上成卦。</p>
          <p class="mt-1">三正、三反为动爻；两正或两反为静爻。</p>
        </div>
        <Button size="sm" class="w-full sm:w-auto" @click="cast($event)">{{ result ? '重新起卦' : '开始起卦' }}</Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="grid-cols-[minmax(0,1fr)_auto] grid-rows-1 items-center">
        <div>
          <CardTitle>六爻结果</CardTitle>
          <p class="mt-1 text-sm text-muted-foreground">{{ hasResult ? '已录入，点击铜钱可切换正反。' : '未录入，点击任意铜钱后开始显示结果。' }}</p>
        </div>
        <div v-if="hasResult" class="flex gap-2">
            <Button size="sm" variant="outline" :disabled="copyPending" @click="copyText(resultText, '已复制完整起卦结果。')">复制结果</Button>
            <Button size="sm" variant="ghost" @click="clearResult">清空</Button>
        </div>
      </CardHeader>
      <CardContent>
        <ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="(coins, line) in coinTosses" :key="line" class="rounded-lg bg-muted/50 p-3">
            <div class="mb-3 flex items-center justify-between gap-3">
              <span class="text-sm font-medium">{{ lineLabels[line] }}</span>
              <span class="text-sm font-semibold">{{ lineResult(coins) }}</span>
            </div>
            <div class="flex gap-1">
              <Button
                v-for="(positive, coin) in coins"
                :key="coin"
                type="button"
                size="sm"
                class="flex-1"
                :variant="positive ? 'default' : 'secondary'"
                :aria-label="`${lineLabels[line]}第 ${coin + 1} 枚铜钱：${positive ? '正' : '反'}`"
                :aria-pressed="positive"
                @click="toggleCoin(line, coin)"
              >
                {{ positive ? '正' : '反' }}
              </Button>
            </div>
          </li>
        </ol>
        <p v-if="result && reading" class="mt-4 text-sm" role="status" aria-live="polite">
          {{ reading.changingLines.length ? `动爻：${reading.changingLines.map(line => lineLabels[line - 1]).join('、')}` : '无动爻，变卦与本卦相同。' }}
        </p>
        <p v-if="clipboardError" class="mt-3 text-sm text-destructive" role="status">{{ clipboardError }}</p>
      </CardContent>
    </Card>

    <template v-if="result && reading">
      <div class="grid gap-4 md:grid-cols-3" aria-live="polite">
        <Card v-for="hexagram in hexagrams" :key="hexagram.label">
          <CardHeader>
            <CardTitle>{{ hexagram.label }}·第 {{ hexagram.value.number }} 卦 {{ hexagram.value.name }}</CardTitle>
            <p class="text-sm text-muted-foreground">
              {{ hexagram.value.upperTrigram.image }}{{ hexagram.value.upperTrigram.name }}上·{{ hexagram.value.lowerTrigram.image }}{{ hexagram.value.lowerTrigram.name }}下
            </p>
          </CardHeader>
          <CardContent class="flex justify-center">
            <div class="flex w-32 flex-col-reverse" :aria-label="`${hexagram.value.name}卦象`">
              <div v-for="(yang, index) in hexagram.value.lines" :key="index" class="relative flex h-3.5 items-center justify-center">
                <div class="flex w-24 gap-2" aria-hidden="true">
                  <span v-if="!yang" class="h-1.5 flex-1 rounded-full bg-foreground"></span>
                  <span class="h-1.5 flex-1 rounded-full bg-foreground"></span>
                </div>
                <span v-if="hexagram.showChanges && (result.positiveCounts[index] === 0 || result.positiveCounts[index] === 3)" class="absolute right-0 text-center text-sm font-bold leading-none text-primary">{{ result.positiveCounts[index] === 0 ? '×' : '○' }}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card v-if="originalText && changedText">
        <CardHeader><CardTitle>经文原文</CardTitle></CardHeader>
        <CardContent class="space-y-6">
          <section>
            <h3 class="font-semibold">本卦·{{ reading.original.name }}</h3>
            <div class="mt-3 rounded-lg bg-muted/50 p-4">
              <p class="text-xs font-medium text-muted-foreground">卦辞</p>
              <p class="mt-1 leading-7">{{ originalText.guaci }}</p>
            </div>
            <details class="mt-3 rounded-lg border px-4 py-3">
              <summary class="cursor-pointer font-medium">彖传与大象传</summary>
              <div class="mt-3 space-y-3 text-sm leading-7">
                <p><span class="font-medium">彖曰：</span>{{ originalText.tuan }}</p>
                <p><span class="font-medium">象曰：</span>{{ originalText.daxiang }}</p>
              </div>
            </details>
          </section>

          <section v-if="reading.changingLines.length">
            <h3 class="font-semibold">动爻爻辞</h3>
            <ul class="mt-3 space-y-2">
              <li v-for="line in reading.changingLines" :key="line" class="rounded-lg bg-muted/50 px-4 py-3 leading-7">
                <p>{{ originalText.lines[line - 1] }}</p>
                <p class="mt-1 text-sm text-muted-foreground">象曰：{{ originalText.xiaoxiang[line - 1] }}</p>
              </li>
              <li v-if="reading.changingLines.length === 6 && originalText.lines[6]" class="rounded-lg bg-muted/50 px-4 py-3 leading-7">
                <p>{{ originalText.lines[6] }}</p>
                <p v-if="originalText.xiaoxiang[6]" class="mt-1 text-sm text-muted-foreground">象曰：{{ originalText.xiaoxiang[6] }}</p>
              </li>
            </ul>
          </section>

          <section v-if="reading.changed.number !== reading.original.number">
            <h3 class="font-semibold">变卦·{{ reading.changed.name }}</h3>
            <div class="mt-3 rounded-lg bg-muted/50 p-4">
              <p class="text-xs font-medium text-muted-foreground">卦辞</p>
              <p class="mt-1 leading-7">{{ changedText.guaci }}</p>
            </div>
          </section>

        </CardContent>
      </Card>

    </template>
  </ToolPage>
</template>
