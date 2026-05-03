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

    if (childId) query = query.eq('child_id', childId)

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

    // Use date in channel name so resubscribe on date-change always creates
    // a fresh channel (avoids Supabase silent-dedup on same channel name)
    const dateKey = viewDate ? viewDate.toISOString().split('T')[0] : 'today'
    const channel = supabase
      .channel(`home-all:${familyId}:${dateKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` }, fetchAll)
      .subscribe()

    // Refetch when app comes back to foreground (WebSocket may have dropped
    // while phone was locked / app was backgrounded)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') fetchAll()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchAll, familyId])

  return { eventsByTracker, loading }
}
