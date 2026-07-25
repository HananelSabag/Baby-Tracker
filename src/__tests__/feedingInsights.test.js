import { describe, it, expect } from 'vitest'
import { computeFeedingInsights, computeDiaperSplit } from '../lib/feedingInsights'

const NOW = new Date(2026, 6, 15, 12, 0, 0)
const at = (day, hour, min = 0) => ({
  occurred_at: new Date(2026, 6, day, hour, min).toISOString(),
})

// The API returns events newest-first. The old inline version indexed them as
// if they were oldest-first, which is the bug these tests pin down.
const newestFirst = list => [...list].reverse()

describe('computeFeedingInsights — ordering', () => {
  const feeds = [at(15, 6), at(15, 9), at(15, 13), at(15, 17)]

  it('gives the same answer whichever order the events arrive in', () => {
    const asc = computeFeedingInsights(feeds, [], NOW)
    const desc = computeFeedingInsights(newestFirst(feeds), [], NOW)
    expect(desc.longestStretchH).toBe(asc.longestStretchH)
    expect(desc.lastAt?.getTime()).toBe(asc.lastAt?.getTime())
    expect(desc.avgIntervalH).toBe(asc.avgIntervalH)
  })

  it('projects from the most recent feed, not the first of the week', () => {
    // Newest-first input: the naive `list[list.length - 1]` would pick 06:00.
    const r = computeFeedingInsights(newestFirst(feeds), [], NOW)
    expect(r.lastAt.getHours()).toBe(17)
  })

  it('never reports a negative longest stretch', () => {
    // Max over a descending array yields negatives — it used to render as
    // "-0.5 ש׳" on the card.
    const r = computeFeedingInsights(newestFirst(feeds), [], NOW)
    expect(r.longestStretchH).toBeGreaterThan(0)
    expect(r.longestStretchH).toBe(4)  // 09:00 → 13:00 and 13:00 → 17:00
  })
})

describe('computeFeedingInsights — rhythm', () => {
  it('averages the gaps between consecutive feeds', () => {
    const r = computeFeedingInsights([at(15, 0), at(15, 3), at(15, 6)], [], NOW)
    expect(r.avgIntervalH).toBe(3)
    expect(r.sampleSize).toBe(2)
  })

  it('excludes overnight gaps from the average but keeps them in the longest stretch', () => {
    const feeds = [at(14, 20), at(14, 23), at(15, 10), at(15, 13)]
    const r = computeFeedingInsights(feeds, [], NOW)
    expect(r.avgIntervalH).toBe(3)      // the 11h overnight gap is excluded
    expect(r.longestStretchH).toBe(11)  // but it IS the longest stretch
  })

  it('widens the sample with the previous week', () => {
    const prior = [at(8, 6), at(8, 9)]
    const week = [at(15, 6)]
    const r = computeFeedingInsights(week, prior, NOW)
    // One gap from the prior week is not enough on its own.
    expect(r.sampleSize).toBe(1)
    expect(r.avgIntervalH).toBeNull()
  })

  it('needs at least two gaps before claiming an average', () => {
    expect(computeFeedingInsights([at(15, 6), at(15, 9)], [], NOW).avgIntervalH).toBeNull()
  })

  it('predicts the next feed from the last one plus the average', () => {
    const r = computeFeedingInsights([at(15, 3), at(15, 6), at(15, 9)], [], NOW)
    expect(r.avgIntervalH).toBe(3)
    expect(r.predictedNext.getHours()).toBe(12)
    expect(r.minsUntilNext).toBe(0)     // exactly `now`
  })

  it('reports a negative countdown when the feed is overdue', () => {
    const r = computeFeedingInsights([at(15, 0), at(15, 3), at(15, 6)], [], NOW)
    expect(r.predictedNext.getHours()).toBe(9)
    expect(r.minsUntilNext).toBe(-180)
  })

  it('finds the busiest hour', () => {
    const r = computeFeedingInsights([at(14, 6), at(15, 6), at(15, 13)], [], NOW)
    expect(r.peakHour).toBe(6)
  })

  it('handles an empty week', () => {
    const r = computeFeedingInsights([], [], NOW)
    expect(r.count).toBe(0)
    expect(r.avgIntervalH).toBeNull()
    expect(r.longestStretchH).toBeNull()
    expect(r.predictedNext).toBeNull()
    expect(r.peakHour).toBeNull()
  })

  it('handles undefined input without throwing', () => {
    expect(() => computeFeedingInsights(undefined, undefined, NOW)).not.toThrow()
  })
})

describe('computeDiaperSplit', () => {
  const d = type => ({ data: { type } })

  it('counts "both" toward wet and dirty alike', () => {
    const r = computeDiaperSplit([d('wet'), d('dirty'), d('both')])
    expect(r).toEqual({ wet: 2, dirty: 2, total: 3 })
  })

  it('treats an unrecognised type as wet', () => {
    expect(computeDiaperSplit([d('wet'), d(undefined), d('wet')]).wet).toBe(3)
  })

  it('returns null below the minimum sample, where a split is just noise', () => {
    expect(computeDiaperSplit([d('wet'), d('dirty')])).toBeNull()
    expect(computeDiaperSplit([])).toBeNull()
  })
})
