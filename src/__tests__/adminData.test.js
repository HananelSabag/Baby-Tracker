import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bestLastSeen, daysSince, isDormant } from '../hooks/useAdminData'

const NOW = new Date(2026, 6, 15, 12, 0, 0)
const daysAgo = n => new Date(NOW.getTime() - n * 86_400_000).toISOString()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => { vi.useRealTimers() })

describe('bestLastSeen', () => {
  it('prefers last_seen_at over last_sign_in', () => {
    // last_sign_in only moves on re-auth, so a daily user can look inactive
    // for weeks by that measure alone.
    const user = { last_sign_in: daysAgo(30), member: { last_seen_at: daysAgo(1) } }
    expect(bestLastSeen(user)).toBe(user.member.last_seen_at)
  })

  it('falls back to last_sign_in when there is no member row', () => {
    const user = { last_sign_in: daysAgo(3), member: null }
    expect(bestLastSeen(user)).toBe(user.last_sign_in)
  })

  it('is null for an account that never signed in', () => {
    expect(bestLastSeen({ last_sign_in: null, member: null })).toBeNull()
  })
})

describe('daysSince', () => {
  it('measures elapsed days', () => {
    expect(Math.round(daysSince(daysAgo(7)))).toBe(7)
  })

  it('treats missing dates as infinitely old, so they sort last', () => {
    expect(daysSince(null)).toBe(Infinity)
    expect(daysSince(undefined)).toBe(Infinity)
  })
})

describe('isDormant — the accounts worth clearing out', () => {
  it('flags an account with no family at all', () => {
    expect(isDormant({ member: null, stats: { events: 0 } })).toBe(true)
  })

  it('flags a family member who has logged nothing in weeks', () => {
    const user = {
      member: { last_seen_at: daysAgo(40) },
      stats: { events: 0 },
    }
    expect(isDormant(user)).toBe(true)
  })

  it('does NOT flag someone who logged even once', () => {
    const user = {
      member: { last_seen_at: daysAgo(90) },
      stats: { events: 1 },
    }
    expect(isDormant(user)).toBe(false)
  })

  it('does NOT flag a brand-new signup still inside the grace window', () => {
    // Someone who joined three days ago and hasn't logged yet is not spam.
    const user = {
      member: { last_seen_at: daysAgo(3) },
      stats: { events: 0 },
    }
    expect(isDormant(user)).toBe(false)
  })

  it('handles a missing stats object', () => {
    expect(isDormant({ member: { last_seen_at: daysAgo(40) } })).toBe(true)
  })
})
