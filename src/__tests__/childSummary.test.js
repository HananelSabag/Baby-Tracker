import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeSummary } from '../hooks/useChildSummary'
import { TRACKER_TYPES } from '../lib/constants'

// Fixed "now": Wed 2026-07-15, 12:00 local.
const NOW = new Date(2026, 6, 15, 12, 0, 0)

const TRACKERS = [
  { id: 'f', tracker_type: TRACKER_TYPES.FEEDING },
  { id: 'd', tracker_type: TRACKER_TYPES.DIAPER },
  { id: 's', tracker_type: TRACKER_TYPES.SLEEP },
  { id: 'g', tracker_type: TRACKER_TYPES.GROWTH },
]

// The hook hands computeSummary events newest-first (Supabase orders desc).
function build(events) {
  return [...events].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
}

const at = (day, hour, min = 0) => new Date(2026, 6, day, hour, min, 0).toISOString()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => { vi.useRealTimers() })

describe('computeSummary — overview', () => {
  it('handles an empty history without throwing', () => {
    const s = computeSummary([], TRACKERS)
    expect(s.overview.totalEvents).toBe(0)
    expect(s.overview.activeDays).toBe(0)
    expect(s.feeding.count).toBe(0)
    expect(s.sleep.hasData).toBe(false)
    expect(s.growth.count).toBe(0)
  })

  it('counts distinct tracked days, not the calendar span', () => {
    // Two events on the same day, one a week earlier => 2 active days, 8 span.
    const s = computeSummary(build([
      { id: 1, tracker_id: 'f', member_id: 'm1', occurred_at: at(15, 9),  data: {} },
      { id: 2, tracker_id: 'f', member_id: 'm1', occurred_at: at(15, 11), data: {} },
      { id: 3, tracker_id: 'f', member_id: 'm2', occurred_at: at(8, 10),  data: {} },
    ]), TRACKERS)
    expect(s.overview.activeDays).toBe(2)
    expect(s.overview.daysSinceFirst).toBe(8)
  })

  it('attributes events to the member who logged them', () => {
    const s = computeSummary(build([
      { id: 1, tracker_id: 'f', member_id: 'm1', occurred_at: at(15, 9), data: {} },
      { id: 2, tracker_id: 'f', member_id: 'm1', occurred_at: at(15, 10), data: {} },
      { id: 3, tracker_id: 'f', member_id: 'm2', occurred_at: at(15, 11), data: {} },
    ]), TRACKERS)
    expect(s.overview.byMember).toEqual({ m1: 2, m2: 1 })
  })

  it('ignores events whose tracker is unknown', () => {
    const s = computeSummary(build([
      { id: 1, tracker_id: 'ghost', member_id: 'm1', occurred_at: at(15, 9), data: {} },
    ]), TRACKERS)
    expect(s.overview.totalEvents).toBe(1)
    expect(s.feeding.count).toBe(0)
    expect(s.diaper.count).toBe(0)
  })
})

describe('computeSummary — feeding', () => {
  const feeds = (...times) => times.map((t, i) => ({
    id: i, tracker_id: 'f', member_id: 'm1', occurred_at: t, data: { amount_ml: 100 },
  }))

  it('takes the median of consecutive gaps as the typical interval', () => {
    // Gaps of 3h, 3h, 4h → median 3h.
    const s = computeSummary(build(feeds(at(15, 0), at(15, 3), at(15, 6), at(15, 10))), TRACKERS)
    expect(s.feeding.typicalGapMs / 3600000).toBe(3)
    expect(s.feeding.sampleSize).toBe(3)
  })

  it('excludes overnight breaks so the estimate stays usable', () => {
    // 3h, then a 13h overnight gap, then 3h. The 13h must not enter the median.
    const s = computeSummary(build(feeds(at(14, 18), at(14, 21), at(15, 10), at(15, 13))), TRACKERS)
    expect(s.feeding.sampleSize).toBe(2)
    expect(s.feeding.typicalGapMs / 3600000).toBe(3)
  })

  it('projects the next feed from the last one plus the typical gap', () => {
    const s = computeSummary(build(feeds(at(15, 2), at(15, 5), at(15, 8))), TRACKERS)
    expect(s.feeding.lastAt.getHours()).toBe(8)
    expect(s.feeding.nextEstimate.getHours()).toBe(11)
  })

  it('gives no estimate from a single feed — one point is not a pattern', () => {
    const s = computeSummary(build(feeds(at(15, 8))), TRACKERS)
    expect(s.feeding.typicalGapMs).toBeNull()
    expect(s.feeding.nextEstimate).toBeNull()
  })

  it('averages ml per feed over events that actually recorded an amount', () => {
    const s = computeSummary(build([
      { id: 1, tracker_id: 'f', member_id: 'm1', occurred_at: at(15, 8), data: { amount_ml: 100 } },
      { id: 2, tracker_id: 'f', member_id: 'm1', occurred_at: at(15, 11), data: { amount_ml: 200 } },
      { id: 3, tracker_id: 'f', member_id: 'm1', occurred_at: at(15, 14), data: {} },
    ]), TRACKERS)
    expect(s.feeding.count).toBe(3)
    expect(s.feeding.totalMl).toBe(300)
    expect(s.feeding.avgMlPerFeed).toBe(150)
  })

  it('divides recent averages by days tracked, not the full window', () => {
    // A family that started today must not have today's 4 feeds spread over 14 days.
    const s = computeSummary(build(feeds(at(15, 6), at(15, 9), at(15, 12), at(15, 15))), TRACKERS)
    expect(s.windowDays).toBe(1)
    expect(s.feeding.recentPerDay).toBe(4)
  })
})

describe('computeSummary — sleep', () => {
  const ev = (id, type, time) => ({
    id, tracker_id: 's', member_id: 'm1', occurred_at: time, data: { type },
  })

  it('pairs start/end into sessions', () => {
    const s = computeSummary(build([
      ev(1, 'start', at(15, 1)), ev(2, 'end', at(15, 3)),
      ev(3, 'start', at(15, 5)), ev(4, 'end', at(15, 6)),
    ]), TRACKERS)
    expect(s.sleep.sessionCount).toBe(2)
    expect(s.sleep.longestMs / 3600000).toBe(2)
  })

  it('treats a repeated start as a re-tap, not a second nap', () => {
    const s = computeSummary(build([
      ev(1, 'start', at(15, 1)),
      ev(2, 'start', at(15, 2)),   // re-tap — replaces the open start
      ev(3, 'end',   at(15, 4)),
    ]), TRACKERS)
    expect(s.sleep.sessionCount).toBe(1)
    expect(s.sleep.longestMs / 3600000).toBe(2)
  })

  it('ignores an end with no open start', () => {
    const s = computeSummary(build([
      ev(1, 'end',   at(15, 2)),   // orphan
      ev(2, 'start', at(15, 4)),
      ev(3, 'end',   at(15, 5)),
    ]), TRACKERS)
    expect(s.sleep.sessionCount).toBe(1)
  })

  it('does not count a still-open nap toward totals', () => {
    const s = computeSummary(build([
      ev(1, 'start', at(15, 1)), ev(2, 'end', at(15, 3)),
      ev(3, 'start', at(15, 10)),  // still sleeping
    ]), TRACKERS)
    expect(s.sleep.sessionCount).toBe(1)
    expect(s.sleep.recentAvgHoursPerDay).toBe(2)
  })
})

describe('computeSummary — diapers', () => {
  const ev = (id, type, time) => ({
    id, tracker_id: 'd', member_id: 'm1', occurred_at: time, data: { type },
  })

  it('counts "both" toward the wet total — it contains urine', () => {
    const s = computeSummary(build([
      ev(1, 'wet',   at(15, 1)),
      ev(2, 'dirty', at(15, 3)),
      ev(3, 'both',  at(15, 5)),
    ]), TRACKERS)
    expect(s.diaper.breakdown).toEqual({ wet: 1, dirty: 1, both: 1 })
    expect(s.diaper.wetPerDay).toBe(2)   // wet + both, over 1 tracked day
    expect(s.diaper.recentPerDay).toBe(3)
  })
})

describe('computeSummary — growth', () => {
  it('orders points oldest-first and reports the latest of each measure', () => {
    const s = computeSummary(build([
      { id: 1, tracker_id: 'g', member_id: 'm1', occurred_at: at(1, 12),  data: { weight_kg: 5, height_cm: 55 } },
      { id: 2, tracker_id: 'g', member_id: 'm1', occurred_at: at(15, 12), data: { weight_kg: 6 } },
    ]), TRACKERS)
    expect(s.growth.count).toBe(2)
    expect(s.growth.points[0].weightKg).toBe(5)
    expect(s.growth.latestWeight.weightKg).toBe(6)
    // Height wasn't re-measured — fall back to the last reading that had one.
    expect(s.growth.latestHeight.heightCm).toBe(55)
  })

  it('drops non-numeric measurements instead of rendering NaN', () => {
    const s = computeSummary(build([
      { id: 1, tracker_id: 'g', member_id: 'm1', occurred_at: at(15, 12), data: { weight_kg: '', height_cm: 'abc' } },
    ]), TRACKERS)
    expect(s.growth.points[0].weightKg).toBeNull()
    expect(s.growth.points[0].heightCm).toBeNull()
    expect(s.growth.latestWeight).toBeNull()
  })
})
