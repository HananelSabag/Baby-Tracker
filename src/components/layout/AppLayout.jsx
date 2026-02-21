import { useApp } from '../../hooks/useAppContext'
import { useToast } from '../../hooks/useToast'
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications'
import { ToastContainer } from '../ui/Toast'
import { BottomNav } from './BottomNav'
import { STORAGE_KEYS } from '../../lib/constants'

function getNotificationsEnabled() {
  const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)
  return stored === null ? true : stored === 'true'
}

export function AppLayout({ children }) {
  const { identity } = useApp()
  const { toasts, showToast, dismissToast } = useToast()
  const notificationsEnabled = getNotificationsEnabled()

  useRealtimeNotifications({
    familyId: identity.familyId,
    memberId: identity.memberId,
    enabled: notificationsEnabled,
    showToast,
  })

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <main className="flex-1 overflow-y-auto pb-[72px]">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
