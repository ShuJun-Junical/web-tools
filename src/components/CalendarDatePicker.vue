<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CalendarDate } from '@internationalized/date';
import { Lunar, LunarYear, Solar } from 'lunar-typescript';
import { DatePicker } from '@/components/ui/date-picker';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { expandYear, parseDateInput } from '@/lib/date';

const calendar = defineModel<'solar' | 'lunar'>('calendar', { required: true });
const year = defineModel<string>('year', { required: true });
const month = defineModel<string>('month', { required: true });
const day = defineModel<string>('day', { required: true });
const leapMonth = defineModel<boolean>('leapMonth', { required: true });

const years = Array.from({ length: 201 }, (_, index) => 1900 + index);
const lunarMonthNames = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '腊月',
];
const lunarDayNames = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
];
const minSolarDate = new CalendarDate(1900, 1, 1);
const maxSolarDate = new CalendarDate(2100, 12, 31);
const solarDate = ref<CalendarDate | null>(null);
const lunarYear = ref('');
const lunarMonth = ref('');
const lunarDay = ref('');
const lunarInput = ref('');
const formattedLunarInput = ref('');
const lunarError = ref('');
let syncing = false;

const lunarMonths = computed(() =>
  lunarYear.value
    ? LunarYear.fromYear(Number(lunarYear.value))
        .getMonthsInYear()
        .map(item => ({
          value: String(item.getMonth()),
          label: `${item.isLeap() ? '闰' : ''}${lunarMonthNames[Math.abs(item.getMonth()) - 1]}`,
          days: item.getDayCount(),
        }))
    : [],
);
const selectedLunarMonth = computed(() =>
  lunarMonths.value.find(item => item.value === lunarMonth.value),
);
const lunarDays = computed(() =>
  Array.from(
    { length: selectedLunarMonth.value?.days ?? 0 },
    (_, index) => index + 1,
  ),
);
const lunarYearItems = years.map(value => ({
  value: String(value),
  label: `${value}${LunarYear.fromYear(value).getGanZhi()}年`,
}));
const lunarDayItems = computed(() =>
  lunarDays.value.map(value => ({
    value: String(value),
    label: lunarDayNames[value - 1],
  })),
);

function setLunar(lunar: Lunar) {
  lunarYear.value = String(lunar.getYear());
  lunarMonth.value = String(lunar.getMonth());
  lunarDay.value = String(lunar.getDay());
  formattedLunarInput.value = `${lunar.getYear()}${LunarYear.fromYear(lunar.getYear()).getGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  lunarInput.value = formattedLunarInput.value;
  lunarError.value = '';
}

function useSolar(value: CalendarDate | null) {
  if (!value || syncing) return;
  syncing = true;
  const lunar = Solar.fromYmd(value.year, value.month, value.day).getLunar();
  setLunar(lunar);
  calendar.value = 'solar';
  year.value = String(value.year);
  month.value = String(value.month);
  day.value = String(value.day);
  leapMonth.value = false;
  syncing = false;
}

function useLunar() {
  if (syncing || !lunarYear.value || !lunarMonth.value || !lunarDay.value)
    return;
  if (
    !selectedLunarMonth.value ||
    Number(lunarDay.value) > selectedLunarMonth.value.days
  )
    return;
  const lunar = Lunar.fromYmd(
    Number(lunarYear.value),
    Number(lunarMonth.value),
    Number(lunarDay.value),
  );
  if (
    lunar.getYear() !== Number(lunarYear.value) ||
    lunar.getMonth() !== Number(lunarMonth.value) ||
    lunar.getDay() !== Number(lunarDay.value)
  )
    return;
  syncing = true;
  const solar = lunar.getSolar();
  solarDate.value = new CalendarDate(
    solar.getYear(),
    solar.getMonth(),
    solar.getDay(),
  );
  setLunar(lunar);
  calendar.value = 'lunar';
  year.value = lunarYear.value;
  month.value = String(Math.abs(Number(lunarMonth.value)));
  day.value = lunarDay.value;
  leapMonth.value = Number(lunarMonth.value) < 0;
  syncing = false;
}

function editLunarInput(value: string | number) {
  lunarInput.value = String(value);
  lunarError.value = lunarInput.value
    ? '请输入完整有效的农历日期。'
    : '请选择农历日期。';
}

function commitLunarInput() {
  if (lunarInput.value === formattedLunarInput.value) return;
  const value = parseDateInput(
    lunarInput.value.replace(/^\s*农历\s*/, ''),
    undefined,
    (year, month, day) => ({ year, month, day }),
  );
  if (!value || value.year < 1900 || value.year > 2100) {
    lunarError.value = '请输入有效农历日期，例如 20260304。';
    return;
  }
  const months = LunarYear.fromYear(value.year).getMonthsInYear();
  const target = months.find(item => item.getMonth() === value.month);
  if (!target || value.day > target.getDayCount()) {
    lunarError.value = '农历日期无效。';
    return;
  }
  lunarYear.value = String(value.year);
  lunarMonth.value = String(value.month);
  lunarDay.value = String(value.day);
  useLunar();
}

function resolveLunarYear(input: string) {
  if (!/^\d{2}(?:\d{2})?$/.test(input)) return;
  const value = input.length === 2 ? expandYear(Number(input)) : Number(input);
  return value >= 1900 && value <= 2100 ? String(value) : undefined;
}

function resolveLunarMonth(input: string) {
  const value = Number(input);
  return /^\d{1,2}$/.test(input) && value >= 1 && value <= 12 ? String(value) : undefined;
}

function resolveLunarDay(input: string) {
  const value = Number(input);
  return /^\d{1,2}$/.test(input) && lunarDays.value.includes(value) ? String(value) : undefined;
}

watch(solarDate, useSolar, { flush: 'sync' });
watch([lunarYear, lunarMonth, lunarDay], useLunar, { flush: 'sync' });
watch(lunarMonths, months => {
  if (lunarMonth.value && !months.some(item => item.value === lunarMonth.value))
    lunarMonth.value = months[0]?.value ?? '';
});
watch(lunarDays, days => {
  if (Number(lunarDay.value) > days.length)
    lunarDay.value = String(days.length);
});
</script>

<template>
  <div class="grid gap-4">
    <label class="space-y-2 text-sm font-medium"
      >公历日期
      <DatePicker
        v-model="solarDate"
        :min-value="minSolarDate"
        :max-value="maxSolarDate"
        label="公历日期"
        show-lunar
      />
    </label>
    <div>
      <label class="text-sm font-medium" for="lunar-date-input">农历日期</label>
      <div
        class="mt-2 grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_10rem_6.5rem_6.5rem]"
      >
        <Input
          id="lunar-date-input"
          :model-value="lunarInput"
          inputmode="numeric"
          :aria-invalid="Boolean(lunarError)"
          placeholder="如 20260304"
          @update:model-value="editLunarInput"
          @blur="commitLunarInput"
          @keydown.enter.prevent="commitLunarInput"
        />
        <Combobox
          v-model="lunarYear"
          :items="lunarYearItems"
          label="农历年"
          placeholder="年"
          :resolve-input="resolveLunarYear"
        />
        <Combobox
          v-model="lunarMonth"
          :items="lunarMonths"
          label="农历月"
          placeholder="月"
          :resolve-input="resolveLunarMonth"
        />
        <Combobox
          v-model="lunarDay"
          :items="lunarDayItems"
          label="农历日"
          placeholder="日"
          :resolve-input="resolveLunarDay"
        />
      </div>
      <div class="min-h-5 pt-1">
        <p v-if="lunarError" role="alert" class="text-xs text-destructive">
          {{ lunarError }}
        </p>
      </div>
    </div>
  </div>
</template>
