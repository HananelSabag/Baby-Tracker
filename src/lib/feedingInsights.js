// Weekly feeding + diaper insights for the reports page.
//
// Extracted from ReportsPage because it was computed inline over `events` — and
// `events` arrives newest-first from the API. The inline version indexed that
// array as if it were oldest-first, which produced:
//
//   • "longest stretch" from negative intervals (max of a list of negatives)
//   • "last feeding" = the OLDEST feeding of the week, so the predicted next
//     feed landed days in the past and the prediction card silently never
//     rendered (it hides itself when the estimate is more than 2h stale)
//
// Every function here sorts explicitly and takes `now` as an argument, so the
// ordering assumption is stated once and the whole thing is testable.

// Gaps longer than this are treated as an overnight break rather than part of
// the feeding rhythm — including them would inflate the average enough to make
// the "next feed" estimate useless.
const MAX_RHYTHM_GAP_H = 8

/** Oldest → newest. */
function chronological(events) {
  return [...(events ?? [])].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  )
}

function gapsHours(sorted) {
  const out = []
  for (let i = 1; i < sorted.length; i++) {
    out.push((new Date(sorted[i].occurred_at) - new Date(sorted[i - 1].occurred_at)) / 3600000)
  }
  return out
}

/**
 * @param {Array}  weekEvents  feeding events for the displayed week (any order)
 * @param {Array}  priorEvents feeding events from the previous week, to widen
 *                             the sample used for the average interval
 * @param {Date}   now
 */
export function computeFeedingInsights(weekEvents, priorEvents = [], now = new Date()) {
  const week = chronological(weekEvents)
  const combined = chronological([...(priorEvents ?? []), ...(weekEvents ?? [])])

  // Average rhythm, measured across both weeks and excluding overnight gaps.
  const rhythmGaps = gapsHours(combined).filter(h => h > 0 && h < MAX_RHYTHM_GAP_H)
  const avgIntervalH = rhythmGaps.length >= 2
    ? rhythmGaps.reduce((a, b) => a + b, 0) / rhythmGaps.length
    : null

  // Longest gap this week, overnight included — that IS the interesting number.
  const weekGaps = gapsHours(week)
  const longestStretchH = weekGaps.length > 0 ? Math.max(...weekGaps) : null

  // Which hour of the day sees the most feeds.
  const hourBuckets = {}
  for (const e of week) {
    const h = new Date(e.occurred_at).getHours()
    hourBuckets[h] = (hourBuckets[h] ?? 0) + 1
  }
  const peakHour = Object.keys(hourBuckets).length
    ? Number(Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0][0])
    : null

  // Project from the MOST RECENT feed, not the first one of the week.
  const lastFeed = week[week.length - 1] ?? null
  const lastAt = lastFeed ? new Date(lastFeed.occurred_at) : null
  const predictedNext = (lastAt && avgIntervalH)
    ? new Date(lastAt.getTime() + avgIntervalH * 3600000)
    : null
  const minsUntilNext = predictedNext
    ? Math.round((predictedNext.getTime() - now.getTime()) / 60000)
    : null

  return {
    avgIntervalH,
    longestStretchH,
    peakHour,
    lastAt,
    predictedNext,
    minsUntilNext,
    count: week.length,
    sampleSize: rhythmGaps.length,
  }
}

/**
 * Wet / dirty split. "both" counts toward each side because it contains each.
 * Returns null below a minimum sample, where a split would be noise.
 */
export function computeDiaperSplit(events, minSample = 3) {
  let wet = 0, dirty = 0, both = 0
  for (const e of (events ?? [])) {
    const type = e.data?.type
    if (type === 'dirty') dirty++
    else if (type === 'both') both++
    else wet++   // 'wet' and anything unrecognised
  }
  const total = (events ?? []).length
  if (total < minSample) return null
  return { wet: wet + both, dirty: dirty + both, total }
}
