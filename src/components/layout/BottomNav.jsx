import { NavLink } from 'react-router-dom'
import { t } from '../../lib/strings'
import { useApp } from '../../hooks/useAppContext'
import { ADMIN_EMAIL } from '../../lib/constants'
import { cn } from '../../lib/utils'

export function BottomNav() {
  const { identity } = useApp()
  const isAdmin = identity.email === ADMIN_EMAIL

  const NAV_ITEMS = [
    { to: '/', label: t('nav.home'), icon: '🏠' },
    { to: '/history', label: t('nav.history'), icon: '📋' },
    { to: '/reports', label: t('nav.reports'), icon: '📊' },
    { to: '/settings', label: t('nav.settings'), icon: '⚙️' },
    { to: '/profile', label: t('nav.profile'), icon: '👤' },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-center">
      <div className="w-full max-w-[480px] bg-white border-t border-cream-200 pb-safe">
        <div className="flex items-stretch">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {({ isActive }) => (
                <div className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] w-full relative transition-colors font-rubik',
                  isActive ? 'text-amber-600' : 'text-brown-400'
                )}>
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="text-xs font-medium">{label}</span>
                  {isActive && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
