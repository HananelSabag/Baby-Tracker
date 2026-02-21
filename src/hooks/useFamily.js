import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { STORAGE_KEYS, BUILTIN_TRACKERS } from '../lib/constants'
import { generateFamilyCode, generateDeviceToken } from '../lib/utils'

// Returns current identity from localStorage
export function useIdentity() {
  const [identity, setIdentity] = useState(() => ({
    familyId: localStorage.getItem(STORAGE_KEYS.FAMILY_ID),
    memberId: localStorage.getItem(STORAGE_KEYS.MEMBER_ID),
    memberName: localStorage.getItem(STORAGE_KEYS.MEMBER_NAME),
    deviceToken: localStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN),
  }))

  const saveIdentity = useCallback(({ familyId, memberId, memberName, deviceToken }) => {
    localStorage.setItem(STORAGE_KEYS.FAMILY_ID, familyId)
    localStorage.setItem(STORAGE_KEYS.MEMBER_ID, memberId)
    localStorage.setItem(STORAGE_KEYS.MEMBER_NAME, memberName)
    localStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, deviceToken)
    setIdentity({ familyId, memberId, memberName, deviceToken })
  }, [])

  return { identity, saveIdentity }
}

// Create a new family + seed built-in trackers + register member
export async function createFamily(memberName) {
  const code = generateFamilyCode()
  const deviceToken = generateDeviceToken()

  const { data: family, error: familyErr } = await supabase
    .from('families')
    .insert({ code })
    .select()
    .single()

  if (familyErr) throw familyErr

  // Seed built-in trackers for this family
  await supabase.from('trackers').insert(
    BUILTIN_TRACKERS.map(t => ({ ...t, family_id: family.id }))
  )

  const { data: member, error: memberErr } = await supabase
    .from('family_members')
    .insert({ family_id: family.id, display_name: memberName, device_token: deviceToken })
    .select()
    .single()

  if (memberErr) throw memberErr

  return { family, member, deviceToken }
}

// Join an existing family by code + register member
export async function joinFamily(code, memberName) {
  const deviceToken = generateDeviceToken()

  const { data: family, error: familyErr } = await supabase
    .from('families')
    .select()
    .eq('code', code.toUpperCase())
    .single()

  if (familyErr || !family) throw new Error('family_not_found')

  const { data: member, error: memberErr } = await supabase
    .from('family_members')
    .insert({ family_id: family.id, display_name: memberName, device_token: deviceToken })
    .select()
    .single()

  if (memberErr) throw memberErr

  return { family, member, deviceToken }
}

// Fetch all members for the current family
export function useFamilyMembers(familyId) {
  const [members, setMembers] = useState([])

  useEffect(() => {
    if (!familyId) return
    supabase
      .from('family_members')
      .select()
      .eq('family_id', familyId)
      .then(({ data }) => setMembers(data ?? []))
  }, [familyId])

  return members
}
