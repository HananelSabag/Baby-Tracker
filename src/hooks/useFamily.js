import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { STORAGE_KEYS, BUILTIN_TRACKERS } from '../lib/constants'
import { generateFamilyCode } from '../lib/utils'

// Returns current identity from localStorage (cache)
export function useIdentity() {
  const [identity, setIdentity] = useState(() => ({
    familyId: localStorage.getItem(STORAGE_KEYS.FAMILY_ID),
    memberId: localStorage.getItem(STORAGE_KEYS.MEMBER_ID),
    memberName: localStorage.getItem(STORAGE_KEYS.MEMBER_NAME),
  }))

  const saveIdentity = useCallback(({ familyId, memberId, memberName }) => {
    localStorage.setItem(STORAGE_KEYS.FAMILY_ID, familyId)
    localStorage.setItem(STORAGE_KEYS.MEMBER_ID, memberId)
    localStorage.setItem(STORAGE_KEYS.MEMBER_NAME, memberName)
    setIdentity({ familyId, memberId, memberName })
  }, [])

  const clearIdentity = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
    setIdentity({ familyId: null, memberId: null, memberName: null })
  }, [])

  return { identity, saveIdentity, clearIdentity }
}

// Look up existing family_member record for this auth user
export async function getMemberByAuthUser(authUserId) {
  const { data } = await supabase
    .from('family_members')
    .select('*, family:families(*)')
    .eq('auth_user_id', authUserId)
    .single()
  return data ?? null
}

// Create a new family + seed built-in trackers + register member
export async function createFamily({ familyName, role, customRole, authUserId, avatarUrl }) {
  const code = generateFamilyCode()
  const displayName = role === 'אחר' ? (customRole || 'אחר') : role

  // Debug: verify session is active before any DB call
  const { data: { session } } = await supabase.auth.getSession()
  console.log('[createFamily] session check — access_token exists:', !!session?.access_token, 'user:', session?.user?.id ?? 'NONE')
  if (!session?.access_token) {
    // Try to refresh the session first
    const { data: refreshed } = await supabase.auth.refreshSession()
    console.log('[createFamily] refreshed session:', !!refreshed?.session?.access_token)
    if (!refreshed?.session?.access_token) throw new Error('no-session: user not authenticated')
  }

  console.log('[createFamily] step 1 — insert family, code:', code, 'name:', familyName, 'authUserId:', authUserId)
  const { data: family, error: familyErr } = await supabase
    .from('families')
    .insert({ code, name: familyName || 'המשפחה שלנו' })
    .select()
    .single()
  if (familyErr) {
    console.error('[createFamily] families insert failed:', familyErr)
    throw new Error(`families: ${familyErr.message} (${familyErr.code})`)
  }
  console.log('[createFamily] step 1 OK — family.id:', family.id)

  // Register member first so RLS (get_my_family_id) resolves before seeding trackers
  console.log('[createFamily] step 2 — insert member, role:', displayName)
  const { data: member, error: memberErr } = await supabase
    .from('family_members')
    .insert({
      family_id: family.id,
      display_name: displayName,
      role: displayName,
      auth_user_id: authUserId,
      avatar_url: avatarUrl ?? null,
    })
    .select()
    .single()
  if (memberErr) {
    console.error('[createFamily] family_members insert failed:', memberErr)
    throw new Error(`members: ${memberErr.message} (${memberErr.code})`)
  }
  console.log('[createFamily] step 2 OK — member.id:', member.id)

  // Seed built-in trackers for this family
  console.log('[createFamily] step 3 — seed trackers')
  const { error: trackersErr } = await supabase.from('trackers').insert(
    BUILTIN_TRACKERS.map(t => ({ ...t, family_id: family.id }))
  )
  if (trackersErr) console.warn('[createFamily] trackers seed failed (non-fatal):', trackersErr)
  else console.log('[createFamily] step 3 OK')

  return { family, member }
}

// Look up a family by invite code — bypasses RLS via SECURITY DEFINER function.
// Returns { family_id, family_name, family_code, taken_roles } or null.
export async function lookupFamilyByCode(code) {
  const { data, error } = await supabase
    .rpc('lookup_family_for_join', { p_code: code.toUpperCase() })
  if (error) throw error
  if (!data || data.length === 0) return null
  return data[0]
}

// Join an existing family by code — familyId already resolved via lookupFamilyByCode
export async function joinFamily({ familyId, familyCode, role, customRole, authUserId, avatarUrl }) {
  const displayName = role === 'אחר' ? (customRole || 'אחר') : role

  const { data: member, error: memberErr } = await supabase
    .from('family_members')
    .insert({
      family_id: familyId,
      display_name: displayName,
      role: displayName,
      auth_user_id: authUserId,
      avatar_url: avatarUrl ?? null,
    })
    .select()
    .single()
  if (memberErr) {
    if (memberErr.message?.includes('family_full')) throw new Error('family_full')
    if (memberErr.code === '23505') throw new Error('role_taken')
    throw memberErr
  }

  return { family: { id: familyId, code: familyCode }, member }
}

// Update member profile (role display_name, avatar_url)
export async function updateMember(memberId, updates) {
  const { error } = await supabase
    .from('family_members')
    .update(updates)
    .eq('id', memberId)
  if (error) throw error
}

// Remove a member from the family (parents only, enforced by RLS)
export async function removeMember(memberId) {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId)
  if (error) throw error
}

// Update family record (name, etc.)
export async function updateFamily(familyId, updates) {
  const { error } = await supabase
    .from('families')
    .update(updates)
    .eq('id', familyId)
  if (error) throw error
}

// Fetch all members for a family with realtime sync
export function useFamilyMembers(familyId) {
  const [members, setMembers] = useState([])

  const fetch = useCallback(async () => {
    if (!familyId) return
    const { data } = await supabase
      .from('family_members')
      .select()
      .eq('family_id', familyId)
      .order('created_at')
    setMembers(data ?? [])
  }, [familyId])

  useEffect(() => {
    fetch()
    const channel = supabase
      .channel(`members:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${familyId}` }, fetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetch, familyId])

  return members
}
