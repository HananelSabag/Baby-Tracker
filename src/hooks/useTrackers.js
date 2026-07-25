import { useCallback, useMemo } from 'react'
import api, { keys } from '../lib/api'
import { useRealtimeQuery } from './useRealtimeQuery'

export function useTrackers(familyId) {
  const cacheKey = familyId ? keys.trackers(familyId) : null
  const fetcher = useCallback(() => api.trackers.list(familyId), [familyId])

  const { data, loading, refetch, setData } = useRealtimeQuery({
    familyId,
    table: 'trackers',
    cacheKey,
    fetcher,
    initialData: EMPTY,
  })

  const trackers = data ?? EMPTY

  const addTracker = useCallback(async (trackerData) => {
    const maxOrder = trackers.length ? Math.max(...trackers.map(t => t.display_order)) : -1
    await api.trackers.create(familyId, trackerData, maxOrder + 1)
    await refetch()
  }, [familyId, trackers, refetch])

  const updateTracker = useCallback(async (id, updates) => {
    await api.trackers.update(familyId, id, updates)
    await refetch()
  }, [familyId, refetch])

  const deleteTracker = useCallback(async (id) => {
    await api.trackers.softDelete(familyId, id)
    await refetch()
  }, [familyId, refetch])

  /**
   * Optimistic reorder: the new order paints immediately, then persists.
   * On failure we pull server truth back and rethrow so the caller can toast.
   */
  const reorderTrackers = useCallback(async (orderedTrackers) => {
    setData(orderedTrackers.map((t, i) => ({
      ...t,
      display_order: i,
      is_active: t._visible !== undefined ? t._visible : t.is_active,
    })))
    try {
      await api.trackers.reorder(familyId, orderedTrackers)
    } catch (err) {
      await refetch()
      throw err
    }
  }, [familyId, refetch, setData])

  return useMemo(
    () => ({ trackers, loading, addTracker, updateTracker, deleteTracker, reorderTrackers }),
    [trackers, loading, addTracker, updateTracker, deleteTracker, reorderTrackers]
  )
}

const EMPTY = []
