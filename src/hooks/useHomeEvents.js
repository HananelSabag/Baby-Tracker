import { useMemo, useCallback } from 'react'
import api, { keys } from '../lib/api'
import { useRealtimeQuery } from './useRealtimeQuery'

/**
 * All of one day's events for the home page, grouped by tracker.
 *
 * Shares the exact same cache entry as every `useEvents({ date })` on screen,
 * so the hero card and the tracker cards below it are served by a single
 * request rather than one each.
 */
export function useHomeEvents(familyId, viewDate, childId) {
  const dateIso = viewDate?.toISOString() ?? null

  const { cacheKey, fetcher } = useMemo(() => {
    if (!familyId) return { cacheKey: null, fetcher: async () => [] }
    const day = dateIso ? new Date(dateIso) : new Date()
    return {
      cacheKey: keys.eventsDay(familyId, childId, day),
      fetcher: () => api.events.listDay(familyId, childId, day),
    }
  }, [familyId, childId, dateIso])

  const { data, loading } = useRealtimeQuery({
    familyId,
    table: 'events',
    cacheKey,
    fetcher,
    initialData: EMPTY,
  })

  const eventsByTracker = useMemo(() => {
    const grouped = {}
    for (const ev of (data ?? EMPTY)) {
      ;(grouped[ev.tracker_id] ??= []).push(ev)
    }
    return grouped
  }, [data])

  return { eventsByTracker, loading }
}

const EMPTY = []
