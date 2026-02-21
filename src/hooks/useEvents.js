import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export function useEvents(familyId, { trackerId, days, date, childId } = {}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    if (!familyId) return
    let query = supabase
      .from('events')
      .select('*, tracker:trackers(*), member:family_members(*), child:children(*)')
      .eq('family_id', familyId)
      .order('occurred_at', { ascending: false })

    if (trackerId) query = query.eq('tracker_id', trackerId)
    if (date) {
      // Filter by specific calendar day
      query = query
        .gte('occurred_at', startOfDay(date).toISOString())
        .lte('occurred_at', endOfDay(date).toISOString())
    } else if (days) {
      query = query.gte('occurred_at', subDays(new Date(), days).toISOString())
    }
    // Show events for this child OR legacy events with no child_id
    if (childId) query = query.or(`child_id.eq.${childId},child_id.is.null`)

    const { data } = await query
    setEvents(data ?? [])
    setLoading(false)
  }, [familyId, trackerId, date?.toISOString(), days, childId])

  useEffect(() => {
    fetchEvents()

    const channel = supabase
      .channel(`events:${familyId}:${trackerId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` }, fetchEvents)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchEvents, familyId, trackerId])

  async function addEvent({ trackerId: tid, memberId, childId: cid, data, notes, occurredAt }) {
    const { error } = await supabase.from('events').insert({
      family_id: familyId,
      tracker_id: tid,
      member_id: memberId,
      child_id: cid ?? null,
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

// Today's events only (with child filter)
export function useTodayEvents(familyId, trackerId, childId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!familyId || !trackerId) return
    let query = supabase
      .from('events')
      .select('*, member:family_members(*)')
      .eq('family_id', familyId)
      .eq('tracker_id', trackerId)
      .gte('occurred_at', startOfDay(new Date()).toISOString())
      .lte('occurred_at', endOfDay(new Date()).toISOString())
      .order('occurred_at', { ascending: false })

    if (childId) query = query.or(`child_id.eq.${childId},child_id.is.null`)

    const { data } = await query
    setEvents(data ?? [])
    setLoading(false)
  }, [familyId, trackerId, childId])

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
