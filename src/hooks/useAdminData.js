import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Everything the admin panel reads, in one place.
 *
 * Two things this fixes about the old page:
 *
 *   1. Failures were swallowed — `if (!error && Array.isArray(data))` meant a
 *      500 from the edge function rendered as "no users", with nothing to act
 *      on. Errors are surfaced now.
 *   2. The families list ran one query per family to find its last event. The
 *      edge function returns family aggregates alongside each user, so the whole
 *      families view is derived from that same payload — no N+1, no extra round
 *      trips.
 */
export function useAdminData() {
  const [users, setUsers] = useState([])
  const [orphanFamilies, setOrphanFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, familiesRes] = await Promise.all([
        supabase.functions.invoke('admin-users', { method: 'GET' }),
        // Only to catch families nobody belongs to any more — they would be
        // invisible in a view derived purely from users.
        supabase.from('families').select('id, name, code, created_at'),
      ])

      if (usersRes.error) {
        throw new Error(await describeInvokeError(usersRes.error))
      }
      if (!Array.isArray(usersRes.data)) {
        throw new Error(
          usersRes.data?.message ?? 'התקבלה תשובה לא צפויה מהשרת'
        )
      }

      setUsers(usersRes.data)

      const knownFamilyIds = new Set(
        usersRes.data.map(u => u.member?.family_id).filter(Boolean)
      )
      setOrphanFamilies(
        (familiesRes.data ?? []).filter(f => !knownFamilyIds.has(f.id))
      )
    } catch (e) {
      setError(e?.message ?? 'שגיאה לא ידועה')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteUser(userId) {
    const { data, error: invokeErr } = await supabase.functions.invoke('admin-users', {
      method: 'DELETE',
      body: { userId },
    })
    if (invokeErr) throw new Error(await describeInvokeError(invokeErr))
    if (data?.error) throw new Error(data.message ?? data.error)
    setUsers(prev => prev.filter(u => u.id !== userId))
    return data
  }

  async function deleteFamily(familyId) {
    const { error: delErr } = await supabase.from('families').delete().eq('id', familyId)
    if (delErr) throw delErr
    setOrphanFamilies(prev => prev.filter(f => f.id !== familyId))
    setUsers(prev => prev.filter(u => u.member?.family_id !== familyId))
  }

  // One row per family, folded out of the users payload.
  const families = useMemo(() => {
    const map = new Map()
    for (const u of users) {
      const fam = u.member?.family
      if (!fam?.id) continue
      if (!map.has(fam.id)) {
        map.set(fam.id, {
          id: fam.id,
          name: fam.name,
          code: fam.code,
          created_at: fam.created_at,
          memberCount: u.stats?.family_members ?? 0,
          childCount: u.stats?.family_children ?? 0,
          eventCount: u.stats?.family_events ?? 0,
          lastEvent: u.stats?.family_last_event_at ?? null,
          members: [],
        })
      }
      map.get(fam.id).members.push(u)
    }
    for (const f of orphanFamilies) {
      map.set(f.id, {
        id: f.id, name: f.name, code: f.code, created_at: f.created_at,
        memberCount: 0, childCount: 0, eventCount: 0, lastEvent: null,
        members: [], orphan: true,
      })
    }
    return [...map.values()]
  }, [users, orphanFamilies])

  return { users, families, loading, error, refresh: load, deleteUser, deleteFamily }
}

/**
 * supabase-js wraps a non-2xx edge response in a FunctionsHttpError whose
 * message is just "Edge Function returned a non-2xx status code". The useful
 * part is in the response body, so dig it out.
 */
async function describeInvokeError(err) {
  try {
    const body = await err?.context?.json?.()
    if (body?.message) return body.message
    if (body?.error) return String(body.error)
  } catch { /* body wasn't JSON */ }
  const status = err?.context?.status
  return status ? `${err.message} (HTTP ${status})` : (err?.message ?? 'שגיאה')
}

// ── Derived helpers the panel filters on ─────────────────────────────────────

/** last_seen_at from the app beats last_sign_in, which only moves on re-auth. */
export function bestLastSeen(user) {
  return user.member?.last_seen_at ?? user.last_sign_in ?? null
}

export function daysSince(dateStr) {
  if (!dateStr) return Infinity
  return (Date.now() - new Date(dateStr)) / 86_400_000
}

/**
 * An account that signed up and never did anything: no family, or a family
 * with nothing logged. These are the ones worth clearing out.
 */
export function isDormant(user) {
  if (!user.member) return true
  return (user.stats?.events ?? 0) === 0 && daysSince(bestLastSeen(user)) > 14
}
