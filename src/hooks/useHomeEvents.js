import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'

export function useHomeEvents(familyId, viewDate, childId) {
  const [eventsByTracker, setEventsByTracker] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!familyId) return
    let query = supabase
      .from('events')
      .select('*')
      .eq('family_id', familyId)
      .gte('occurred_at', startOfDay(viewDate).toISOString())
      .lte('occurred_at', endOfDay(viewDate).toISOString())
      .order('occurred_at', { ascending: false })

    if (childId) query = query.or(`child_id.eq.${childId},child_id.is.null`)

    const { data } = await query
    const grouped = {}
    for (const ev of (data ?? [])) {
      if (!grouped[ev.tracker_id]) grouped[ev.tracker_id] = []
      grouped[ev.tracker_id].push(ev)
    }
    setEventsByTracker(grouped)
    setLoading(false)
  }, [familyId, viewDate?.toISOString(), childId])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel(`home-all:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchAll, familyId])

  return { eventsByTracker, loading }
}
