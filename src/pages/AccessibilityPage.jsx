import { useNavigate } from 'react-router-dom'
import { goBack } from '../lib/utils'
import { useAccessibility } from '../context/AccessibilityContext'
import { cn } from '../lib/utils'

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
      style={{ backgroundColor: on ? '#22C55E' : '#D6C4B0' }}
      role="switch"
      aria-checked={on}
    >
      <span
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(26px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

const FONT_SIZES = [
  { value: 'small',  label: 'קטן',  sample: 'א' },
  { value: 'normal', label: 'רגיל', sample: 'א' },
  { value: 'large',  label: 'גדול', sample: 'א' },
]

export function AccessibilityPage() {
  const navigate = useNavigate()
  const { prefs, updatePref } = useAccessibility()

  return (
    <div className="px-4 pt-6 pb-8 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => goBack(navigate, '/profile')}
          className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-brown-600 text-lg active:scale-95 transition-transform flex-shrink-0"
        >
          ›
        </button>
        <div>
          <h1 className="font-rubik font-bold text-brown-800 text-lg leading-tight">נגישות</h1>
          <p className="font-rubik text-brown-400 text-xs">כל ההגדרות נשמרות במכשיר</p>
        </div>
      </div>

      {/* Font size */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔤</span>
            <div>
              <p className="font-rubik font-semibold text-brown-800 text-sm">גודל טקסט</p>
              <p className="font-rubik text-brown-400 text-xs">בחר את גודל הגופן המועדף</p>
            </div>
          </div>
          <div className="flex gap-2">
            {FONT_SIZES.map(({ value, label, sample }) => {
              const active = prefs.fontSize === value
              const sampleSize = value === 'small' ? 'text-sm' : value === 'large' ? 'text-2xl' : 'text-lg'
              return (
                <button
                  key={value}
                  onClick={() => updatePref('fontSize', value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all active:scale-95',
                    active
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-cream-200 bg-cream-50'
                  )}
                >
                  <span
                    className={cn('font-rubik font-bold text-brown-700', sampleSize)}
                    aria-hidden="true"
                  >
                    {sample}
                  </span>
                  <span
                    className={cn(
                      'font-rubik text-xs font-medium',
                      active ? 'text-amber-600' : 'text-brown-400'
                    )}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
          {/* Live preview */}
          <div className="mt-3 px-3 py-2 bg-cream-50 rounded-xl border border-cream-200">
            <p className="font-rubik text-brown-600 text-center leading-relaxed" style={{
              fontSize: prefs.fontSize === 'small' ? '13px' : prefs.fontSize === 'large' ? '18px' : '15px'
            }}>
              שלום! כאן מוצג טקסט לדוגמה 👶
            </p>
          </div>
        </div>
      </div>

      {/* High contrast */}
      <div className="bg-white rounded-2xl shadow-soft px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl flex-shrink-0">
              🎨
            </div>
            <div>
              <p className="font-rubik font-semibold text-brown-800 text-sm">ניגודיות גבוהה</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">מגדיל את הניגוד לקריאה קלה יותר</p>
            </div>
          </div>
          <Toggle
            on={prefs.highContrast}
            onChange={v => updatePref('highContrast', v)}
          />
        </div>
      </div>

      {/* Reduce motion */}
      <div className="bg-white rounded-2xl shadow-soft px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl flex-shrink-0">
              🎬
            </div>
            <div>
              <p className="font-rubik font-semibold text-brown-800 text-sm">הפחת תנועה</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">מבטל אנימציות ומעברים</p>
            </div>
          </div>
          <Toggle
            on={prefs.reduceMotion}
            onChange={v => updatePref('reduceMotion', v)}
          />
        </div>
      </div>

      {/* Info footer */}
      <p className="text-center font-rubik text-brown-400 text-xs px-4">
        ההגדרות נשמרות במכשיר זה בלבד ואינן מחייבות התחברות לשרת
      </p>
    </div>
  )
}
