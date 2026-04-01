import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { t } from '../../lib/strings'
import { useApp } from '../../hooks/useAppContext'
import { cn } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'

// RTL order: Home (right) → History → [FAB] → Reports → Profile (left)
const RIGHT_TABS = [
  { to: '/', label: t('nav.home'), icon: '🏠', end: true },
  { to: '/history', label: t('nav.history'), icon: '📋' },
]

const LEFT_TABS = [
  { to: '/reports', label: t('nav.reports'), icon: '📊' },
  { to: '/profile', label: t('nav.profile'), icon: '👤' },
]

function NavTab({ to, label, icon, end }) {
  return (
    <NavLink to={to} end={end} className="flex-1">
      {({ isActive }) => (
        <div className={cn(
          'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] w-full relative transition-colors font-rubik',
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
  )
}

const MENU_ITEMS = [
  {
    key: 'add',
    path: '/trackers?action=add',
    icon: '➕',
    label: 'הוסף מעקב',
    bg: '#6B9E8C18',
    iconBg: '#6B9E8C25',
  },
  {
    key: 'trackers',
    path: '/trackers',
    icon: '⚙️',
    label: 'ניהול מעקבים',
    bg: '#7BA7E818',
    iconBg: '#7BA7E825',
  },
  {
    key: 'notifications',
    path: '/notifications',
    icon: '🔔',
    label: 'התראות',
    bg: '#E8B84B18',
    iconBg: '#E8B84B25',
  },
  {
    key: 'family',
    path: '/family',
    icon: '👨‍👩‍👧',
    label: 'פרופיל משפחה',
    bg: '#9B8EC418',
    iconBg: '#9B8EC425',
  },
]

export function BottomNav() {
  const { signOut } = useApp()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  function closeSheet() {
    setSheetOpen(false)
    setConfirmSignOut(false)
  }

  function handleMenuNav(path) {
    closeSheet()
    navigate(path)
  }

  async function handleSignOut() {
    closeSheet()
    await signOut()
  }

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-center">
        <div className="w-full max-w-[480px] bg-white border-t border-cream-200 pb-safe">
          <div className="flex items-stretch">
            {RIGHT_TABS.map(({ to, label, icon, end }) => (
              <NavTab key={to} to={to} label={label} icon={icon} end={end} />
            ))}

            {/* Center FAB slot */}
            <div className="flex-1 flex items-center justify-center relative min-h-[56px]">
              <button
                onClick={() => setSheetOpen(true)}
                className="absolute -top-5 w-14 h-14 rounded-full bg-[#8B5E3C] shadow-lg flex items-center justify-center transition-transform active:scale-95 focus:outline-none"
                aria-label="תפריט"
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="5" width="18" height="2.2" rx="1.1" fill="white"/>
                  <rect x="2" y="9.9" width="18" height="2.2" rx="1.1" fill="white"/>
                  <rect x="2" y="14.8" width="18" height="2.2" rx="1.1" fill="white"/>
                </svg>
              </button>
            </div>

            {LEFT_TABS.map(({ to, label, icon }) => (
              <NavTab key={to} to={to} label={label} icon={icon} />
            ))}
          </div>
        </div>
      </nav>

      <BottomSheet isOpen={sheetOpen} onClose={closeSheet} title="תפריט">
        <div className="flex flex-col gap-3 pb-2">
          {/* Main action cards — 2-column grid, last item spans if odd */}
          <div className="grid grid-cols-2 gap-2">
            {MENU_ITEMS.map((item, i) => {
              const isLastOdd = MENU_ITEMS.length % 2 !== 0 && i === MENU_ITEMS.length - 1
              return (
                <button
                  key={item.key}
                  onClick={() => handleMenuNav(item.path)}
                  className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-all active:scale-[0.97] ${isLastOdd ? 'col-span-2 flex-row gap-3 py-3.5' : ''}`}
                  style={{ backgroundColor: item.bg }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: item.iconBg }}
                  >
                    {item.icon}
                  </div>
                  <span className="font-rubik text-brown-800 font-medium text-sm text-center leading-tight">{item.label}</span>
                </button>
              )
            })}
          </div>

          {/* Separator */}
          <div className="border-t border-cream-200 mt-1" />

          {/* Sign out */}
          {confirmSignOut ? (
            <div className="flex flex-col gap-2">
              <p className="font-rubik text-brown-600 text-sm text-center">האם אתה בטוח שברצונך להתנתק?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleSignOut}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-rubik font-semibold active:bg-red-600 transition-colors"
                >
                  כן, התנתק
                </button>
                <button
                  onClick={() => setConfirmSignOut(false)}
                  className="flex-1 py-3 rounded-2xl bg-cream-200 text-brown-700 font-rubik font-medium active:bg-cream-300 transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmSignOut(true)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl active:bg-red-50 transition-colors"
            >
              <span className="text-lg">🚪</span>
              <span className="font-rubik text-red-500 font-medium text-sm">התנתקות</span>
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  )
}
