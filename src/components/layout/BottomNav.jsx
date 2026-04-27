import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { t } from '../../lib/strings'
import { cn } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { useAccessibility } from '../../context/AccessibilityContext'

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
    key: 'trackers',
    path: '/trackers',
    icon: '📋',
    label: 'מעקבים',
    sub: 'הוסף וערוך',
    bg: '#6B9E8C18',
    iconBg: '#6B9E8C25',
  },
  {
    key: 'notifications',
    path: '/notifications',
    icon: '🔔',
    label: 'התראות',
    sub: 'Push ותזכורות',
    bg: '#E8B84B18',
    iconBg: '#E8B84B25',
  },
  {
    key: 'family',
    path: '/family',
    icon: '👨‍👩‍👧',
    label: 'משפחה',
    sub: 'ילדים וחברים',
    bg: '#9B8EC418',
    iconBg: '#9B8EC425',
  },
]

const HELP_SLIDES = [
  {
    title: 'שימוש יומי',
    items: [
      {
        icon: '🏠',
        label: 'מסך הבית',
        bullets: [
          'לחצו + ליד כל מעקב לדיווח מהיר',
          'לחצו ✏️ בפינה לשינוי סדר והסתרת מעקבים',
          'ניווט בין תאריכים עם החצים בראש המסך',
        ],
      },
      {
        icon: '📋',
        label: 'היסטוריה',
        bullets: [
          'הקישו על כרטיסיה לעריכה או מחיקה',
          'סננו לפי סוג מעקב בשורת הפילטרים',
          'לחצו על התאריך לקפיצה לתאריך ספציפי',
        ],
      },
      {
        icon: '🔔',
        label: 'התראות',
        bullets: [
          'הפעילו Push כדי לקבל תזכורות',
          'הגדירו תזכורות מינון לפי תרופה ומרווח',
          'התראות חיתול — אחרי כמה שעות להזכיר',
        ],
      },
    ],
  },
  {
    title: 'תכונות נוספות',
    items: [
      {
        icon: '☰',
        label: 'תפריט ראשי',
        bullets: [
          'הוסיפו מעקב מותאם אישית — שנה שינה, תרופה, חיתול ועוד',
          'נהלו חברי משפחה ושתפו קוד הצטרפות',
          'כל בני המשפחה רואים עדכונים בזמן אמת',
        ],
      },
      {
        icon: '📊',
        label: 'דוחות',
        bullets: [
          'גרפים שבועיים עם השוואה לשבוע הקודם',
          'טרנד של 8 שבועות לכל מעקב',
          'מעקב גדילה: עקומות WHO עם אחוזונים לפי גיל ומין',
        ],
      },
      {
        icon: '💡',
        label: 'טיפים',
        bullets: [
          'הגדירו תאריך לידה בפרופיל המשפחה לאחוזוני WHO',
          'ניתן לדווח על תאריכים שעברו בהיסטוריה',
          'לחצו על גרף גדילה לפירוט מלא עם עקומות',
        ],
      },
    ],
  },
]

export function BottomNav() {
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [a11yOpen, setA11yOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpStep, setHelpStep] = useState(0)
  const { prefs, updatePref } = useAccessibility()

  function closeSheet() {
    setSheetOpen(false)
    setA11yOpen(false)
  }

  function openHelp() {
    closeSheet()
    setHelpStep(0)
    // Delay slightly so the FAB sheet's history.back() cleanup fires and
    // settles before the help sheet pushes its own history entry.
    setTimeout(() => setHelpOpen(true), 80)
  }

  function handleMenuNav(path) {
    closeSheet()
    navigate(path)
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
                  className={`flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all active:scale-[0.97] text-right ${isLastOdd ? 'col-span-2' : 'flex-col items-center text-center px-2 py-4 gap-2'}`}
                  style={{ backgroundColor: item.bg }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: item.iconBg }}
                  >
                    {item.icon}
                  </div>
                  <div className={isLastOdd ? 'flex-1 min-w-0' : ''}>
                    <p className="font-rubik text-brown-800 font-semibold text-sm leading-tight">{item.label}</p>
                    {item.sub && <p className="font-rubik text-brown-400 text-xs leading-tight mt-0.5">{item.sub}</p>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Separator */}
          <div className="border-t border-cream-200 mt-1" />

          {/* Accessibility */}
          {!a11yOpen ? (
            <button
              onClick={() => setA11yOpen(true)}
              className="flex items-center justify-between w-full px-1 py-2.5 rounded-2xl active:bg-cream-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">♿</span>
                <span className="font-rubik text-brown-600 font-medium text-sm">נגישות</span>
              </div>
              <span className="text-brown-300 text-sm">›</span>
            </button>
          ) : (
            <div className="space-y-3 pb-1">
              <div className="flex items-center justify-between">
                <button onClick={() => setA11yOpen(false)} className="flex items-center gap-1.5 text-brown-400 active:opacity-70">
                  <span className="text-sm">‹</span>
                  <span className="font-rubik text-xs">חזרה</span>
                </button>
                <span className="font-rubik text-brown-600 font-semibold text-sm">♿ נגישות</span>
              </div>

              {/* Font size */}
              <div className="flex gap-2">
                {[{ v: 'small', l: 'קטן', s: 'text-sm' }, { v: 'normal', l: 'רגיל', s: 'text-base' }, { v: 'large', l: 'גדול', s: 'text-xl' }].map(({ v, l, s }) => (
                  <button
                    key={v}
                    onClick={() => updatePref('fontSize', v)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition-all active:scale-95',
                      prefs.fontSize === v ? 'border-amber-500 bg-amber-50' : 'border-cream-200 bg-cream-50'
                    )}
                  >
                    <span className={cn('font-rubik font-bold text-brown-700', s)}>א</span>
                    <span className={cn('font-rubik text-[11px] font-medium', prefs.fontSize === v ? 'text-amber-600' : 'text-brown-400')}>{l}</span>
                  </button>
                ))}
              </div>

              {/* Toggles row */}
              <div className="flex gap-2">
                <button
                  onClick={() => updatePref('highContrast', !prefs.highContrast)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 transition-all active:scale-95',
                    prefs.highContrast ? 'border-amber-500 bg-amber-50' : 'border-cream-200 bg-cream-50'
                  )}
                >
                  <span className="text-base">🎨</span>
                  <span className={cn('font-rubik text-xs font-medium', prefs.highContrast ? 'text-amber-600' : 'text-brown-400')}>ניגודיות</span>
                </button>
                <button
                  onClick={() => updatePref('reduceMotion', !prefs.reduceMotion)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 transition-all active:scale-95',
                    prefs.reduceMotion ? 'border-amber-500 bg-amber-50' : 'border-cream-200 bg-cream-50'
                  )}
                >
                  <span className="text-base">🎬</span>
                  <span className={cn('font-rubik text-xs font-medium', prefs.reduceMotion ? 'text-amber-600' : 'text-brown-400')}>תנועה</span>
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-cream-200" />

          {/* Accessibility + Help — compact row pair */}
          <button
            onClick={openHelp}
            className="flex items-center justify-between w-full px-1 py-2.5 rounded-2xl active:bg-cream-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">❓</span>
              <span className="font-rubik text-brown-600 font-medium text-sm">עזרה</span>
            </div>
            <span className="text-brown-300 text-sm">›</span>
          </button>
        </div>
      </BottomSheet>

      {/* Help sheet */}
      <BottomSheet isOpen={helpOpen} onClose={() => setHelpOpen(false)} title="מדריך קצר">
        <div className="space-y-4 pb-2">
          {/* Slide content */}
          <div className="space-y-2.5">
            {HELP_SLIDES[helpStep].items.map(item => (
              <div key={item.label} className="flex gap-3 bg-cream-100 rounded-2xl px-4 py-3">
                <span className="text-xl mt-0.5 flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-rubik font-semibold text-brown-800 text-sm mb-1">{item.label}</p>
                  <ul className="space-y-0.5">
                    {item.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400 text-[10px] mt-[3px] flex-shrink-0">●</span>
                        <span className="font-rubik text-brown-500 text-xs leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {HELP_SLIDES.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === helpStep ? 20 : 6,
                  height: 6,
                  backgroundColor: i === helpStep ? '#8B5E3C' : '#D6C4B0',
                }}
              />
            ))}
          </div>

          {/* Action button */}
          {helpStep < HELP_SLIDES.length - 1 ? (
            <button
              onClick={() => setHelpStep(s => s + 1)}
              className="w-full py-3 rounded-2xl bg-brown-800 text-white font-rubik font-semibold text-sm active:opacity-90 transition-opacity"
            >
              הבא ›
            </button>
          ) : (
            <button
              onClick={() => setHelpOpen(false)}
              className="w-full py-3 rounded-2xl bg-brown-800 text-white font-rubik font-semibold text-sm active:opacity-90 transition-opacity"
            >
              הבנתי ✓
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  )
}
