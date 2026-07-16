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
