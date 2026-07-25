import { useState, useEffect, useMemo } from 'react'
import { startOfDay, differenceInCalendarDays, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { TRACKER_TYPES } from '../lib/constants'

// How far back the "recent habits" figures look. Long enough to smooth out a
// bad night, short enough that a 4-month-old's numbers aren't dragged down by
// their newborn weeks.
export const RECENT_WINDOW_DAYS = 14

// Consecutive feeds further apart than this are treated as a break in the
// pattern (a long night, a day at grandma's with no logging) and excluded from
// the typical-interval figure. Including them would inflate the median enough
// to make the "next feed" estimate useless.
const MAX_FEED_GAP_HOURS = 10

// Hard cap on rows pulled in one go. A heavy family logs ~15 events/day, so
// this covers roughly a year — past that the lifetime totals become "at least".
const EVENT_LIMIT = 6000

/**
 * Pulls a child's whole event history and derives the summary statistics.
 *
 * Everything returned here is plain arithmetic over the family's own records.
 * Comparisons against published reference ranges happen in the page, next to
 * their citation — see lib/childReference.js.
 */
export function useChildSummary(familyId, childId, trackers) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!familyId || !childId) {
      setEvents([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('events')
      .select('id, tracker_id, member_id, occurred_at, data')
      .eq('family_id', familyId)
      .eq('child_id', childId)
      .order('occurred_at', { ascending: false })
      .limit(EVENT_LIMIT)
      .then(({ data }) => {
        if (cancelled) return
        setEvents(data ?? [])
        setTruncated((data?.length ?? 0) >= EVENT_LIMIT)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [familyId, childId])

  const stats = useMemo(
    () => computeSummary(events, trackers),
    [events, trackers]
  )

  return { ...stats, events, loading, truncated }
}

// ── Derivation ───────────────────────────────────────────────────────────────

// Exported for unit tests: this is the whole statistical surface of the summary
// page, and it is pure — events in, numbers out.
export function computeSummary(events, trackers) {
  const byType = {}
  for (const tr of trackers ?? []) byType[tr.id] = tr.tracker_type

  const of = type => events.filter(e => byType[e.tracker_id] === type)

  const feeding = of(TRACKER_TYPES.FEEDING)
  const diaper  = of(TRACKER_TYPES.DIAPER)
  const sleep   = of(TRACKER_TYPES.SLEEP)
  const growth  = of(TRACKER_TYPES.GROWTH)

  const now = new Date()
  const windowStart = startOfDay(subDays(now, RECENT_WINDOW_DAYS - 1))
  const inWindow = list => list.filter(e => new Date(e.occurred_at) >= windowStart)

  // Days actually covered by the recent window — a family that started using
  // the app three days ago must not have their averages divided by 14.
  const firstEvent = events.length ? events[events.length - 1] : null
  const firstDate = firstEvent ? new Date(firstEvent.occurred_at) : null
  const daysSinceFirst = firstDate ? differenceInCalendarDays(now, firstDate) + 1 : 0
  const windowDays = Math.max(1, Math.min(RECENT_WINDOW_DAYS, daysSinceFirst || RECENT_WINDOW_DAYS))

  // Distinct calendar days with at least one record — "days you tracked",
  // which is a more honest number than the raw span.
  const activeDays = new Set(events.map(e => new Date(e.occurred_at).toDateString())).size

  return {
    overview: {
      totalEvents: events.length,
      firstDate,
      daysSinceFirst,
      activeDays,
      byMember: countBy(events, e => e.member_id),
    },
    feeding: feedingStats(feeding, inWindow(feeding), windowDays),
    diaper:  diaperStats(diaper, inWindow(diaper), windowDays),
    sleep:   sleepStats(sleep, windowDays, windowStart),
    growth:  growthStats(growth),
    windowDays,
  }
}

function countBy(list, keyFn) {
  const out = {}
  for (const item of list) {
    const k = keyFn(item)
    if (k == null) continue
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function median(nums) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function feedingStats(all, recent, windowDays) {
  const ml = all.map(e => Number(e.data?.amount_ml)).filter(n => Number.isFinite(n) && n > 0)
  const recentMl = recent.map(e => Number(e.data?.amount_ml)).filter(n => Number.isFinite(n) && n > 0)

  // Gaps between consecutive feeds, oldest → newest, within the recent window.
  const chronological = [...recent].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  )
  const gapsMs = []
  for (let i = 1; i < chronological.length; i++) {
    const gap = new Date(chronological[i].occurred_at) - new Date(chronological[i - 1].occurred_at)
    if (gap > 0 && gap <= MAX_FEED_GAP_HOURS * 3600000) gapsMs.push(gap)
  }
  const typicalGapMs = median(gapsMs)
  const last = chronological[chronological.length - 1] ?? null

  return {
    count: all.length,
    totalMl: ml.reduce((s, n) => s + n, 0),
    avgMlPerFeed: ml.length ? Math.round(ml.reduce((s, n) => s + n, 0) / ml.length) : null,
    recentPerDay: round1(recent.length / windowDays),
    recentMlPerDay: recentMl.length ? Math.round(recentMl.reduce((s, n) => s + n, 0) / windowDays) : null,
    typicalGapMs,
    lastAt: last ? new Date(last.occurred_at) : null,
    // Purely "your own rhythm, projected forward" — never framed as a need.
    nextEstimate: (last && typicalGapMs)
      ? new Date(new Date(last.occurred_at).getTime() + typicalGapMs)
      : null,
    sampleSize: gapsMs.length,
  }
}

function diaperStats(all, recent, windowDays) {
  const tally = t => recent.filter(e => e.data?.type === t).length
  const wet = tally('wet')
  const dirty = tally('dirty')
  const both = tally('both')
  return {
    count: all.length,
    recentPerDay: round1(recent.length / windowDays),
    // "both" contains urine too — it counts toward the wet-diaper marker.
    wetPerDay: round1((wet + both) / windowDays),
    breakdown: { wet, dirty, both },
  }
}

function sleepStats(all, windowDays, windowStart) {
  // Same pairing rules as SleepCard / HeroCard / ReportsPage: a repeated
  // 'start' replaces the open one, an 'end' with nothing open is an orphan.
  const chronological = [...all].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  )
  const sessions = []
  let open = null
  for (const ev of chronological) {
    const type = ev.data?.type
    if (type === 'start') open = ev
    else if (type === 'end' && open) {
      sessions.push({
        start: new Date(open.occurred_at),
        end: new Date(ev.occurred_at),
        ms: new Date(ev.occurred_at) - new Date(open.occurred_at),
      })
      open = null
    }
  }

  const recent = sessions.filter(s => s.end >= windowStart)
  const recentMs = recent.reduce((sum, s) => sum + s.ms, 0)
  const longest = sessions.reduce((max, s) => (s.ms > max ? s.ms : max), 0)

  // Per-day totals, for the chart.
  const perDay = {}
  for (const s of recent) {
    const key = s.end.toDateString()
    perDay[key] = (perDay[key] ?? 0) + s.ms
  }

  return {
    sessionCount: sessions.length,
    recentAvgHoursPerDay: recent.length ? round1(recentMs / 3600000 / windowDays) : null,
    recentNapsPerDay: recent.length ? round1(recent.length / windowDays) : null,
    longestMs: longest || null,
    perDayMs: perDay,
    hasData: sessions.length > 0,
  }
}

function growthStats(all) {
  // Oldest → newest, so charts read left-to-right in time.
  const points = [...all]
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
    .map(e => ({
      at: new Date(e.occurred_at),
      weightKg: numOrNull(e.data?.weight_kg),
      heightCm: numOrNull(e.data?.height_cm),
      headCm:   numOrNull(e.data?.head_cm),
    }))

  const latestWith = key => [...points].reverse().find(p => p[key] != null) ?? null

  return {
    points,
    count: points.length,
    latestWeight: latestWith('weightKg'),
    latestHeight: latestWith('heightCm'),
    latestHead:   latestWith('headCm'),
  }
}

function numOrNull(v) {
  // Number('') and Number('   ') are 0, not NaN — a blank measurement would
  // otherwise plot as a real 0 kg point on the WHO curve and produce a
  // nonsense percentile. Reject empties before coercing.
  if (v == null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function round1(n) {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null
}
