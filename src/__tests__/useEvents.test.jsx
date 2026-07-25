import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// ── Fake Supabase ────────────────────────────────────────────────────────────
// Chainable builder that resolves to a fixed row set and counts how many
// queries were actually issued.

const state = { rows: [], selectCount: 0 }

function makeBuilder() {
  const b = {
    select() { state.selectCount += 1; return b },
    eq() { return b },
    gte() { return b },
    lte() { return b },
    in() { return b },
    order() { return b },
    limit() { return b },
    single() { return Promise.resolve({ data: null, error: null }) },
    then(resolve, reject) {
      return Promise.resolve({ data: state.rows, error: null }).then(resolve, reject)
    },
  }
  return b
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => makeBuilder(),
    channel: () => {
      const ch = {
        on() { return ch },
        subscribe() { return ch },
      }
      return ch
    },
    removeChannel: () => {},
  },
}))

const { useEvents, matchesTracker } = await import('../hooks/useEvents')
const { useHomeEvents } = await import('../hooks/useHomeEvents')
const { invalidateAll } = await import('../lib/api')

const DAY = new Date(2026, 6, 15, 12, 0, 0)

const ROWS = [
  { id: 1, tracker_id: 'feed',   child_id: 'c1', occurred_at: new Date(2026, 6, 15, 9).toISOString(),  data: { amount_ml: 120 } },
  { id: 2, tracker_id: 'feed',   child_id: 'c1', occurred_at: new Date(2026, 6, 15, 6).toISOString(),  data: { amount_ml: 100 } },
  { id: 3, tracker_id: 'diaper', child_id: 'c1', occurred_at: new Date(2026, 6, 15, 8).toISOString(),  data: { type: 'wet' } },
  { id: 4, tracker_id: 'sleep',  child_id: 'c1', occurred_at: new Date(2026, 6, 15, 13).toISOString(), data: { type: 'start' } },
]

beforeEach(() => {
  invalidateAll()
  state.rows = ROWS
  state.selectCount = 0
})

describe('useEvents — day mode shares one request', () => {
  it('serves three tracker cards from a single query', async () => {
    // The regression this guards: each card used to run its own query for a
    // subset of the same day's rows.
    const feed   = renderHook(() => useEvents('fam1', { trackerId: 'feed',   date: DAY, childId: 'c1' }))
    const diaper = renderHook(() => useEvents('fam1', { trackerId: 'diaper', date: DAY, childId: 'c1' }))
    const sleep  = renderHook(() => useEvents('fam1', { trackerId: 'sleep',  date: DAY, childId: 'c1' }))

    await waitFor(() => expect(feed.result.current.events.length).toBeGreaterThan(0))
    await waitFor(() => expect(diaper.result.current.events.length).toBeGreaterThan(0))
    await waitFor(() => expect(sleep.result.current.events.length).toBeGreaterThan(0))

    expect(state.selectCount).toBe(1)
  })

  it('still gives each card only its own tracker rows', async () => {
    const feed   = renderHook(() => useEvents('fam1', { trackerId: 'feed',   date: DAY, childId: 'c1' }))
    const diaper = renderHook(() => useEvents('fam1', { trackerId: 'diaper', date: DAY, childId: 'c1' }))

    await waitFor(() => expect(feed.result.current.events.length).toBe(2))
    await waitFor(() => expect(diaper.result.current.events.length).toBe(1))

    expect(feed.result.current.events.map(e => e.id).sort()).toEqual([1, 2])
    expect(diaper.result.current.events[0].id).toBe(3)
  })

  it('shares the same request with the home page hook', async () => {
    const home = renderHook(() => useHomeEvents('fam1', DAY, 'c1'))
    const feed = renderHook(() => useEvents('fam1', { trackerId: 'feed', date: DAY, childId: 'c1' }))

    await waitFor(() => expect(Object.keys(home.result.current.eventsByTracker).length).toBe(3))
    await waitFor(() => expect(feed.result.current.events.length).toBe(2))

    expect(state.selectCount).toBe(1)
  })

  it('groups the home page rows by tracker', async () => {
    const home = renderHook(() => useHomeEvents('fam1', DAY, 'c1'))
    await waitFor(() => expect(home.result.current.loading).toBe(false))

    const grouped = home.result.current.eventsByTracker
    expect(grouped.feed).toHaveLength(2)
    expect(grouped.diaper).toHaveLength(1)
    expect(grouped.sleep).toHaveLength(1)
  })

  it('issues a separate request for a different day', async () => {
    const a = renderHook(() => useEvents('fam1', { trackerId: 'feed', date: DAY, childId: 'c1' }))
    await waitFor(() => expect(a.result.current.loading).toBe(false))

    const other = new Date(2026, 6, 14, 12, 0, 0)
    const b = renderHook(() => useEvents('fam1', { trackerId: 'feed', date: other, childId: 'c1' }))
    await waitFor(() => expect(b.result.current.loading).toBe(false))

    expect(state.selectCount).toBe(2)
  })

  it('does not query at all without a familyId', async () => {
    const { result } = renderHook(() => useEvents(null, { trackerId: 'feed', date: DAY }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events).toEqual([])
    expect(state.selectCount).toBe(0)
  })
})

describe('matchesTracker — which realtime rows a card reacts to', () => {
  it('ignores a row belonging to another tracker', () => {
    // "If I only fed, there is nothing to check about diapers or sleep."
    expect(matchesTracker({ new: { tracker_id: 'feed' } }, 'diaper')).toBe(false)
  })

  it('reacts to a row for its own tracker', () => {
    expect(matchesTracker({ new: { tracker_id: 'feed' } }, 'feed')).toBe(true)
  })

  it('reacts to everything when the hook is not tracker-scoped', () => {
    expect(matchesTracker({ new: { tracker_id: 'feed' } }, null)).toBe(true)
    expect(matchesTracker({ new: { tracker_id: 'feed' } }, undefined)).toBe(true)
  })

  it('refetches on a DELETE, which carries no tracker_id', () => {
    // Postgres ships only the primary key in `old` unless REPLICA IDENTITY is
    // FULL, so a delete cannot be attributed. Refetching is the safe direction —
    // dropping it would leave deleted events on screen.
    expect(matchesTracker({ eventType: 'DELETE', old: { id: 7 }, new: {} }, 'feed')).toBe(true)
    expect(matchesTracker({ old: { id: 7 } }, 'feed')).toBe(true)
  })

  it('refetches on a malformed payload rather than dropping it', () => {
    expect(matchesTracker(null, 'feed')).toBe(true)
    expect(matchesTracker({}, 'feed')).toBe(true)
    expect(matchesTracker({ new: { tracker_id: null } }, 'feed')).toBe(true)
  })
})
