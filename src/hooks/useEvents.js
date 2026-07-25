import { useMemo, useCallback } from 'react'
import { startOfDay, endOfDay, subDays } from 'date-fns'
import api, { keys } from '../lib/api'
import { useRealtimeQuery } from './useRealtimeQuery'

/**
 * A realtime-tracking slice of the family's events.
 *
 * The public shape is unchanged — every existing call site keeps working. What
 * changed is underneath:
 *
 *   • Day queries go through one shared, cached request per (family, child,
 *     day). Six tracker cards on the home page used to issue six overlapping
 *     queries for the same rows; now they share one and filter in memory.
 *   • Realtime arrives on one family-wide channel instead of one per hook.
 *   • A tracker-scoped hook ignores rows belonging to other trackers, so
 *     logging a feed no longer refetches the diaper and sleep cards.
 */
export function useEvents(familyId, { trackerId, days, date, childId, startDate, endDate } = {}) {
  // Stable primitives — Date objects are new on every render and would
  // otherwise rebuild the query (and its subscription) continuously.
  const dateIso  = date?.toISOString() ?? null
  const startIso = startDate?.toISOString() ?? null
  const endIso   = endDate?.toISOString() ?? null

  const mode =
    startIso && endIso ? 'range' :
    dateIso            ? 'day'   :
    days               ? 'days'  :
                         'all'

  const { cacheKey, fetcher } = useMemo(() => {
    if (!familyId) return { cacheKey: null, fetcher: async () => [] }

    if (mode === 'range') {
      const start = new Date(startIso)
      const end = new Date(endIso)
      return {
        cacheKey: keys.eventsRange(familyId, childId, start, end, trackerId),
        fetcher: () => api.events.listRange(familyId, childId, { start, end, trackerId }),
      }
    }

    if (mode === 'day') {
      const day = new Date(dateIso)
      // Shared across every card showing this day — the tracker filter is
      // applied to the cached result rather than to a separate request.
      return {
        cacheKey: keys.eventsDay(familyId, childId, day),
        fetcher: () => api.events.listDay(familyId, childId, day),
      }
    }

    if (mode === 'days') {
      const start = startOfDay(subDays(new Date(), days))
      const end = endOfDay(new Date())
      return {
        cacheKey: keys.eventsRange(familyId, childId, start, end, trackerId),
        fetcher: () => api.events.listRange(familyId, childId, { start, end, trackerId }),
      }
    }

    // No window: the tracker's whole history (growth measurements).
    //
    // The bounds are deliberately fixed sentinels rather than "now". Anchoring
    // the end to endOfDay(new Date()) would freeze the window at mount, so a
    // session left open past midnight would stop showing anything added after —
    // the same midnight trap that HistoryPage had.
    return {
      cacheKey: keys.eventsRange(familyId, childId, EPOCH, FAR_FUTURE, trackerId),
      fetcher: () => api.events.listRange(familyId, childId, { start: EPOCH, end: FAR_FUTURE, trackerId }),
    }
  }, [familyId, childId, trackerId, mode, dateIso, startIso, endIso, days])

  const shouldRefetch = useCallback(
    payload => matchesTracker(payload, trackerId),
    [trackerId]
  )

  const { data, loading, refetch } = useRealtimeQuery({
    familyId,
    table: 'events',
    cacheKey,
    fetcher,
    shouldRefetch,
    initialData: EMPTY,
  })

  // Day mode fetches the whole day; narrow to this tracker here.
  const events = useMemo(() => {
    const rows = data ?? EMPTY
    if (mode === 'day' && trackerId) return rows.filter(e => e.tracker_id === trackerId)
    return rows
  }, [data, mode, trackerId])

  const addEvent = useCallback(async ({ trackerId: tid, memberId, childId: cid, data: payload, notes, occurredAt }) => {
    await api.events.create(familyId, {
      trackerId: tid, memberId, childId: cid, data: payload, notes, occurredAt,
    })
    await refetch()
  }, [familyId, refetch])

  const updateEvent = useCallback(async (id, updates) => {
    await api.events.update(familyId, id, updates)
    await refetch()
  }, [familyId, refetch])

  const deleteEvent = useCallback(async (id) => {
    await api.events.remove(familyId, id)
    await refetch()
  }, [familyId, refetch])

  const bulkDeleteEvents = useCallback(async (ids) => {
    await api.events.removeMany(familyId, ids)
    await refetch()
  }, [familyId, refetch])

  return { events, loading, addEvent, updateEvent, deleteEvent, bulkDeleteEvents, refetch }
}

const EMPTY = []
const EPOCH = new Date(0)
const FAR_FUTURE = new Date('2100-01-01T00:00:00.000Z')

/**
 * Should a tracker-scoped hook react to this realtime row?
 *
 * Postgres only ships the primary key in `old` for DELETEs unless the table is
 * set to REPLICA IDENTITY FULL, so a delete tells us nothing about which
 * tracker the row belonged to. When in doubt we refetch — dropping a real
 * update is a visible bug, an extra refetch is not.
 */
export function matchesTracker(payload, trackerId) {
  if (!trackerId) return true
  const next = payload?.new
  if (!next || next.tracker_id === undefined || next.tracker_id === null) return true
  return next.tracker_id === trackerId
}
