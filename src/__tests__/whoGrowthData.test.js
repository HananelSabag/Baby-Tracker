import { describe, it, expect } from 'vitest'
import {
  interpolateWHO,
  ageInMonths,
  getWeightPercentileLabel,
  getHeightPercentileLabel,
  WHO_WEIGHT_BOYS,
  WHO_HEIGHT_BOYS,
  WHO_HEIGHT_GIRLS,
} from '../lib/whoGrowthData'

// ---------------------------------------------------------------------------
// interpolateWHO
// ---------------------------------------------------------------------------
describe('interpolateWHO', () => {
  it('returns exact table values when the age matches a row directly (no interpolation)', () => {
    // Month 0 in WHO_WEIGHT_BOYS = [0, 2.5, 3.0, 3.3, 3.7, 4.4]
    // The function returns the columns after "month", so [2.5, 3.0, 3.3, 3.7, 4.4]
    const result = interpolateWHO(WHO_WEIGHT_BOYS, 0)
    expect(result).toEqual([2.5, 3.0, 3.3, 3.7, 4.4])
  })

  it('returns null for a negative age (impossible input)', () => {
    expect(interpolateWHO(WHO_WEIGHT_BOYS, -1)).toBeNull()
  })

  it('returns null when age exceeds the table maximum (24 months)', () => {
    expect(interpolateWHO(WHO_WEIGHT_BOYS, 25)).toBeNull()
  })

  it('interpolates correctly between two known rows', () => {
    // Rows at month 0 and month 1 for boys (p50): 3.3 and 4.5
    // At month 0.5 (midpoint) the interpolated p50 should be ~3.9
    const result = interpolateWHO(WHO_WEIGHT_BOYS, 0.5)
    const p50 = result[2] // index 2 = p50 in the [p3, p15, p50, p85, p97] layout
    expect(p50).toBeCloseTo(3.9, 0) // within ±0.5
  })
})

// ---------------------------------------------------------------------------
// ageInMonths
// Deterministic: both dates are hardcoded — no dependency on "today"
// ---------------------------------------------------------------------------
describe('ageInMonths', () => {
  it('calculates approximately 6 months between Jan 1 and Jul 1', () => {
    const months = ageInMonths('2024-01-01', '2024-07-01')
    expect(months).toBeCloseTo(6, 0)
  })

  it('returns 0 when birth date equals measurement date', () => {
    const months = ageInMonths('2024-01-01', '2024-01-01')
    expect(months).toBe(0)
  })

  it('returns null when birthDate is not provided', () => {
    expect(ageInMonths(null, '2024-07-01')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getWeightPercentileLabel
// ---------------------------------------------------------------------------
describe('getWeightPercentileLabel', () => {
  it('returns the "קרוב לממוצע" label when weight is near p50 for a 6-month boy', () => {
    // At 6 months, boys p50 = 7.9 kg — 7.5 kg is between p15 (7.1) and p50 (7.9)
    const label = getWeightPercentileLabel(7.5, 6, 'male')
    expect(label).toContain('קרוב לממוצע')
  })

  it('returns the below-p3 label for very low weight', () => {
    // 1 kg at 6 months is clearly below p3 (6.4 kg for boys)
    const label = getWeightPercentileLabel(1, 6, 'male')
    expect(label).toContain('מתחת לאחוזון 3')
  })

  it('returns the above-p97 label for very high weight', () => {
    // 20 kg at 6 months is clearly above p97 (9.8 kg for boys)
    const label = getWeightPercentileLabel(20, 6, 'male')
    expect(label).toContain('מעל אחוזון 97')
  })

  it('returns null when age is out of the WHO table range', () => {
    expect(getWeightPercentileLabel(10, 30, 'male')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getHeightPercentileLabel
// ---------------------------------------------------------------------------
describe('getHeightPercentileLabel', () => {
  it('returns "מעל הממוצע" label for height between p50 and p97', () => {
    // At 6 months, girls p50 = 65.7, p97 = 70.3 — 68 cm is between them
    const label = getHeightPercentileLabel(68, 6, 'female')
    expect(label).toContain('מעל הממוצע')
  })

  it('returns the below-p3 label for very short height', () => {
    // 40 cm at 6 months is clearly below p3 (61.2 for girls)
    const label = getHeightPercentileLabel(40, 6, 'female')
    expect(label).toContain('מתחת לאחוזון 3')
  })
})
