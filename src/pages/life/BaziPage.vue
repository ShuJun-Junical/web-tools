<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { calculateBazi, type BaziInput, type BaziResult, type FiveElement } from '@/lib/bazi'

const form = reactive({
  calendar: 'solar',
  year: '1990',
  month: '1',
  day: '1',
  hour: '12',
  minute: '0',
  leapMonth: false,
  gender: 'male',
  daySect: '2',
  yunSect: '1',
})
const result = ref<BaziResult | null>(null)
const error = ref('')
const selectedYear = ref<number | null>(null)
const elements: FiveElement[] = ['木', '火', '土', '金', '水']
const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const allYears = computed(() => result.value?.yun.daYun.flatMap(item => item.years) ?? [])
const selectedYearData = computed(() => allYears.value.find(item => item.year === selectedYear.value) ?? null)

function submit() {
  error.value = ''
  try {
    const input: BaziInput = {
      calendar: form.calendar as BaziInput['calendar'],
      year: Number(form.year),
      month: Number(form.month),
      day: Number(form.day),
      hour: Number(form.hour),
      minute: Number(form.minute),
      leapMonth: form.leapMonth,
      gender: form.gender as BaziInput['gender'],
      daySect: Number(form.daySect) as 1 | 2,
      yunSect: Number(form.yunSect) as 1 | 2,
    }
    result.value = calculateBazi(input)
    selectedYear.value = result.value.yun.daYun[0]?.years[0]?.year ?? null
  } catch (cause) {
    result.value = null
    selectedYear.value = null
    error.value = cause instanceof Error ? cause.message : '排盘失败，请检查输入。'
  }
}
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader><CardTitle>出生信息</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-5" @submit.prevent="submit">
          <fieldset>
            <legend class="text-sm font-medium">历法</legend>
            <div class="mt-2 flex gap-5">
              <label class="flex items-center gap-2 text-sm"><input v-model="form.calendar" type="radio" value="solar">公历</label>
              <label class="flex items-center gap-2 text-sm"><input v-model="form.calendar" type="radio" value="lunar">农历</label>
            </div>
          </fieldset>

          <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <label class="space-y-2 text-sm font-medium">年<Input v-model="form.year" type="number" min="1900" max="2100" inputmode="numeric" required /></label>
            <label class="space-y-2 text-sm font-medium">月<Input v-model="form.month" type="number" min="1" max="12" inputmode="numeric" required /></label>
            <label class="space-y-2 text-sm font-medium">日<Input v-model="form.day" type="number" min="1" max="31" inputmode="numeric" required /></label>
            <label class="space-y-2 text-sm font-medium">时（0—23）<Input v-model="form.hour" type="number" min="0" max="23" inputmode="numeric" required /></label>
            <label class="space-y-2 text-sm font-medium">分（0—59）<Input v-model="form.minute" type="number" min="0" max="59" inputmode="numeric" required /></label>
          </div>

          <label v-if="form.calendar === 'lunar'" class="flex items-center gap-2 text-sm">
            <input v-model="form.leapMonth" type="checkbox">所填月份为闰月
          </label>

          <div class="grid gap-4 sm:grid-cols-3">
            <label class="space-y-2 text-sm font-medium">
              性别
              <select v-model="form.gender" :class="selectClass">
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </label>
            <label class="space-y-2 text-sm font-medium">
              晚子时日柱
              <select v-model="form.daySect" :class="selectClass">
                <option value="2">按当日</option>
                <option value="1">按次日</option>
              </select>
            </label>
            <label class="space-y-2 text-sm font-medium">
              起运算法
              <select v-model="form.yunSect" :class="selectClass">
                <option value="1">三天折一年</option>
                <option value="2">4320 分钟折一年</option>
              </select>
            </label>
          </div>

          <p class="text-sm text-muted-foreground">出生时间按北京时间（UTC+8）录入；数据只在浏览器本地计算。</p>
          <div class="min-h-5"><p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p></div>
          <Button type="submit">开始排盘</Button>
        </form>
      </CardContent>
    </Card>

    <template v-if="result">
      <Card aria-live="polite">
        <CardHeader><CardTitle>排盘依据</CardTitle></CardHeader>
        <CardContent>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg bg-muted/50 p-3"><dt class="text-sm text-muted-foreground">公历</dt><dd class="mt-1 font-medium tabular-nums">{{ result.solar }}</dd></div>
            <div class="rounded-lg bg-muted/50 p-3"><dt class="text-sm text-muted-foreground">农历</dt><dd class="mt-1 font-medium">{{ result.lunar }}</dd></div>
            <div class="rounded-lg bg-muted/50 p-3"><dt class="text-sm text-muted-foreground">上一节令</dt><dd class="mt-1 font-medium">{{ result.previousJie.name }} · {{ result.previousJie.time }}</dd></div>
            <div class="rounded-lg bg-muted/50 p-3"><dt class="text-sm text-muted-foreground">下一节令</dt><dd class="mt-1 font-medium">{{ result.nextJie.name }} · {{ result.nextJie.time }}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>四柱</CardTitle></CardHeader>
        <CardContent class="overflow-x-auto">
          <table class="w-full min-w-2xl border-collapse text-center text-sm">
            <caption class="sr-only">四柱的干支、十神、藏干、纳音、地势和旬空</caption>
            <thead><tr class="border-b"><th class="p-3 text-left">项目</th><th v-for="pillar in result.pillars" :key="pillar.label" class="p-3">{{ pillar.label }}</th></tr></thead>
            <tbody>
              <tr class="border-b"><th class="p-3 text-left font-medium">干支</th><td v-for="pillar in result.pillars" :key="pillar.label" class="p-3 text-xl font-semibold">{{ pillar.gan }}{{ pillar.zhi }}</td></tr>
              <tr class="border-b"><th class="p-3 text-left font-medium">阴阳五行</th><td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">{{ pillar.ganYinYang }}{{ pillar.ganElement }} · {{ pillar.zhiYinYang }}{{ pillar.zhiElement }}</td></tr>
              <tr class="border-b"><th class="p-3 text-left font-medium">天干十神</th><td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">{{ pillar.ganShiShen }}</td></tr>
              <tr class="border-b"><th class="p-3 text-left font-medium">藏干／十神</th><td v-for="pillar in result.pillars" :key="pillar.label" class="p-3"><span v-for="item in pillar.hiddenGan" :key="item.gan" class="block">{{ item.gan }}（{{ item.shiShen }}）</span></td></tr>
              <tr class="border-b"><th class="p-3 text-left font-medium">纳音</th><td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">{{ pillar.naYin }}</td></tr>
              <tr class="border-b"><th class="p-3 text-left font-medium">十二长生</th><td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">{{ pillar.diShi }}</td></tr>
              <tr><th class="p-3 text-left font-medium">旬／旬空</th><td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">{{ pillar.xun }}<span class="block text-muted-foreground">空 {{ pillar.xunKong }}</span></td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>五行原始计数</CardTitle></CardHeader>
          <CardContent>
            <table class="w-full text-center text-sm">
              <thead><tr class="border-b"><th class="p-2 text-left">来源</th><th v-for="element in elements" :key="element" class="p-2">{{ element }}</th></tr></thead>
              <tbody>
                <tr class="border-b"><th class="p-2 text-left font-medium">天干</th><td v-for="element in elements" :key="element" class="p-2 tabular-nums">{{ result.fiveElements.gan[element] }}</td></tr>
                <tr class="border-b"><th class="p-2 text-left font-medium">地支本五行</th><td v-for="element in elements" :key="element" class="p-2 tabular-nums">{{ result.fiveElements.zhi[element] }}</td></tr>
                <tr><th class="p-2 text-left font-medium">藏干</th><td v-for="element in elements" :key="element" class="p-2 tabular-nums">{{ result.fiveElements.hidden[element] }}</td></tr>
              </tbody>
            </table>
            <p class="mt-3 text-sm text-muted-foreground">仅统计原始数量，不计算旺衰或权重。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>固定衍生信息</CardTitle></CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 gap-3">
              <div v-for="item in result.derived" :key="item.label" class="rounded-lg bg-muted/50 p-3">
                <dt class="text-sm text-muted-foreground">{{ item.label }}</dt><dd class="mt-1 font-semibold">{{ item.ganZhi }} · {{ item.naYin }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>干支关系</CardTitle></CardHeader>
        <CardContent>
          <p v-if="!result.relations.length" class="text-sm text-muted-foreground">四柱之间没有命中当前展示的固定关系。</p>
          <ul v-else class="grid gap-2 sm:grid-cols-2">
            <li v-for="relation in result.relations" :key="relation" class="rounded-lg bg-muted/50 px-3 py-2 text-sm">{{ relation }}</li>
          </ul>
          <p class="mt-3 text-sm text-muted-foreground">只列出固定表关系，不判断合化、旺衰或吉凶。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>起运与大运</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <p class="text-sm">{{ result.yun.direction }}；出生后 {{ result.yun.startOffset }}起运；起运时间 {{ result.yun.startTime }}。</p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <details v-for="item in result.yun.daYun" :key="item.ganZhi" class="rounded-lg border p-3">
              <summary class="cursor-pointer font-semibold">{{ item.ganZhi }} · {{ item.startYear }}—{{ item.endYear }}</summary>
              <p class="mt-2 text-xs text-muted-foreground">{{ item.startAge }}—{{ item.endAge }} 岁 · {{ item.xun }} · 空 {{ item.xunKong }}</p>
              <ul class="mt-3 space-y-1 text-sm">
                <li v-for="year in item.years" :key="year.year" class="flex justify-between gap-2"><span>{{ year.year }}（{{ year.age }} 岁）</span><span>{{ year.ganZhi }} · 小运 {{ year.xiaoYun }}</span></li>
              </ul>
            </details>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>流月</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <label class="block max-w-xs space-y-2 text-sm font-medium">选择流年
            <select v-model.number="selectedYear" :class="selectClass">
              <option v-for="year in allYears" :key="year.year" :value="year.year">{{ year.year }} · {{ year.ganZhi }}（{{ year.age }} 岁）</option>
            </select>
          </label>
          <div v-if="selectedYearData" class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <div v-for="month in selectedYearData.months" :key="month.month" class="rounded-lg bg-muted/50 p-3 text-center text-sm">
              <p class="text-muted-foreground">{{ month.month }}月</p><p class="mt-1 font-semibold">{{ month.ganZhi }}</p><p class="mt-1 text-xs text-muted-foreground">{{ month.xun }} · 空 {{ month.xunKong }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="border-dashed">
        <CardHeader><CardTitle>命理解读</CardTitle></CardHeader>
        <CardContent><p class="text-sm text-muted-foreground">TODO：待明确旺衰、格局、合化和喜忌用神的流派与可核验规则后实现。</p></CardContent>
      </Card>
    </template>
  </ToolPage>
</template>
