<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import CalendarDatePicker from '@/components/CalendarDatePicker.vue';
import TimePicker from '@/components/TimePicker.vue';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { calculateBazi, type BaziInput, type BaziResult, type FiveElement } from '@/lib/bazi';

const form = reactive({
  calendar: 'solar' as BaziInput['calendar'],
  year: '',
  month: '',
  day: '',
  hour: '',
  minute: '',
  leapMonth: false,
  gender: 'male',
  daySect: '2',
  yunSect: '1',
});
const result = ref<BaziResult | null>(null);
const error = ref('');
const selectedYear = ref<number | null>(null);
const datePickerKey = ref(0);
const elements: FiveElement[] = ['木', '火', '土', '金', '水'];
const genderItems = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];
const daySectItems = [
  { value: '2', label: '按当日' },
  { value: '1', label: '按次日' },
];
const yunSectItems = [
  { value: '1', label: '三天折一年' },
  { value: '2', label: '4320 分钟折一年' },
];

const allYears = computed(() => result.value?.yun.daYun.flatMap((item) => item.years) ?? []);
const selectedYearData = computed(
  () => allYears.value.find((item) => item.year === selectedYear.value) ?? null
);
const canClear = computed(() =>
  Boolean(
    form.year ||
    form.month ||
    form.day ||
    form.hour ||
    form.minute ||
    result.value ||
    error.value ||
    form.gender !== 'male' ||
    form.daySect !== '2' ||
    form.yunSect !== '1'
  )
);

function clearPage() {
  Object.assign(form, {
    calendar: 'solar',
    year: '',
    month: '',
    day: '',
    hour: '',
    minute: '',
    leapMonth: false,
    gender: 'male',
    daySect: '2',
    yunSect: '1',
  });
  result.value = null;
  error.value = '';
  selectedYear.value = null;
  datePickerKey.value++;
}

function updateResult() {
  error.value = '';
  if (!form.year || !form.month || !form.day || !form.hour || !form.minute) {
    return;
  }
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
    };
    result.value = calculateBazi(input);
    selectedYear.value = result.value.yun.daYun[0]?.years[0]?.year ?? null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '排盘失败，请检查输入。';
  }
}

watch(form, updateResult, { immediate: true });
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader>
        <CardTitle>出生信息</CardTitle>
        <CardAction
          ><Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="!canClear"
            @click="clearPage"
            >清空</Button
          ></CardAction
        >
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <CalendarDatePicker
            :key="datePickerKey"
            v-model:calendar="form.calendar"
            v-model:year="form.year"
            v-model:month="form.month"
            v-model:day="form.day"
            v-model:leap-month="form.leapMonth"
          />

          <TimePicker v-model:hour="form.hour" v-model:minute="form.minute" />

          <div class="grid gap-4 sm:grid-cols-3">
            <fieldset>
              <legend class="text-sm font-medium">性别</legend>
              <RadioGroup v-model="form.gender" :items="genderItems" label="性别" class="mt-2" />
            </fieldset>
            <label class="block text-sm font-medium">
              <span class="block">晚子时日柱</span>
              <Select
                v-model="form.daySect"
                :items="daySectItems"
                label="晚子时日柱"
                class="mt-2"
              />
            </label>
            <label class="block text-sm font-medium">
              <span class="block">起运算法</span>
              <Select v-model="form.yunSect" :items="yunSectItems" label="起运算法" class="mt-2" />
            </label>
          </div>

          <p class="text-sm text-muted-foreground">
            出生时间按北京时间（UTC+8）录入；数据只在浏览器本地计算。
          </p>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        </div>
      </CardContent>
    </Card>

    <template v-if="result">
      <Card aria-live="polite">
        <CardHeader><CardTitle>排盘依据</CardTitle></CardHeader>
        <CardContent>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg bg-muted/50 p-3">
              <dt class="text-sm text-muted-foreground">公历</dt>
              <dd class="mt-1 font-medium tabular-nums">{{ result.solar }}</dd>
            </div>
            <div class="rounded-lg bg-muted/50 p-3">
              <dt class="text-sm text-muted-foreground">农历</dt>
              <dd class="mt-1 font-medium">{{ result.lunar }}</dd>
            </div>
            <div class="rounded-lg bg-muted/50 p-3">
              <dt class="text-sm text-muted-foreground">上一节令</dt>
              <dd class="mt-1 font-medium">
                {{ result.previousJie.name }} · {{ result.previousJie.time }}
              </dd>
            </div>
            <div class="rounded-lg bg-muted/50 p-3">
              <dt class="text-sm text-muted-foreground">下一节令</dt>
              <dd class="mt-1 font-medium">
                {{ result.nextJie.name }} · {{ result.nextJie.time }}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>四柱</CardTitle></CardHeader>
        <CardContent class="overflow-x-auto">
          <table class="w-full min-w-2xl border-collapse text-center text-sm">
            <caption class="sr-only">
              四柱的干支、十神、藏干、纳音、地势和旬空
            </caption>
            <thead>
              <tr class="border-b">
                <th class="p-3 text-left">项目</th>
                <th v-for="pillar in result.pillars" :key="pillar.label" class="p-3">
                  {{ pillar.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b">
                <th class="p-3 text-left font-medium">干支</th>
                <td
                  v-for="pillar in result.pillars"
                  :key="pillar.label"
                  class="p-3 text-xl font-semibold"
                >
                  {{ pillar.gan }}{{ pillar.zhi }}
                </td>
              </tr>
              <tr class="border-b">
                <th class="p-3 text-left font-medium">阴阳五行</th>
                <td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">
                  {{ pillar.ganYinYang }}{{ pillar.ganElement }} · {{ pillar.zhiYinYang
                  }}{{ pillar.zhiElement }}
                </td>
              </tr>
              <tr class="border-b">
                <th class="p-3 text-left font-medium">天干十神</th>
                <td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">
                  {{ pillar.ganShiShen }}
                </td>
              </tr>
              <tr class="border-b">
                <th class="p-3 text-left font-medium">藏干／十神</th>
                <td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">
                  <span v-for="item in pillar.hiddenGan" :key="item.gan" class="block"
                    >{{ item.gan }}（{{ item.shiShen }}）</span
                  >
                </td>
              </tr>
              <tr class="border-b">
                <th class="p-3 text-left font-medium">纳音</th>
                <td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">
                  {{ pillar.naYin }}
                </td>
              </tr>
              <tr class="border-b">
                <th class="p-3 text-left font-medium">十二长生</th>
                <td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">
                  {{ pillar.diShi }}
                </td>
              </tr>
              <tr>
                <th class="p-3 text-left font-medium">旬／旬空</th>
                <td v-for="pillar in result.pillars" :key="pillar.label" class="p-3">
                  {{ pillar.xun
                  }}<span class="block text-muted-foreground">空 {{ pillar.xunKong }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>五行原始计数</CardTitle></CardHeader>
          <CardContent>
            <table class="w-full text-center text-sm">
              <thead>
                <tr class="border-b">
                  <th class="p-2 text-left">来源</th>
                  <th v-for="element in elements" :key="element" class="p-2">{{ element }}</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b">
                  <th class="p-2 text-left font-medium">天干</th>
                  <td v-for="element in elements" :key="element" class="p-2 tabular-nums">
                    {{ result.fiveElements.gan[element] }}
                  </td>
                </tr>
                <tr class="border-b">
                  <th class="p-2 text-left font-medium">地支本五行</th>
                  <td v-for="element in elements" :key="element" class="p-2 tabular-nums">
                    {{ result.fiveElements.zhi[element] }}
                  </td>
                </tr>
                <tr>
                  <th class="p-2 text-left font-medium">藏干</th>
                  <td v-for="element in elements" :key="element" class="p-2 tabular-nums">
                    {{ result.fiveElements.hidden[element] }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="mt-3 text-sm text-muted-foreground">仅统计原始数量，不计算旺衰或权重。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>固定衍生信息</CardTitle></CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 gap-3">
              <div
                v-for="item in result.derived"
                :key="item.label"
                class="rounded-lg bg-muted/50 p-3"
              >
                <dt class="text-sm text-muted-foreground">{{ item.label }}</dt>
                <dd class="mt-1 font-semibold">{{ item.ganZhi }} · {{ item.naYin }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>干支关系</CardTitle></CardHeader>
        <CardContent>
          <p v-if="!result.relations.length" class="text-sm text-muted-foreground">
            四柱之间没有命中当前展示的固定关系。
          </p>
          <ul v-else class="grid gap-2 sm:grid-cols-2">
            <li
              v-for="relation in result.relations"
              :key="relation"
              class="rounded-lg bg-muted/50 px-3 py-2 text-sm"
            >
              {{ relation }}
            </li>
          </ul>
          <p class="mt-3 text-sm text-muted-foreground">
            只列出固定表关系，不判断合化、旺衰或吉凶。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>起运与大运</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <p class="text-sm">
            {{ result.yun.direction }}；出生后 {{ result.yun.startOffset }}起运；起运时间
            {{ result.yun.startTime }}。
          </p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <details
              v-for="item in result.yun.daYun"
              :key="item.ganZhi"
              class="rounded-lg border p-3"
            >
              <summary class="cursor-pointer font-semibold">
                {{ item.ganZhi }} · {{ item.startYear }}—{{ item.endYear }}
              </summary>
              <p class="mt-2 text-xs text-muted-foreground">
                {{ item.startAge }}—{{ item.endAge }} 岁 · {{ item.xun }} · 空 {{ item.xunKong }}
              </p>
              <ul class="mt-3 space-y-1 text-sm">
                <li v-for="year in item.years" :key="year.year" class="flex justify-between gap-2">
                  <span>{{ year.year }}（{{ year.age }} 岁）</span
                  ><span>{{ year.ganZhi }} · 小运 {{ year.xiaoYun }}</span>
                </li>
              </ul>
            </details>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>流月</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <label class="block max-w-xs space-y-2 text-sm font-medium"
            >选择流年
            <Select
              v-model="selectedYear"
              :items="
                allYears.map((year) => ({
                  value: year.year,
                  label: `${year.year} · ${year.ganZhi}（${year.age} 岁）`,
                }))
              "
              label="选择流年"
            />
          </label>
          <div v-if="selectedYearData" class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <div
              v-for="month in selectedYearData.months"
              :key="month.month"
              class="rounded-lg bg-muted/50 p-3 text-center text-sm"
            >
              <p class="text-muted-foreground">{{ month.month }}月</p>
              <p class="mt-1 font-semibold">{{ month.ganZhi }}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ month.xun }} · 空 {{ month.xunKong }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="border-dashed">
        <CardHeader><CardTitle>命理解读</CardTitle></CardHeader>
        <CardContent
          ><p class="text-sm text-muted-foreground">
            TODO：待明确旺衰、格局、合化和喜忌用神的流派与可核验规则后实现。
          </p></CardContent
        >
      </Card>
    </template>
  </ToolPage>
</template>
