import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTrackers(familyId) {
  const [trackers, setTrackers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTrackers = useCallback(async () => {
    if (!familyId) return
    const { data } = await supabase
      .from('trackers')
      .select()
      .eq('family_id', familyId)
      .neq('is_deleted', true)
      .order('display_order')
    setTrackers(data ?? [])
    setLoading(false)
  }, [familyId])

  useEffect(() => {
    if (!familyId) return
    fetchTrackers()

    const channel = supabase
      .channel(`trackers:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trackers', filter: `family_id=eq.${familyId}` }, fetchTrackers)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchTrackers, familyId])

  async function addTracker(trackerData) {
    const maxOrder = trackers.length ? Math.max(...trackers.map(t => t.display_order)) : -1
    const { error } = await supabase.from('trackers').insert({
      ...trackerData,
      family_id: familyId,
      display_order: maxOrder + 1,
    })
    if (error) throw error
  }

  async function updateTracker(id, updates) {
    const { error } = await supabase.from('trackers').update(updates).eq('id', id)
    if (error) throw error
  }

  async function deleteTracker(id) {
    const { error } = await supabase.from('trackers').update({ is_deleted: true }).eq('id', id)
    if (error) throw error
  }

  // Optimistic reorder: updates local state immediately so the UI feels instant.
  // `orderedTrackers` is the localOrder array from edit mode (may include `_visible`).
  // DB writes happen in parallel; on failure reverts to DB truth.
  async function reorderTrackers(orderedTrackers) {
    // Build the canonical objects that normal view expects
    const optimistic = orderedTrackers.map((t, i) => ({
      ...t,
      display_order: i,
      is_active: t._visible !== undefined ? t._visible : t.is_active,
    }))
    setTrackers(optimistic)

    const results = await Promise.allSettled(
      orderedTrackers.map((tracker, index) =>
        supabase
          .from('trackers')
          .update({
            display_order: index,
            is_active: tracker._visible !== undefined ? tracker._visible : tracker.is_active,
          })
          .eq('id', tracker.id)
          .then(({ error }) => { if (error) throw error })
      )
    )

    const failures = results.filter(r => r.status === 'rejected').length
    if (failures > 0) {
      await fetchTrackers() // revert to DB truth
      throw new Error(`שמירת ${failures} מעקב${failures > 1 ? 'ים' : ''} נכשלה — נסה שוב`)
    }
  }

  return { trackers, loading, addTracker, updateTracker, deleteTracker, reorderTrackers }
}
