import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export function useEvents(familyId, { trackerId, days } = {}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    if (!familyId) return
    let query = supabase
      .from('events')
      .select('*, tracker:trackers(*), member:family_members(*)')
      .eq('family_id', familyId)
      .order('occurred_at', { ascending: false })

    if (trackerId) query = query.eq('tracker_id', trackerId)
    if (days) query = query.gte('occurred_at', subDays(new Date(), days).toISOString())

    const { data } = await query
    setEvents(data ?? [])
    setLoading(false)
  }, [familyId, trackerId, days])

  useEffect(() => {
    fetchEvents()

    const channel = supabase
      .channel(`events:${familyId}:${trackerId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` }, fetchEvents)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchEvents, familyId, trackerId])

  async function addEvent({ trackerId: tid, memberId, data, notes, occurredAt }) {
    const { error } = await supabase.from('events').insert({
      family_id: familyId,
      tracker_id: tid,
      member_id: memberId,
      data: data ?? {},
      notes: notes ?? null,
      occurred_at: occurredAt ?? new Date().toISOString(),
    })
    if (error) throw error
  }

  async function updateEvent(id, updates) {
    const { error } = await supabase.from('events').update(updates).eq('id', id)
    if (error) throw error
  }

  async function deleteEvent(id) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw error
  }

  return { events, loading, addEvent, updateEvent, deleteEvent, refetch: fetchEvents }
}

// Today's events only
export function useTodayEvents(familyId, trackerId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!familyId || !trackerId) return
    const { data } = await supabase
      .from('events')
      .select('*, member:family_members(*)')
      .eq('family_id', familyId)
      .eq('tracker_id', trackerId)
      .gte('occurred_at', startOfDay(new Date()).toISOString())
      .lte('occurred_at', endOfDay(new Date()).toISOString())
      .order('occurred_at', { ascending: false })
    setEvents(data ?? [])
    setLoading(false)
  }, [familyId, trackerId])

  useEffect(() => {
    fetch()
    const channel = supabase
      .channel(`today:${familyId}:${trackerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` }, fetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetch, familyId, trackerId])

  return { events, loading, refetch: fetch }
}
