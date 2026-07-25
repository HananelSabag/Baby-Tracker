import { useState, useEffect, useRef, useCallback } from 'react'
import { invalidate } from '../lib/api'
import { subscribeToTable } from '../lib/realtime'

// Realtime changes arrive one row at a time. Adding three feeds in quick
// succession used to mean three full refetches; this collapses a burst into a
// single one once the socket goes quiet.
const COALESCE_MS = 180

/**
 * Bind a cached api query to realtime invalidation.
 *
 * Every hook in the app is a thin wrapper around this: fetch through the shared
 * request layer (deduped + cached), listen on the shared family channel, and
 * refetch at most once per burst.
 */
export function useRealtimeQuery({
  familyId,
  table,
  cacheKey,
  fetcher,
  enabled = true,
  initialData = null,
  // Optional gate on the realtime payload. Returning false skips the refetch
  // entirely — a feeding row landing shouldn't wake the diaper or sleep card.
  // Default is "always refetch", i.e. exactly the old behaviour.
  shouldRefetch,
}) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(Boolean(enabled && familyId))
  const [error, setError] = useState(null)

  // Held in refs so changing the fetcher identity every render (callers pass
  // inline arrows) doesn't tear down and rebuild the subscription.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const shouldRefetchRef = useRef(shouldRefetch)
  shouldRefetchRef.current = shouldRefetch

  const mountedRef = useRef(true)
  const timerRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const run = useCallback(async ({ force = false } = {}) => {
    if (!enabled || !familyId) {
      setData(initialData)
      setLoading(false)
      return
    }
    try {
      if (force && cacheKey) invalidate(cacheKey)
      const result = await fetcherRef.current()
      if (!mountedRef.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
    // initialData is intentionally excluded — callers pass array literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, familyId, cacheKey])

  useEffect(() => { run() }, [run])

  // Realtime + foreground recovery
  useEffect(() => {
    if (!enabled || !familyId) return

    function scheduleRefetch(payload) {
      // A predicate that throws must not silently swallow the update — fall
      // back to refetching, which is the safe direction.
      let relevant = true
      if (shouldRefetchRef.current) {
        try { relevant = shouldRefetchRef.current(payload) !== false } catch { relevant = true }
      }
      if (!relevant) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => run({ force: true }), COALESCE_MS)
    }

    const unsubscribe = subscribeToTable(familyId, table, scheduleRefetch)

    // The socket can die while the phone is locked; re-sync on return.
    function onVisible() {
      if (document.visibilityState === 'visible') run({ force: true })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, familyId, table, run])

  const refetch = useCallback(() => run({ force: true }), [run])

  // setData is the escape hatch for optimistic writes (drag-to-reorder). The
  // next realtime tick or refetch overwrites it with server truth.
  return { data, loading, error, refetch, setData }
}
