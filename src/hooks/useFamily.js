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

  const { data: family, error: familyErr } = await supabase
    .from('families')
    .insert({ code, name: familyName || 'המשפחה שלנו' })
    .select()
    .single()
  if (familyErr) throw familyErr

  // Seed built-in trackers for this family
  await supabase.from('trackers').insert(
    BUILTIN_TRACKERS.map(t => ({ ...t, family_id: family.id }))
  )

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
  if (memberErr) throw memberErr

  return { family, member }
}

// Join an existing family by code
export async function joinFamily({ code, role, customRole, authUserId, avatarUrl }) {
  const displayName = role === 'אחר' ? (customRole || 'אחר') : role

  const { data: family, error: familyErr } = await supabase
    .from('families')
    .select()
    .eq('code', code.toUpperCase())
    .single()
  if (familyErr || !family) throw new Error('family_not_found')

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
  if (memberErr) throw memberErr

  return { family, member }
}

// Update member profile (role display_name, avatar_url)
export async function updateMember(memberId, updates) {
  const { error } = await supabase
    .from('family_members')
    .update(updates)
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
