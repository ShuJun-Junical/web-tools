import { Lunar, Solar } from 'lunar-typescript'

export type BaziInput = {
  calendar: 'solar' | 'lunar'
  year: number
  month: number
  day: number
  hour: number
  minute: number
  leapMonth: boolean
  gender: 'male' | 'female'
  daySect: 1 | 2
  yunSect: 1 | 2
}

export type FiveElement = '木' | '火' | '土' | '金' | '水'

export type BaziPillar = {
  label: string
  gan: string
  zhi: string
  ganElement: FiveElement
  zhiElement: FiveElement
  ganYinYang: '阳' | '阴'
  zhiYinYang: '阳' | '阴'
  ganShiShen: string
  hiddenGan: { gan: string, element: FiveElement, shiShen: string }[]
  naYin: string
  diShi: string
  xun: string
  xunKong: string
}

export type BaziResult = {
  solar: string
  lunar: string
  previousJie: { name: string, time: string }
  nextJie: { name: string, time: string }
  pillars: BaziPillar[]
  fiveElements: Record<'gan' | 'zhi' | 'hidden', Record<FiveElement, number>>
  relations: string[]
  derived: { label: string, ganZhi: string, naYin: string }[]
  yun: {
    direction: '顺排' | '逆排'
    startOffset: string
    startTime: string
    daYun: {
      ganZhi: string
      startYear: number
      endYear: number
      startAge: number
      endAge: number
      xun: string
      xunKong: string
      years: {
        year: number
        age: number
        ganZhi: string
        xiaoYun: string
        xun: string
        xunKong: string
        months: { month: string, ganZhi: string, xun: string, xunKong: string }[]
      }[]
    }[]
  }
}

const ganElement: Record<string, FiveElement> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
}
const zhiElement: Record<string, FiveElement> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
}
const ganOrder = '甲乙丙丁戊己庚辛壬癸'
const zhiOrder = '子丑寅卯辰巳午未申酉戌亥'
const positions = ['年', '月', '日', '时']

function validateInput(input: BaziInput) {
  const fields = [input.year, input.month, input.day, input.hour, input.minute]
  if (!fields.every(Number.isInteger)) throw new Error('日期和时间必须填写整数。')
  if (input.year < 1900 || input.year > 2100) throw new Error('目前支持 1900—2100 年。')
  if (input.month < 1 || input.month > 12) throw new Error('月份必须在 1—12 之间。')
  if (input.day < 1 || input.day > 31) throw new Error('日期无效。')
  if (input.hour < 0 || input.hour > 23 || input.minute < 0 || input.minute > 59) throw new Error('时间无效。')
  if (input.calendar === 'solar') {
    const days = new Date(Date.UTC(input.year, input.month, 0)).getUTCDate()
    if (input.day > days) throw new Error('公历日期无效。')
  }
}

function makeCalendar(input: BaziInput) {
  validateInput(input)
  try {
    if (input.calendar === 'solar') {
      const solar = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute, 0)
      return { solar, lunar: solar.getLunar() }
    }
    const month = input.leapMonth ? -input.month : input.month
    const lunar = Lunar.fromYmdHms(input.year, month, input.day, input.hour, input.minute, 0)
    if (lunar.getYear() !== input.year || lunar.getMonth() !== month || lunar.getDay() !== input.day) {
      throw new Error('农历日期无效，或该年没有所选闰月。')
    }
    return { solar: lunar.getSolar(), lunar }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('农历日期')) throw error
    throw new Error(`${input.calendar === 'solar' ? '公历' : '农历'}日期无效。`)
  }
}

function yinYang(value: string, order: string): '阳' | '阴' {
  return order.indexOf(value) % 2 === 0 ? '阳' : '阴'
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join('')
}

function pairMap(groups: [string, string][]) {
  return new Set(groups.map(([a, b]) => pairKey(a, b)))
}

const ganHe = pairMap([['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']])
const ganChong = pairMap([['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸']])
const zhiRelations = [
  ['六合', pairMap([['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']])],
  ['六冲', pairMap([['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']])],
  ['六害', pairMap([['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']])],
  ['六破', pairMap([['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']])],
] as const
const sanHe = ['申子辰', '亥卯未', '寅午戌', '巳酉丑']
const sanHui = ['亥子丑', '寅卯辰', '巳午未', '申酉戌']
const sanXing = ['寅巳申', '丑未戌']
const ziMaoXing = pairMap([['子', '卯']])
const selfXing = new Set(['辰', '午', '酉', '亥'])

function findRelations(pillars: BaziPillar[]) {
  const result: string[] = []
  for (let i = 0; i < pillars.length; i++) {
    for (let j = i + 1; j < pillars.length; j++) {
      const ganKey = pairKey(pillars[i].gan, pillars[j].gan)
      if (ganHe.has(ganKey)) result.push(`${positions[i]}干${pillars[i].gan}与${positions[j]}干${pillars[j].gan}：天干五合`)
      if (ganChong.has(ganKey)) result.push(`${positions[i]}干${pillars[i].gan}与${positions[j]}干${pillars[j].gan}：天干相冲`)
      const zhiKey = pairKey(pillars[i].zhi, pillars[j].zhi)
      for (const [name, pairs] of zhiRelations) {
        if (pairs.has(zhiKey)) result.push(`${positions[i]}支${pillars[i].zhi}与${positions[j]}支${pillars[j].zhi}：${name}`)
      }
      if (ziMaoXing.has(zhiKey)) result.push(`${positions[i]}支${pillars[i].zhi}与${positions[j]}支${pillars[j].zhi}：相刑`)
      if (pillars[i].zhi === pillars[j].zhi && selfXing.has(pillars[i].zhi)) {
        result.push(`${positions[i]}支与${positions[j]}支${pillars[i].zhi}${pillars[j].zhi}：自刑`)
      }
    }
  }

  const branches = pillars.map(pillar => pillar.zhi)
  const addGroup = (group: string, name: string) => {
    const values = [...group]
    if (!values.every(value => branches.includes(value))) return false
    const members = values.map(value => `${positions[branches.indexOf(value)]}支${value}`).join('、')
    result.push(`${members}：${group}${name}`)
    return true
  }
  sanHe.forEach(group => addGroup(group, '三合'))
  sanHui.forEach(group => addGroup(group, '三会'))
  sanXing.forEach(group => {
    if (addGroup(group, '三刑')) return
    const values = [...group]
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const left = branches.indexOf(values[i])
        const right = branches.indexOf(values[j])
        if (left >= 0 && right >= 0) result.push(`${positions[left]}支${values[i]}与${positions[right]}支${values[j]}：相刑`)
      }
    }
  })
  return result
}

function emptyElementCounts(): Record<FiveElement, number> {
  return { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
}

export function calculateBazi(input: BaziInput): BaziResult {
  const { solar, lunar } = makeCalendar(input)
  const eightChar = lunar.getEightChar()
  eightChar.setSect(input.daySect)

  const rawPillars = [
    ['年柱', eightChar.getYearGan(), eightChar.getYearZhi(), eightChar.getYearShiShenGan(), eightChar.getYearHideGan(), eightChar.getYearShiShenZhi(), eightChar.getYearNaYin(), eightChar.getYearDiShi(), eightChar.getYearXun(), eightChar.getYearXunKong()],
    ['月柱', eightChar.getMonthGan(), eightChar.getMonthZhi(), eightChar.getMonthShiShenGan(), eightChar.getMonthHideGan(), eightChar.getMonthShiShenZhi(), eightChar.getMonthNaYin(), eightChar.getMonthDiShi(), eightChar.getMonthXun(), eightChar.getMonthXunKong()],
    ['日柱', eightChar.getDayGan(), eightChar.getDayZhi(), eightChar.getDayShiShenGan(), eightChar.getDayHideGan(), eightChar.getDayShiShenZhi(), eightChar.getDayNaYin(), eightChar.getDayDiShi(), eightChar.getDayXun(), eightChar.getDayXunKong()],
    ['时柱', eightChar.getTimeGan(), eightChar.getTimeZhi(), eightChar.getTimeShiShenGan(), eightChar.getTimeHideGan(), eightChar.getTimeShiShenZhi(), eightChar.getTimeNaYin(), eightChar.getTimeDiShi(), eightChar.getTimeXun(), eightChar.getTimeXunKong()],
  ] as const
  const pillars = rawPillars.map(([label, gan, zhi, ganShiShen, hidden, hiddenShiShen, naYin, diShi, xun, xunKong]) => ({
    label,
    gan,
    zhi,
    ganElement: ganElement[gan],
    zhiElement: zhiElement[zhi],
    ganYinYang: yinYang(gan, ganOrder),
    zhiYinYang: yinYang(zhi, zhiOrder),
    ganShiShen,
    hiddenGan: hidden.map((value, index) => ({ gan: value, element: ganElement[value], shiShen: hiddenShiShen[index] })),
    naYin,
    diShi,
    xun,
    xunKong,
  }))

  const fiveElements = { gan: emptyElementCounts(), zhi: emptyElementCounts(), hidden: emptyElementCounts() }
  pillars.forEach((pillar) => {
    fiveElements.gan[pillar.ganElement]++
    fiveElements.zhi[pillar.zhiElement]++
    pillar.hiddenGan.forEach(item => fiveElements.hidden[item.element]++)
  })

  const yun = eightChar.getYun(input.gender === 'male' ? 1 : 0, input.yunSect)
  const daYun = yun.getDaYun(9).slice(1).map((item) => {
    const xiaoYun = item.getXiaoYun()
    return {
      ganZhi: item.getGanZhi(),
      startYear: item.getStartYear(),
      endYear: item.getEndYear(),
      startAge: item.getStartAge(),
      endAge: item.getEndAge(),
      xun: item.getXun(),
      xunKong: item.getXunKong(),
      years: item.getLiuNian().map((year, index) => ({
        year: year.getYear(),
        age: year.getAge(),
        ganZhi: year.getGanZhi(),
        xiaoYun: xiaoYun[index]?.getGanZhi() ?? '',
        xun: year.getXun(),
        xunKong: year.getXunKong(),
        months: year.getLiuYue().map(month => ({
          month: month.getMonthInChinese(),
          ganZhi: month.getGanZhi(),
          xun: month.getXun(),
          xunKong: month.getXunKong(),
        })),
      })),
    }
  })
  const previousJie = lunar.getPrevJie(false)
  const nextJie = lunar.getNextJie(false)

  return {
    solar: solar.toYmdHms(),
    lunar: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getTimeZhi()}时`,
    previousJie: { name: previousJie.getName(), time: previousJie.getSolar().toYmdHms() },
    nextJie: { name: nextJie.getName(), time: nextJie.getSolar().toYmdHms() },
    pillars,
    fiveElements,
    relations: findRelations(pillars),
    derived: [
      { label: '胎元', ganZhi: eightChar.getTaiYuan(), naYin: eightChar.getTaiYuanNaYin() },
      { label: '胎息', ganZhi: eightChar.getTaiXi(), naYin: eightChar.getTaiXiNaYin() },
      { label: '命宫', ganZhi: eightChar.getMingGong(), naYin: eightChar.getMingGongNaYin() },
      { label: '身宫', ganZhi: eightChar.getShenGong(), naYin: eightChar.getShenGongNaYin() },
    ],
    yun: {
      direction: yun.isForward() ? '顺排' : '逆排',
      startOffset: `${yun.getStartYear()} 年 ${yun.getStartMonth()} 个月 ${yun.getStartDay()} 天${yun.getStartHour() ? ` ${yun.getStartHour()} 小时` : ''}`,
      startTime: yun.getStartSolar().toYmdHms(),
      daYun,
    },
  }
}

// TODO: 命理解读，包括旺衰、格局、合化、喜忌用神和人生断语；实现前需明确流派与可核验规则。
