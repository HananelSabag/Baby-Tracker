// Turning sleep start/end events into sessions.
//
// This was written three separate times — SleepCard, HeroCard and ReportsPage —
// and two of them disagreed: one paired each 'start' with whatever event came
// next, so two taps of "went to sleep" in a row silently corrupted the totals.
// They were reconciled by hand, but three copies drift again the moment anyone
// touches one. This is the only implementation now.
//
// Rules:
//   • a second 'start' with no 'end' between replaces the open one (a re-tap)
//   • an 'end' with nothing open is an orphan and is ignored
//   • a trailing unmatched 'start' means "asleep right now"

/**
 * @param {Array} events  sleep events in any order
 * @returns {{ sessions: {start: Date, end: Date|null, ms: number|null}[],
 *             openStart: Date|null }}
 */
export function pairSleepEvents(events) {
  const chronological = [...(events ?? [])].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  )

  const sessions = []
  let open = null

  for (const ev of chronological) {
    const type = ev.data?.type
    if (type === 'start') {
      open = ev
    } else if (type === 'end' && open) {
      const start = new Date(open.occurred_at)
      const end = new Date(ev.occurred_at)
      sessions.push({ start, end, ms: end - start })
      open = null
    }
  }

  return { sessions, openStart: open ? new Date(open.occurred_at) : null }
}

/**
 * Totals for a set of sleep events.
 *
 * `now` is only used to measure an in-progress nap, and only when `live` is
 * true. Viewing a past day must not let a nap left open back then "run" until
 * the present and report an absurd total.
 */
export function sleepStats(events, { now = Date.now(), live = true } = {}) {
  const { sessions, openStart } = pairSleepEvents(events)

  const completedMs = sessions.reduce((sum, s) => sum + s.ms, 0)
  const isSleeping = openStart !== null
  const currentMs = (isSleeping && live) ? Math.max(0, now - openStart.getTime()) : 0

  return {
    sessions,
    completed: sessions,
    isSleeping,
    openStart,
    currentMs,
    totalMs: completedMs + currentMs,
    longestMs: sessions.reduce((max, s) => (s.ms > max ? s.ms : max), 0) || null,
  }
}
