export type PositiveCount = 0 | 1 | 2 | 3

export type Trigram = {
  name: string
  image: string
}

export type Hexagram = {
  number: number
  name: string
  lines: boolean[]
  lowerTrigram: Trigram
  upperTrigram: Trigram
}

export const yaoNames: Record<PositiveCount, string> = {
  0: '老阴',
  1: '少阳',
  2: '少阴',
  3: '老阳',
}

const hexagramNames = [
  '乾为天', '坤为地', '水雷屯', '山水蒙', '水天需', '天水讼', '地水师', '水地比',
  '风天小畜', '天泽履', '地天泰', '天地否', '天火同人', '火天大有', '地山谦', '雷地豫',
  '泽雷随', '山风蛊', '地泽临', '风地观', '火雷噬嗑', '山火贲', '山地剥', '地雷复',
  '天雷无妄', '山天大畜', '山雷颐', '泽风大过', '坎为水', '离为火', '泽山咸', '雷风恒',
  '天山遁', '雷天大壮', '火地晋', '地火明夷', '风火家人', '火泽睽', '水山蹇', '雷水解',
  '山泽损', '风雷益', '泽天夬', '天风姤', '泽地萃', '地风升', '泽水困', '水风井',
  '泽火革', '火风鼎', '震为雷', '艮为山', '风山渐', '雷泽归妹', '雷火丰', '火山旅',
  '巽为风', '兑为泽', '风水涣', '水泽节', '风泽中孚', '雷山小过', '水火既济', '火水未济',
] as const

const trigrams: readonly Trigram[] = [
  { name: '坤', image: '地' },
  { name: '震', image: '雷' },
  { name: '坎', image: '水' },
  { name: '兑', image: '泽' },
  { name: '艮', image: '山' },
  { name: '离', image: '火' },
  { name: '巽', image: '风' },
  { name: '乾', image: '天' },
]

// 行是上卦，列是下卦；三位二进制从初爻起以阳为 1。
const kingWenNumbers = [
  [2, 24, 7, 19, 15, 36, 46, 11],
  [16, 51, 40, 54, 62, 55, 32, 34],
  [8, 3, 29, 60, 39, 63, 48, 5],
  [45, 17, 47, 58, 31, 49, 28, 43],
  [23, 27, 4, 41, 52, 22, 18, 26],
  [35, 21, 64, 38, 56, 30, 50, 14],
  [20, 42, 59, 61, 53, 37, 57, 9],
  [12, 25, 6, 10, 33, 13, 44, 1],
] as const

export function getHexagram(lines: boolean[]): Hexagram {
  if (lines.length !== 6) throw new Error('卦象必须包含六爻。')
  const lower = Number(lines[0]) | Number(lines[1]) << 1 | Number(lines[2]) << 2
  const upper = Number(lines[3]) | Number(lines[4]) << 1 | Number(lines[5]) << 2
  const number = kingWenNumbers[upper][lower]
  return {
    number,
    name: hexagramNames[number - 1],
    lines,
    lowerTrigram: trigrams[lower],
    upperTrigram: trigrams[upper],
  }
}

export function interpretYao(positiveCounts: PositiveCount[]) {
  if (positiveCounts.length !== 6) throw new Error('起卦结果必须包含六爻。')
  const originalLines = positiveCounts.map(count => count % 2 === 1)
  const changedLines = positiveCounts.map((count, index) => count === 0 ? true : count === 3 ? false : originalLines[index])
  return {
    original: getHexagram(originalLines),
    changed: getHexagram(changedLines),
    mutual: getHexagram([originalLines[1], originalLines[2], originalLines[3], originalLines[2], originalLines[3], originalLines[4]]),
    changingLines: positiveCounts.flatMap((count, index) => count === 0 || count === 3 ? [index + 1] : []),
  }
}

export function countPositiveCoins(coins: boolean[]): PositiveCount {
  if (coins.length !== 3) throw new Error('每爻必须掷三枚铜钱。')
  return coins.filter(Boolean).length as PositiveCount
}

export function castCoins(actionSample = 0): { tosses: boolean[][], positiveCounts: PositiveCount[] } {
  const random = crypto.getRandomValues(new Uint8Array(18))
  const actionBits = Math.trunc(actionSample * 1000) >>> 0
  const tosses = Array.from({ length: 6 }, (_, line) =>
    Array.from({ length: 3 }, (_, coin) => {
      const index = line * 3 + coin
      return ((random[index] ^ (actionBits >>> index)) & 1) === 1
    }),
  )
  return { tosses, positiveCounts: tosses.map(countPositiveCoins) }
}
