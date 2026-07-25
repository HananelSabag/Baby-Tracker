import { supabase } from './supabase'

// One realtime channel per family, shared by every hook in the app.
//
// Before this, each hook opened its own channel — useTrackers, useChildren,
// useHomeEvents, useRealtimeNotifications, plus one per tracker card. A home
// page with five trackers held ~9 channels, every one of them subscribed to
// `event: '*'` filtered only on family_id. So a single dose tap delivered nine
// WebSocket messages and triggered nine full refetches.
//
// Now: one channel, N in-process listeners. Ref-counted — the channel is
// created on the first subscriber and torn down after the last one leaves.

const TABLES = ['events', 'trackers', 'children', 'family_members']

// familyId -> { channel, refCount, listeners: Map<table, Set<fn>> }
const channels = new Map()

function ensureChannel(familyId) {
  let entry = channels.get(familyId)
  if (entry) {
    entry.refCount += 1
    return entry
  }

  const listeners = new Map(TABLES.map(t => [t, new Set()]))
  const channel = supabase.channel(`family:${familyId}`)

  for (const table of TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` },
      payload => {
        // A listener that throws must not stop the others from running.
        for (const fn of listeners.get(table)) {
          try { fn(payload) } catch { /* isolated */ }
        }
      }
    )
  }

  channel.subscribe()
  entry = { channel, refCount: 1, listeners }
  channels.set(familyId, entry)
  return entry
}

function releaseChannel(familyId) {
  const entry = channels.get(familyId)
  if (!entry) return
  entry.refCount -= 1
  if (entry.refCount > 0) return
  channels.delete(familyId)
  supabase.removeChannel(entry.channel)
}

/**
 * Listen for changes to one table within a family.
 * Returns an unsubscribe function; call it on unmount.
 */
export function subscribeToTable(familyId, table, handler) {
  if (!familyId || !TABLES.includes(table)) return () => {}

  const entry = ensureChannel(familyId)
  entry.listeners.get(table).add(handler)

  let released = false
  return () => {
    if (released) return   // guard against double-unsubscribe in StrictMode
    released = true
    const current = channels.get(familyId)
    current?.listeners.get(table)?.delete(handler)
    releaseChannel(familyId)
  }
}

// Test/debug helper — how many channels are actually open right now.
export function openChannelCount() {
  return channels.size
}

// Test helper: drop everything (no-op in the app itself).
export function __resetRealtime() {
  for (const [familyId, entry] of channels) {
    supabase.removeChannel(entry.channel)
    channels.delete(familyId)
  }
}
