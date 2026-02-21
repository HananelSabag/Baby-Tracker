import { createContext, useContext, useState } from 'react'
import { useIdentity } from './useFamily'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { identity, saveIdentity } = useIdentity()
  const [activeSheet, setActiveSheet] = useState(null) // { type, trackerId, ... }

  const isSetupDone = Boolean(identity.familyId && identity.memberId)

  function openSheet(config) { setActiveSheet(config) }
  function closeSheet() { setActiveSheet(null) }

  return (
    <AppContext.Provider value={{ identity, saveIdentity, isSetupDone, activeSheet, openSheet, closeSheet }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
