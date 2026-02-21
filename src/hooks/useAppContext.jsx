import { createContext, useContext, useState, useEffect } from 'react'
import { useIdentity, getMemberByAuthUser } from './useFamily'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { STORAGE_KEYS } from '../lib/constants'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user, loading: authLoading, signInWithGoogle, signOut: authSignOut } = useAuth()
  const { identity, saveIdentity, clearIdentity } = useIdentity()
  const [familyData, setFamilyData] = useState(null)
  const [familyLoading, setFamilyLoading] = useState(false)

  // Active child — persisted in localStorage
  const [activeChildId, setActiveChildIdState] = useState(
    () => localStorage.getItem(STORAGE_KEYS.CHILD_ID) ?? null
  )

  function setActiveChildId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.CHILD_ID, id)
    } else {
      localStorage.removeItem(STORAGE_KEYS.CHILD_ID)
    }
    setActiveChildIdState(id)
  }

  // After Google auth, resolve the user's family membership
  useEffect(() => {
    if (!user) {
      setFamilyData(null)
      return
    }

    // Use cached identity for instant load if available
    if (identity.familyId && identity.memberId) {
      setFamilyData({ familyId: identity.familyId, memberId: identity.memberId, memberName: identity.memberName })
      return
    }

    setFamilyLoading(true)
    getMemberByAuthUser(user.id).then(memberRecord => {
      if (memberRecord) {
        const resolved = {
          familyId: memberRecord.family_id,
          memberId: memberRecord.id,
          memberName: memberRecord.display_name,
        }
        saveIdentity(resolved)
        setFamilyData(resolved)
      }
      setFamilyLoading(false)
    })
  }, [user?.id])

  // Auto-select first child if no child cached yet, once familyId is known
  useEffect(() => {
    const fid = familyData?.familyId || identity.familyId
    if (!fid || activeChildId) return
    supabase
      .from('children')
      .select('id')
      .eq('family_id', fid)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.id) setActiveChildId(data.id)
      })
  }, [familyData?.familyId, identity.familyId])

  function onFamilyJoined({ family, member, childId }) {
    const resolved = { familyId: family.id, memberId: member.id, memberName: member.display_name }
    saveIdentity(resolved)
    setFamilyData(resolved)
    if (childId) setActiveChildId(childId)
  }

  async function signOut() {
    clearIdentity()
    setActiveChildId(null)
    setFamilyData(null)
    await authSignOut()
  }

  const combinedIdentity = {
    familyId: familyData?.familyId ?? identity.familyId,
    memberId: familyData?.memberId ?? identity.memberId,
    memberName: familyData?.memberName ?? identity.memberName,
    email: user?.email ?? null,
    googleAvatarUrl: user?.user_metadata?.avatar_url ?? null,
    activeChildId,
  }

  return (
    <AppContext.Provider value={{
      user,
      identity: combinedIdentity,
      isAuthLoading: authLoading || familyLoading,
      isSetupDone: Boolean(user && (familyData?.familyId || identity.familyId)),
      onFamilyJoined,
      signInWithGoogle,
      signOut,
      saveIdentity,
      setActiveChildId,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
