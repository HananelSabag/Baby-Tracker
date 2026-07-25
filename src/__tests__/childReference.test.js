import { describe, it, expect } from 'vitest'
import {
  sleepBandForAgeMonths,
  milestoneBandsForAgeMonths,
  CDC_MILESTONE_AGES,
  SOURCES,
  MEDICAL_DISCLAIMER,
} from '../lib/childReference'

// These aren't cosmetic assertions: this module is the only place the app makes
// health-adjacent comparisons, so the boundaries and the "no data" cases are
// exactly what must not drift.

describe('sleepBandForAgeMonths', () => {
  it('returns no band under 4 months — AASM made no recommendation there', () => {
    expect(sleepBandForAgeMonths(0)).toBeNull()
    expect(sleepBandForAgeMonths(3)).toBeNull()
    expect(sleepBandForAgeMonths(3.9)).toBeNull()
  })

  it('returns 12–16h from 4 months', () => {
    expect(sleepBandForAgeMonths(4)).toMatchObject({ low: 12, high: 16 })
    expect(sleepBandForAgeMonths(11)).toMatchObject({ low: 12, high: 16 })
  })

  it('switches to 11–14h at 12 months', () => {
    expect(sleepBandForAgeMonths(12)).toMatchObject({ low: 11, high: 14 })
    expect(sleepBandForAgeMonths(35)).toMatchObject({ low: 11, high: 14 })
  })

  it('switches to 10–13h at 3 years', () => {
    expect(sleepBandForAgeMonths(36)).toMatchObject({ low: 10, high: 13 })
  })

  it('handles null / negative age without throwing', () => {
    expect(sleepBandForAgeMonths(null)).toBeNull()
    expect(sleepBandForAgeMonths(undefined)).toBeNull()
    expect(sleepBandForAgeMonths(-2)).toBeNull()
  })

  it('returns null past the covered range instead of guessing', () => {
    expect(sleepBandForAgeMonths(500)).toBeNull()
  })
})

describe('milestoneBandsForAgeMonths', () => {
  it('has no current band before the first checklist age', () => {
    const { current, next } = milestoneBandsForAgeMonths(1)
    expect(current).toBeNull()
    expect(next.age).toBe(2)
  })

  it('picks the most recent passed age as current and the following as next', () => {
    const { current, next } = milestoneBandsForAgeMonths(7)
    expect(current.age).toBe(6)
    expect(next.age).toBe(9)
  })

  it('treats an exact checklist age as passed', () => {
    const { current, next } = milestoneBandsForAgeMonths(12)
    expect(current.age).toBe(12)
    expect(next.age).toBe(15)
  })

  it('has no next band past the last checklist', () => {
    const { current, next } = milestoneBandsForAgeMonths(40)
    expect(current.age).toBe(30)
    expect(next).toBeNull()
  })

  it('always returns items for a resolved band', () => {
    for (const age of CDC_MILESTONE_AGES) {
      const { current } = milestoneBandsForAgeMonths(age)
      expect(current.items.length).toBeGreaterThan(0)
      current.items.forEach(i => {
        expect(i.domain).toBeTruthy()
        expect(i.text).toBeTruthy()
      })
    }
  })

  it('handles null age without throwing', () => {
    expect(milestoneBandsForAgeMonths(null)).toEqual({ current: null, next: null })
  })
})

describe('sources', () => {
  it('every reference figure shown to a parent has a citable source with a URL', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(4)
    SOURCES.forEach(s => {
      expect(s.title).toBeTruthy()
      expect(s.detail).toBeTruthy()
      expect(s.url).toMatch(/^https:\/\//)
    })
  })

  it('covers WHO, AASM and CDC — the three bodies the page compares against', () => {
    const ids = SOURCES.map(s => s.id)
    expect(ids).toEqual(expect.arrayContaining(['who', 'aasm', 'cdc']))
  })

  it('carries a disclaimer that names the pediatrician as the authority', () => {
    expect(MEDICAL_DISCLAIMER).toContain('רופא')
    expect(MEDICAL_DISCLAIMER.length).toBeGreaterThan(80)
  })
})
