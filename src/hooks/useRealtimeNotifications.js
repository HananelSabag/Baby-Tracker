import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const LAST_CHECK_KEY = 'bt_last_notif_check'
const BATCH_MS = 5000 // collect rapid-fire live events before firing one grouped notification

export function useRealtimeNotifications({ familyId, memberId, enabled, showToast, addNotification }) {
  const trackersMap = useRef({})
  const membersMap  = useRef({})
  const childrenMap = useRef({})
  // Live batching: pending events keyed by "memberId:trackerId"
  const pendingRef  = useRef({})

  function flushBatch(key) {
    const batch = pendingRef.current[key]
    if (!batch) return
    delete pendingRef.current[key]
    const { tracker, member, count, childNames } = batch
    const childPart = childNames.size > 0 ? ` עבור ${[...childNames].join(', ')}` : ''
    const countPart = count > 1 ? ` (${count}×)` : ''
    const notification = {
      emoji: tracker.icon ?? '📌',
      message: `${member.display_name} הוסיף/ה ${tracker.name}${childPart}${countPart}`,
    }
    showToast(notification)
    addNotification?.(notification)
  }

  useEffect(() => {
    if (!familyId || !memberId || !enabled) return

    // ── 1. Startup catch-up: grouped by member+tracker (avoids notification flood) ──
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
      ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

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
        .limit(50),
    ]).then(([tr, mb, ch, ev]) => {
      trackersMap.current = Object.fromEntries((tr.data ?? []).map(t => [t.id, t]))
      membersMap.current  = Object.fromEntries((mb.data ?? []).map(m => [m.id, m]))
      childrenMap.current = Object.fromEntries((ch.data ?? []).map(c => [c.id, c]))

      // Group events by member+tracker — one notification per group
      const groups = {}
      ;(ev.data ?? []).forEach(e => {
        const tracker = trackersMap.current[e.tracker_id]
        const member  = membersMap.current[e.member_id]
        if (!tracker || !member) return
        const key = `${e.member_id}:${e.tracker_id}`
        if (!groups[key]) groups[key] = { tracker, member, count: 0, childNames: new Set() }
        groups[key].count++
        if (e.child_id && childrenMap.current[e.child_id]) {
          groups[key].childNames.add(childrenMap.current[e.child_id].name)
        }
      })

      Object.values(groups).forEach(({ tracker, member, count, childNames }) => {
        const childPart = childNames.size > 0 ? ` עבור ${[...childNames].join(', ')}` : ''
        const countPart = count > 1 ? ` (${count}×)` : ''
        addNotification?.({
          emoji: tracker.icon ?? '📌',
          message: `${member.display_name} הוסיף/ה ${tracker.name}${childPart}${countPart}`,
        })
      })
    })

    // ── 2. Realtime subscription: batched live events ───────────────────────
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

        localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString())

        const tracker = trackersMap.current[event.tracker_id]
        const member  = membersMap.current[event.member_id]
        const child   = event.child_id ? childrenMap.current[event.child_id] : null
        if (!tracker || !member) return

        // Accumulate in batch; flush after BATCH_MS of silence
        const key = `${event.member_id}:${event.tracker_id}`
        if (!pendingRef.current[key]) {
          pendingRef.current[key] = { tracker, member, count: 0, childNames: new Set(), timer: null }
        }
        const batch = pendingRef.current[key]
        batch.count++
        if (child) batch.childNames.add(child.name)
        clearTimeout(batch.timer)
        batch.timer = setTimeout(() => flushBatch(key), BATCH_MS)
      })
      .subscribe()

    return () => {
      // Flush any pending batches on unmount
      Object.values(pendingRef.current).forEach(b => clearTimeout(b.timer))
      pendingRef.current = {}
      supabase.removeChannel(channel)
    }
  }, [familyId, memberId, enabled])
}
