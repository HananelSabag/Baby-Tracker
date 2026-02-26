import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateFamilyCode,
  generateDeviceToken,
  formatMl,
  formatDateLabel,
  groupEventsByDay,
  cn,
} from '../lib/utils'

// ---------------------------------------------------------------------------
// generateFamilyCode
// ---------------------------------------------------------------------------
describe('generateFamilyCode', () => {
  it('returns exactly 6 characters', () => {
    const code = generateFamilyCode()
    expect(code).toHaveLength(6)
  })

  it('only contains allowed characters (uppercase letters and digits, no I/O/1/0)', () => {
    const ALLOWED = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for (let i = 0; i < 50; i++) {
      const code = generateFamilyCode()
      for (const char of code) {
        expect(ALLOWED).toContain(char)
      }
    }
  })

  it('produces unique codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 20 }, generateFamilyCode))
    // Statistically near-impossible to get duplicates in 20 calls
    expect(codes.size).toBeGreaterThan(15)
  })
})

// ---------------------------------------------------------------------------
// generateDeviceToken
// ---------------------------------------------------------------------------
describe('generateDeviceToken', () => {
  it('starts with the dt_ prefix', () => {
    expect(generateDeviceToken()).toMatch(/^dt_/)
  })

  it('contains a numeric timestamp segment after dt_', () => {
    const token = generateDeviceToken()
    const parts = token.split('_')
    // format: dt_<timestamp>_<random>
    expect(parts).toHaveLength(3)
    expect(Number(parts[1])).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// formatMl
// ---------------------------------------------------------------------------
describe('formatMl', () => {
  it('formats a number with the Hebrew ml suffix', () => {
    expect(formatMl(120)).toBe('120 מ"ל')
  })

  it('works for 0 ml', () => {
    expect(formatMl(0)).toBe('0 מ"ל')
  })
})

// ---------------------------------------------------------------------------
// cn — class name merger
// ---------------------------------------------------------------------------
describe('cn', () => {
  it('joins multiple truthy class strings with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz')
  })

  it('filters out all falsy values (false, null, undefined, empty string)', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })
})

// ---------------------------------------------------------------------------
// formatDateLabel — uses "today" / "yesterday" so we MUST freeze time
// ---------------------------------------------------------------------------
describe('formatDateLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Freeze time: Monday 2024-06-17 at noon UTC
    vi.setSystemTime(new Date('2024-06-17T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "היום" for a timestamp on today\'s date', () => {
    // Same day as frozen clock → should return "היום"
    const label = formatDateLabel(new Date('2024-06-17T08:30:00.000Z'))
    expect(label).toBe('היום')
  })

  it('returns "אתמול" for a timestamp on yesterday\'s date', () => {
    // One day before frozen clock → should return "אתמול"
    const label = formatDateLabel(new Date('2024-06-16T15:00:00.000Z'))
    expect(label).toBe('אתמול')
  })
})

// ---------------------------------------------------------------------------
// groupEventsByDay
// ---------------------------------------------------------------------------
describe('groupEventsByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-17T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('groups events that share a day into the same bucket', () => {
    const events = [
      { occurred_at: '2024-06-17T08:00:00.000Z', id: 1 },
      { occurred_at: '2024-06-17T10:00:00.000Z', id: 2 },
      { occurred_at: '2024-06-16T09:00:00.000Z', id: 3 },
    ]

    const groups = groupEventsByDay(events)

    // Two events on "today", one on "yesterday"
    expect(groups.get('היום')).toHaveLength(2)
    expect(groups.get('אתמול')).toHaveLength(1)
  })

  it('returns an empty Map for an empty events array', () => {
    const groups = groupEventsByDay([])
    expect(groups.size).toBe(0)
  })
})
