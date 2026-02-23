import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const LAST_CHECK_KEY = 'bt_last_notif_check'

export function useRealtimeNotifications({ familyId, memberId, enabled, showToast, addNotification }) {
  // Lookup maps shared between startup-fetch and realtime handler
  const trackersMap = useRef({})
  const membersMap = useRef({})
  const childrenMap = useRef({})

  useEffect(() => {
    if (!familyId || !memberId || !enabled) return

    // ── 1. Startup catch-up: show events created since last visit ──────────
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
      ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // default: 24 h ago

    // Stamp NOW before fetching so any realtime events arriving during the
    // fetch are covered by the subscription (no gap, no double-notify).
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())

    Promise.all([
      supabase.from('trackers').select('id,name,icon').eq('family_id', familyId),
      supabase.from('family_members').select('id,display_name').eq('family_id', familyId),
      supabase.from('children').select('id,name').eq('family_id', familyId),
      supabase
        .from('events')
        .select('id,tracker_id,member_id,child_id')
        .eq('family_id', familyId)
        .neq('member_id', memberId)
        .gt('created_at', lastCheck)
        .order('created_at', { ascending: true })
        .limit(20),
    ]).then(([tr, mb, ch, ev]) => {
      // Populate maps (also used by the realtime handler below)
      trackersMap.current = Object.fromEntries((tr.data ?? []).map(t => [t.id, t]))
      membersMap.current  = Object.fromEntries((mb.data ?? []).map(m => [m.id, m]))
      childrenMap.current = Object.fromEntries((ch.data ?? []).map(c => [c.id, c]))

      // Build catch-up notifications (oldest first → correct bell ordering)
      ;(ev.data ?? []).forEach(e => {
        const tracker = trackersMap.current[e.tracker_id]
        const member  = membersMap.current[e.member_id]
        const child   = e.child_id ? childrenMap.current[e.child_id] : null
        if (!tracker || !member) return
        const childPart = child ? ` עבור ${child.name}` : ''
        addNotification?.({
          emoji: tracker.icon ?? '📌',
          message: `${member.display_name} הוסיף/ה ${tracker.name}${childPart}`,
        })
      })
    })

    // ── 2. Realtime subscription: live events while app is open ────────────
    const channel = supabase
      .channel(`notifications:${familyId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'events',
        filter: `family_id=eq.${familyId}`,
      }, (payload) => {
        const event = payload.new
        if (event.member_id === memberId) return

        // Keep last-check current so the next startup doesn't re-show this
        localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())

        const tracker = trackersMap.current[event.tracker_id]
        const member  = membersMap.current[event.member_id]
        const child   = event.child_id ? childrenMap.current[event.child_id] : null
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
