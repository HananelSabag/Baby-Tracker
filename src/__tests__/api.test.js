import { describe, it, expect, beforeEach, vi } from 'vitest'
import { query, invalidate, invalidateAll, keys, __cache } from '../lib/api'

beforeEach(() => { invalidateAll() })

describe('query — request deduplication', () => {
  it('collapses concurrent identical requests into one call', async () => {
    // This is the whole point: six tracker cards mounting in the same tick used
    // to fire six identical queries for the same day.
    const fetcher = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 10))
      return ['row']
    })

    const results = await Promise.all([
      query('k', fetcher), query('k', fetcher), query('k', fetcher),
      query('k', fetcher), query('k', fetcher), query('k', fetcher),
    ])

    expect(fetcher).toHaveBeenCalledTimes(1)
    results.forEach(r => expect(r).toEqual(['row']))
  })

  it('gives every concurrent caller the same value', async () => {
    const fetcher = vi.fn(async () => ({ n: 1 }))
    const [a, b] = await Promise.all([query('k', fetcher), query('k', fetcher)])
    expect(a).toBe(b)
  })

  it('keeps different keys independent', async () => {
    const fetcher = vi.fn(async () => [])
    await Promise.all([query('a', fetcher), query('b', fetcher)])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not cache a rejection — the next call retries', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(['ok'])

    await expect(query('k', fetcher)).rejects.toThrow('network')
    await expect(query('k', fetcher)).resolves.toEqual(['ok'])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('query — caching', () => {
  it('serves a fresh cached value without calling the fetcher again', async () => {
    const fetcher = vi.fn(async () => ['v'])
    await query('k', fetcher)
    await query('k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refetches once the ttl has expired', async () => {
    const fetcher = vi.fn(async () => ['v'])
    await query('k', fetcher, { ttl: 1 })
    await new Promise(r => setTimeout(r, 5))
    await query('k', fetcher, { ttl: 1 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('force bypasses a fresh cache entry', async () => {
    const fetcher = vi.fn(async () => ['v'])
    await query('k', fetcher)
    await query('k', fetcher, { force: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('clears the in-flight entry after settling, so the map cannot leak', async () => {
    const fetcher = vi.fn(async () => ['v'])
    await query('k', fetcher)
    expect(__cache.inflight.size).toBe(0)
  })
})

describe('invalidate', () => {
  it('drops entries by prefix and leaves the rest alone', async () => {
    const f = vi.fn(async () => ['v'])
    await query('events:fam1:day:x', f)
    await query('events:fam1:range:y', f)
    await query('trackers:fam1', f)
    expect(f).toHaveBeenCalledTimes(3)

    invalidate('events:fam1:')

    await query('events:fam1:day:x', f)   // refetch
    await query('trackers:fam1', f)       // still cached
    expect(f).toHaveBeenCalledTimes(4)
  })

  it('an event write invalidates every events key for that family only', async () => {
    const f = vi.fn(async () => ['v'])
    await query(keys.eventsDay('fam1', 'c1', new Date(2026, 6, 15)), f)
    await query(keys.eventsDay('fam2', 'c9', new Date(2026, 6, 15)), f)
    expect(f).toHaveBeenCalledTimes(2)

    invalidate(keys.eventsAll('fam1'))

    await query(keys.eventsDay('fam1', 'c1', new Date(2026, 6, 15)), f)  // refetch
    await query(keys.eventsDay('fam2', 'c9', new Date(2026, 6, 15)), f)  // cached
    expect(f).toHaveBeenCalledTimes(3)
  })
})

describe('cache keys', () => {
  it('keys a day by local calendar date, not UTC', () => {
    // A 01:00 local feed belongs to that local day even when UTC says otherwise.
    const early = new Date(2026, 6, 15, 1, 0)
    const late  = new Date(2026, 6, 15, 23, 30)
    expect(keys.eventsDay('f', 'c', early)).toBe(keys.eventsDay('f', 'c', late))
  })

  it('separates days, children and families', () => {
    const d = new Date(2026, 6, 15)
    const other = new Date(2026, 6, 16)
    expect(keys.eventsDay('f', 'c', d)).not.toBe(keys.eventsDay('f', 'c', other))
    expect(keys.eventsDay('f', 'c1', d)).not.toBe(keys.eventsDay('f', 'c2', d))
    expect(keys.eventsDay('f1', 'c', d)).not.toBe(keys.eventsDay('f2', 'c', d))
  })

  it('treats "no child" as its own scope rather than colliding with a child', () => {
    const d = new Date(2026, 6, 15)
    expect(keys.eventsDay('f', null, d)).not.toBe(keys.eventsDay('f', 'c1', d))
  })
})
