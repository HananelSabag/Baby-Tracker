import { useEffect, useState } from 'react'
import { useApp } from '../../hooks/useAppContext'
import { useToast } from '../../hooks/useToast'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'
import { ToastContainer } from '../ui/Toast'
import { LovePopup } from '../ui/LovePopup'
import { SisterPopup } from '../ui/SisterPopup'
import { UpgradePopup } from '../ui/UpgradePopup'
import { BottomNav } from './BottomNav'
import { InstallBanner } from '../ui/InstallBanner'
import { STORAGE_KEYS, PREFS_CHANGED_EVENT } from '../../lib/constants'

// Personal easter eggs, keyed by email. These used to be literals in source —
// which put two private addresses in a public repo for search engines to index.
// Set VITE_LOVE_EMAIL / VITE_SISTER_EMAIL in the environment; unset simply
// means the popup never shows.
const WIFE_EMAIL = import.meta.env.VITE_LOVE_EMAIL ?? ''
const SISTER_EMAIL = import.meta.env.VITE_SISTER_EMAIL ?? ''

function getNotificationsEnabled() {
  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)
  return stored === null ? true : stored === 'true'
}

export function AppLayout({ children }) {
  const { identity, addNotification } = useApp()
  const { toasts, showToast, dismissToast } = useToast()

  // Read once into state, then re-read on focus/visibility. Reading localStorage
  // straight during render meant toggling notifications elsewhere in the app
  // had no effect until a full reload.
  const [notificationsEnabled, setNotificationsEnabled] = useState(getNotificationsEnabled)
  useEffect(() => {
    const sync = () => setNotificationsEnabled(getNotificationsEnabled())
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('storage', sync)
    window.addEventListener(PREFS_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener(PREFS_CHANGED_EVENT, sync)
    }
  }, [])

  // Welcome toast — shown once per session on first app load
  useEffect(() => {
    if (!identity.memberName) return
    if (!sessionStorage.getItem('bt_welcome')) {
      showToast({ message: `שלום, ${identity.memberName}! 👋`, emoji: '🏠' })
      sessionStorage.setItem('bt_welcome', '1')
    }
  }, [])

  useRealtimeNotifications({
    familyId: identity.familyId,
    memberId: identity.memberId,
    enabled: notificationsEnabled,
    showToast,
    addNotification,
  })

  // Guard on the configured value too — with the env var unset, an empty
  // identity.email must not match an empty constant and fire for everyone.
  const isWife   = Boolean(WIFE_EMAIL)   && identity.email === WIFE_EMAIL
  const isSister = Boolean(SISTER_EMAIL) && identity.email === SISTER_EMAIL

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <UpgradePopup />
        {isWife && (
          <LovePopup
            avatarUrl={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
            name={identity.memberName}
          />
        )}
        {isSister && (
          <SisterPopup
            avatarUrl={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
            name={identity.memberName}
          />
        )}
        <InstallBanner />
        <main className="pb-24">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
