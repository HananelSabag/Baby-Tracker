import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateFamilyCode,
  generateDeviceToken,
  formatMl,
  formatDateLabel,
  formatTime,
  groupEventsByDay,
  formatAge,
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
// formatTime
// ---------------------------------------------------------------------------
describe('formatTime', () => {
  it('returns a string in HH:mm format', () => {
    // We test the shape, not the exact value, because HH:mm depends on local timezone
    const result = formatTime(new Date())
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('pads single-digit hours and minutes with a leading zero', () => {
    // 2024-06-17T01:05:00Z → "01:05" in UTC (or adjusted by TZ, but always padded)
    const result = formatTime(new Date('2024-06-17T01:05:00Z'))
    expect(result).toMatch(/^\d{2}:\d{2}$/)
    // Both parts must be exactly 2 digits
    const [h, m] = result.split(':')
    expect(h).toHaveLength(2)
    expect(m).toHaveLength(2)
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

  it('returns a Hebrew day+date string for older dates (not today or yesterday)', () => {
    // 10 days before frozen clock → should NOT be "היום" or "אתמול"
    const label = formatDateLabel(new Date('2024-06-07T10:00:00.000Z'))
    expect(label).not.toBe('היום')
    expect(label).not.toBe('אתמול')
    // Should contain a digit (the day-of-month) and a Hebrew month name
    expect(label).toMatch(/\d/)
    expect(label).toMatch(/ב/)
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

// ---------------------------------------------------------------------------
// formatAge — Hebrew age formatter for the home page kid card
// ---------------------------------------------------------------------------
describe('formatAge', () => {
  // Fixed clock so the assertions below are deterministic regardless of when
  // the test runs.
  const NOW = new Date('2024-06-17T12:00:00.000Z')

  it('returns null for missing input', () => {
    expect(formatAge(null, NOW)).toBeNull()
    expect(formatAge(undefined, NOW)).toBeNull()
    expect(formatAge('', NOW)).toBeNull()
  })

  it('returns null when birth date is in the future', () => {
    expect(formatAge('2099-01-01', NOW)).toBeNull()
  })

  it('returns null for an invalid date string', () => {
    expect(formatAge('not-a-date', NOW)).toBeNull()
  })

  it('newborn under a week shows days', () => {
    // 2 days old
    expect(formatAge('2024-06-15', NOW)).toBe('2 ימים')
  })

  it('newborn at 1 day shows the singular form', () => {
    expect(formatAge('2024-06-16', NOW)).toBe('יום')
  })

  it('under a month, exactly N weeks shows weeks only', () => {
    // 14 days = 2 weeks
    expect(formatAge('2024-06-03', NOW)).toBe('2 שבועות')
  })

  it('under a month, exactly 1 week shows the singular', () => {
    expect(formatAge('2024-06-10', NOW)).toBe('שבוע')
  })

  it('months + leftover weeks under 1 year', () => {
    // Born 2024-03-04 → on 2024-06-17: 3 months and ~2 weeks
    const result = formatAge('2024-03-04', NOW)
    expect(result).toMatch(/^3 חודשים ו-/)
    expect(result).toContain('שבוע')
  })

  it('months only when no leftover weeks under 1 year', () => {
    // Born 2024-03-17 → on 2024-06-17: exactly 3 months
    expect(formatAge('2024-03-17', NOW)).toBe('3 חודשים')
  })

  it('singular חודש at 1 month with no leftover weeks', () => {
    expect(formatAge('2024-05-17', NOW)).toBe('חודש')
  })

  it('1 year exactly → "שנה"', () => {
    expect(formatAge('2023-06-17', NOW)).toBe('שנה')
  })

  it('1 year + months → "שנה ו-X חודשים", no weeks', () => {
    // Born 2023-04-17 → 1 year + 2 months on 2024-06-17
    expect(formatAge('2023-04-17', NOW)).toBe('שנה ו-2 חודשים')
  })

  it('multi-year ages drop weeks and pluralise correctly', () => {
    // Born 2022-04-17 → 2 years + 2 months on 2024-06-17
    expect(formatAge('2022-04-17', NOW)).toBe('2 שנים ו-2 חודשים')
  })

  it('whole years with no leftover months → years only', () => {
    expect(formatAge('2022-06-17', NOW)).toBe('2 שנים')
  })
})
