import { useEffect } from 'react'
import { useApp } from '../../hooks/useAppContext'
import { useToast } from '../../hooks/useToast'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'
import { ToastContainer } from '../ui/Toast'
import { LovePopup } from '../ui/LovePopup'
import { BottomNav } from './BottomNav'
import { STORAGE_KEYS } from '../../lib/constants'
import { t } from '../../lib/strings'

const WIFE_EMAIL = 'nofarromi1998@gmail.com'

function getNotificationsEnabled() {
  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)
  return stored === null ? true : stored === 'true'
}

export function AppLayout({ children }) {
  const { identity, addNotification } = useApp()
  const { toasts, showToast, dismissToast } = useToast()
  const notificationsEnabled = getNotificationsEnabled()

  // Welcome toast — shown once per session on first app load
  useEffect(() => {
    if (!identity.memberName) return
    if (!sessionStorage.getItem('bt_welcome')) {
      showToast({ message: t('app.welcome', { name: identity.memberName }), emoji: '🏠' })
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

  const isWife = identity.email === WIFE_EMAIL

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {isWife && (
          <LovePopup
            avatarUrl={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
            name={identity.memberName}
          />
        )}
        <main className="flex-1 overflow-y-auto pb-[72px]">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
