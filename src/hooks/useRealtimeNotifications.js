import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtimeNotifications({ familyId, memberId, enabled, showToast, addNotification }) {
  // Keep maps up-to-date without re-subscribing
  const trackersMap = useRef({})
  const membersMap = useRef({})
  const childrenMap = useRef({})

  // Fetch lookup maps once and refresh when familyId changes
  useEffect(() => {
    if (!familyId) return
    supabase.from('trackers').select('id,name,icon').eq('family_id', familyId)
      .then(({ data }) => {
        trackersMap.current = Object.fromEntries((data ?? []).map(t => [t.id, t]))
      })
    supabase.from('family_members').select('id,display_name').eq('family_id', familyId)
      .then(({ data }) => {
        membersMap.current = Object.fromEntries((data ?? []).map(m => [m.id, m]))
      })
    supabase.from('children').select('id,name').eq('family_id', familyId)
      .then(({ data }) => {
        childrenMap.current = Object.fromEntries((data ?? []).map(c => [c.id, c]))
      })
  }, [familyId])

  useEffect(() => {
    if (!familyId || !enabled) return

    const channel = supabase
      .channel(`notifications:${familyId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'events',
        filter: `family_id=eq.${familyId}`,
      }, (payload) => {
        const event = payload.new
        // Skip own events
        if (event.member_id === memberId) return

        const tracker = trackersMap.current[event.tracker_id]
        const member = membersMap.current[event.member_id]
        const child = event.child_id ? childrenMap.current[event.child_id] : null

        if (!tracker || !member) return

        const childPart = child ? ` עבור ${child.name}` : ''
        const notification = {
          emoji: tracker.icon ?? '📌',
          message: `${member.display_name} הוסיף/ה ${tracker.name}${childPart}`,
        }
        showToast(notification)
        addNotification?.(notification)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [familyId, memberId, enabled])
}
