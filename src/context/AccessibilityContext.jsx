import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'bt_a11y'

const defaults = {
  fontSize: 'normal',   // 'small' | 'normal' | 'large'
  highContrast: false,
  reduceMotion: false,
}

const AccessibilityContext = createContext(null)

function applyToDoc(prefs) {
  const html = document.documentElement
  html.setAttribute('data-font-size', prefs.fontSize)
  html.setAttribute('data-high-contrast', String(prefs.highContrast))
  html.setAttribute('data-reduce-motion', String(prefs.reduceMotion))
}

export function AccessibilityProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) : {}
      return { ...defaults, ...parsed }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    applyToDoc(prefs)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs])

  // Apply on initial mount (before any state change triggers)
  useEffect(() => { applyToDoc(prefs) }, []) // eslint-disable-line

  function updatePref(key, value) {
    setPrefs(prev => ({ ...prev, [key]: value }))
  }

  return (
    <AccessibilityContext.Provider value={{ prefs, updatePref }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  return useContext(AccessibilityContext)
}
