import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { useAccessibility } from '../../context/AccessibilityContext'
import { cn } from '../../lib/utils'

const FONT_SIZES = [
  { value: 'small',  label: 'קטן',  size: 'text-sm'  },
  { value: 'normal', label: 'רגיל', size: 'text-base' },
  { value: 'large',  label: 'גדול', size: 'text-xl'   },
]

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="relative w-12 h-6 rounded-full flex-shrink-0 transition-colors duration-200"
      style={{ backgroundColor: on ? '#22C55E' : '#D6C4B0' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(26px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

export function AccessibilityFAB() {
  const [open, setOpen] = useState(false)
  const { prefs, updatePref } = useAccessibility()

  return (
    <>
      {/* Floating tab — glued to right edge, vertically centered */}
      <button
        onClick={() => setOpen(true)}
        aria-label="פתח תפריט נגישות"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-brown-600 text-white rounded-l-2xl shadow-fab flex flex-col items-center justify-center gap-1 px-1.5 py-3 active:bg-brown-700 transition-colors select-none"
      >
        <span className="text-base leading-none">♿</span>
      </button>

      {/* Accessibility bottom sheet */}
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="♿ נגישות">
        <div className="space-y-5 pb-2" dir="rtl">

          {/* Font size */}
          <div>
            <p className="font-rubik text-xs font-medium text-brown-400 mb-2.5">גודל טקסט</p>
            <div className="flex gap-2">
              {FONT_SIZES.map(({ value, label, size }) => {
                const active = prefs.fontSize === value
                return (
                  <button
                    key={value}
                    onClick={() => updatePref('fontSize', value)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-2 py-3.5 rounded-2xl border-2 transition-all active:scale-95',
                      active ? 'border-amber-500 bg-amber-50' : 'border-cream-200 bg-cream-50'
                    )}
                  >
                    <span className={cn('font-rubik font-bold text-brown-700', size)}>א</span>
                    <span className={cn('font-rubik text-xs font-medium', active ? 'text-amber-600' : 'text-brown-400')}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* High contrast */}
          <div className="flex items-center justify-between py-3 border-t border-cream-200">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🎨</span>
              <div>
                <p className="font-rubik font-semibold text-brown-800 text-sm">ניגודיות גבוהה</p>
                <p className="font-rubik text-brown-400 text-xs mt-0.5">מגדיל ניגוד לקריאה קלה</p>
              </div>
            </div>
            <Toggle on={prefs.highContrast} onChange={v => updatePref('highContrast', v)} />
          </div>

          {/* Reduce motion */}
          <div className="flex items-center justify-between py-3 border-t border-cream-200">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🎬</span>
              <div>
                <p className="font-rubik font-semibold text-brown-800 text-sm">הפחת תנועה</p>
                <p className="font-rubik text-brown-400 text-xs mt-0.5">מבטל אנימציות ומעברים</p>
              </div>
            </div>
            <Toggle on={prefs.reduceMotion} onChange={v => updatePref('reduceMotion', v)} />
          </div>

          <p className="text-center font-rubik text-brown-300 text-xs pb-1">
            נשמר במכשיר זה בלבד
          </p>
        </div>
      </BottomSheet>
    </>
  )
}
