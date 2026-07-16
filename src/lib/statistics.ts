export interface Summary {
  count: number
  sum: number
  mean: number
  variance: number
  standardDeviation: number
  min: number
  max: number
  median: number
  modes: number[]
}

export interface LinearCorrelation {
  coefficient: number
  slope: number
  intercept: number
}

export const contingencyKeys = ['a', 'b', 'c', 'd', 'ab', 'cd', 'ac', 'bd', 'n'] as const
export type ContingencyKey = typeof contingencyKeys[number]

const contingencyEquations: ReadonlyArray<readonly [ContingencyKey, ContingencyKey, ContingencyKey]> = [
  ['a', 'b', 'ab'],
  ['c', 'd', 'cd'],
  ['a', 'c', 'ac'],
  ['b', 'd', 'bd'],
  ['ab', 'cd', 'n'],
  ['ac', 'bd', 'n'],
]

export function solveContingencyTable(input: Partial<Record<ContingencyKey, number>>) {
  const values = Object.fromEntries(contingencyKeys.map(key => [key, input[key] ?? null])) as Record<ContingencyKey, number | null>
  const derivedKeys = new Set<ContingencyKey>()
  const conflictKeys = new Set<ContingencyKey>()
  const negativeKeys = new Set<ContingencyKey>()
  let changed: boolean

  do {
    changed = false

    contingencyEquations.forEach(([leftKey, rightKey, totalKey]) => {
      const left = values[leftKey]
      const right = values[rightKey]
      const total = values[totalKey]
      const missing = [leftKey, rightKey, totalKey].filter(key => values[key] === null)

      if (!missing.length) {
        if (left! + right! !== total) [leftKey, rightKey, totalKey].forEach(key => conflictKeys.add(key))
        return
      }
      if (missing.length !== 1) return

      const key = missing[0]
      const value = key === totalKey ? left! + right! : total! - values[key === leftKey ? rightKey : leftKey]!
      if (value < 0) {
        [leftKey, rightKey, totalKey].forEach(item => {
          conflictKeys.add(item)
          negativeKeys.add(item)
        })
        return
      }

      values[key] = value
      derivedKeys.add(key)
      changed = true
    })
  } while (changed)

  return {
    values,
    derivedKeys: contingencyKeys.filter(key => derivedKeys.has(key)),
    conflictKeys: contingencyKeys.filter(key => conflictKeys.has(key)),
    negativeKeys: contingencyKeys.filter(key => negativeKeys.has(key)),
  }
}

export function parseNumberLines(text: string) {
  const values: number[] = []
  const invalidLines: number[] = []

  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return

    const value = Number(trimmed)
    if (Number.isFinite(value)) values.push(value)
    else invalidLines.push(index + 1)
  })

  return { values, invalidLines }
}

export function summarize(values: number[]): Summary | null {
  if (!values.length) return null

  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((total, value) => total + value, 0)
  const mean = sum / values.length
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  const frequencies = new Map<number, number>()

  values.forEach(value => frequencies.set(value, (frequencies.get(value) ?? 0) + 1))
  const highestFrequency = Math.max(...frequencies.values())
  const modes = highestFrequency === 1
    ? []
    : [...frequencies.entries()]
        .filter(([, frequency]) => frequency === highestFrequency)
        .map(([value]) => value)
        .sort((a, b) => a - b)

  return {
    count: values.length,
    sum,
    mean,
    variance,
    standardDeviation: Math.sqrt(variance),
    min: sorted[0],
    max: sorted.at(-1)!,
    median,
    modes,
  }
}

export function chiSquare2x2([a, b, c, d]: readonly number[]): number | null {
  const n = a + b + c + d
  const denominator = (a + b) * (c + d) * (a + c) * (b + d)
  return denominator ? (n * (a * d - b * c) ** 2) / denominator : null
}

export function phiCoefficient2x2(counts: readonly number[]): number | null {
  const chiSquare = chiSquare2x2(counts)
  const total = counts.reduce((sum, value) => sum + value, 0)
  return chiSquare === null || !total ? null : Math.sqrt(chiSquare / total)
}

export function linearCorrelation(x: number[], y: number[]): LinearCorrelation | null {
  if (x.length !== y.length || x.length < 2) return null

  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length
  let covariance = 0
  let varianceX = 0
  let varianceY = 0

  x.forEach((value, index) => {
    const deviationX = value - meanX
    const deviationY = y[index] - meanY
    covariance += deviationX * deviationY
    varianceX += deviationX ** 2
    varianceY += deviationY ** 2
  })

  if (!varianceX || !varianceY) return null

  return {
    coefficient: covariance / Math.sqrt(varianceX * varianceY),
    slope: covariance / varianceX,
    intercept: meanY - (covariance / varianceX) * meanX,
  }
}
