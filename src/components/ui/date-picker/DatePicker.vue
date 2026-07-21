<script setup lang="ts">
import type { DateValue } from 'reka-ui/date'
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
import { CalendarCell, CalendarCellTrigger, CalendarGrid, CalendarGridBody, CalendarGridHead, CalendarGridRow, CalendarHeadCell, CalendarHeader, CalendarHeading, CalendarNext, CalendarPrev, CalendarRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, watch } from 'vue'
import { Solar } from 'lunar-typescript'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateInput, parseDateInput } from '@/lib/date'

const model = defineModel<CalendarDate | null>({ required: true })
const props = defineProps<{ minValue?: CalendarDate, maxValue?: CalendarDate, label: string, showLunar?: boolean }>()
const open = ref(false)
const openedFromInput = ref(false)
const input = ref(model.value ? formatDateInput(model.value) : '')
const error = ref('')
const formatter = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

function lunarLabel(date: DateValue) {
  const lunar = Solar.fromYmd(date.year, date.month, date.day).getLunar()
  return lunar.getDay() === 1 ? `${lunar.getMonthInChinese()}月` : lunar.getDayInChinese()
}

function selectDate(value: DateValue | undefined) {
  if (!value) return
  model.value = new CalendarDate(value.year, value.month, value.day)
  open.value = false
}

function commitInput() {
  const value = parseDateInput(input.value)
  if (!value) {
    model.value = null
    error.value = '请输入有效日期，例如 20260304。'
    return
  }
  const date = new CalendarDate(value.year, value.month, value.day)
  if ((props.minValue && date.compare(props.minValue) < 0) || (props.maxValue && date.compare(props.maxValue) > 0)) {
    model.value = null
    error.value = `日期须在 ${props.minValue?.toString()} 至 ${props.maxValue?.toString()} 之间。`
    return
  }
  model.value = date
  input.value = formatDateInput(date)
  error.value = ''
}

function editInput(value: string | number) {
  input.value = String(value)
  model.value = null
  error.value = input.value ? '请输入完整有效日期。' : '请选择日期。'
}

function openFromInput() {
  openedFromInput.value = true
  open.value = true
}

function handleOpenAutoFocus(event: Event) {
  if (openedFromInput.value) event.preventDefault()
}

watch(model, (value) => {
  if (!value) return
  input.value = formatDateInput(value)
  error.value = ''
})
</script>

<template>
  <div>
    <div class="flex gap-2">
      <Input :model-value="input" type="text" inputmode="numeric" :aria-label="label" :aria-invalid="Boolean(error)" placeholder="如 20260304" @update:model-value="editInput" @focus="openFromInput" @blur="commitInput" @keydown.enter.prevent="commitInput" />
      <PopoverRoot v-model:open="open">
        <PopoverTrigger as-child>
          <Button type="button" variant="outline" size="icon" :aria-label="model ? `打开${label}日历，当前为${formatter.format(model.toDate(getLocalTimeZone()))}` : `打开${label}日历`" @click="openedFromInput = false">
            <CalendarDays />
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent :side-offset="4" align="end" class="z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md" @open-auto-focus="handleOpenAutoFocus">
        <CalendarRoot :model-value="model" :min-value="minValue" :max-value="maxValue" locale="zh-CN" :week-starts-on="1" fixed-weeks :initial-focus="!openedFromInput" @update:model-value="selectDate">
          <template #default="{ grid, weekDays }">
            <CalendarHeader class="relative flex items-center justify-center pb-3">
              <CalendarPrev as-child><Button type="button" variant="ghost" size="icon-sm" class="absolute left-0"><ChevronLeft /><span class="sr-only">上个月</span></Button></CalendarPrev>
              <CalendarHeading class="text-sm font-medium" />
              <CalendarNext as-child><Button type="button" variant="ghost" size="icon-sm" class="absolute right-0"><ChevronRight /><span class="sr-only">下个月</span></Button></CalendarNext>
            </CalendarHeader>
            <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="border-collapse">
              <CalendarGridHead>
                <CalendarGridRow class="flex">
                  <CalendarHeadCell v-for="weekDay in weekDays" :key="weekDay" :class="showLunar ? 'size-11' : 'size-9'" class="flex items-center justify-center text-xs font-normal text-muted-foreground">{{ weekDay }}</CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>
              <CalendarGridBody>
                <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="index" class="mt-1 flex">
                  <CalendarCell v-for="date in weekDates" :key="date.toString()" :date="date" :class="showLunar ? 'size-11' : 'size-9'" class="p-0">
                    <CalendarCellTrigger :day="date" :month="month.value" :class="showLunar ? 'size-11' : 'size-9'" class="flex flex-col items-center justify-center rounded-md text-sm leading-none outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[outside-view]:text-muted-foreground data-[outside-view]:opacity-50">
                      <span>{{ date.day }}</span>
                      <span v-if="showLunar" class="mt-1 text-[10px] font-normal opacity-70">{{ lunarLabel(date) }}</span>
                    </CalendarCellTrigger>
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>
          </template>
        </CalendarRoot>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
    </div>
    <div class="min-h-5 pt-1"><p v-if="error" role="alert" class="text-xs font-normal text-destructive">{{ error }}</p></div>
  </div>
</template>
