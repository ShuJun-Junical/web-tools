import { describe, expect, it } from 'vitest'
import { calculatePpi, cssPixelsPerMillimeter, wholeMillimetersThatFit } from '@/lib/ruler'

describe('ruler calculations', () => {
  it('calculates PPI from resolution and diagonal size', () => {
    expect(calculatePpi(1920, 1080, 24)).toBeCloseTo(91.79, 2)
  })

  it('returns null for incomplete or invalid display data', () => {
    expect(calculatePpi(1920, 1080, 0)).toBeNull()
    expect(cssPixelsPerMillimeter(0, 2)).toBeNull()
  })

  it('converts physical pixel density to CSS pixels per millimeter', () => {
    expect(cssPixelsPerMillimeter(254, 2)).toBeCloseTo(5, 5)
  })

  it('only includes complete millimeter intervals that fit the available width', () => {
    expect(wholeMillimetersThatFit(100, 3.5, 500)).toBe(28)
    expect(wholeMillimetersThatFit(2000, 3.5, 500)).toBe(500)
  })
})
