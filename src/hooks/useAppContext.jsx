import { createContext, useContext, useState, useEffect } from 'react'
import { useIdentity, getMemberByAuthUser } from './useFamily'
import { useAuth } from './useAuth'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user, loading: authLoading, signInWithGoogle, signOut: authSignOut } = useAuth()
  const { identity, saveIdentity, clearIdentity } = useIdentity()
  const [familyData, setFamilyData] = useState(null)
  const [familyLoading, setFamilyLoading] = useState(false)

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

  function onFamilyJoined({ family, member }) {
    const resolved = { familyId: family.id, memberId: member.id, memberName: member.display_name }
    saveIdentity(resolved)
    setFamilyData(resolved)
  }

  async function signOut() {
    clearIdentity()
    setFamilyData(null)
    await authSignOut()
  }

  const combinedIdentity = {
    familyId: familyData?.familyId ?? identity.familyId,
    memberId: familyData?.memberId ?? identity.memberId,
    memberName: familyData?.memberName ?? identity.memberName,
    email: user?.email ?? null,
    googleAvatarUrl: user?.user_metadata?.avatar_url ?? null,
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
