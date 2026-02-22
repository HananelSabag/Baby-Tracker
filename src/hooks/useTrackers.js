import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTrackers(familyId) {
  const [trackers, setTrackers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchTrackers()

    // Real-time subscription
    const channel = supabase
      .channel(`trackers:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trackers', filter: `family_id=eq.${familyId}` }, fetchTrackers)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [familyId])

  async function fetchTrackers() {
    const { data } = await supabase
      .from('trackers')
      .select()
      .eq('family_id', familyId)
      .neq('is_deleted', true)
      .order('display_order')
    setTrackers(data ?? [])
    setLoading(false)
  }

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

  return { trackers, loading, addTracker, updateTracker, deleteTracker }
}
