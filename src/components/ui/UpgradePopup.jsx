import { useState, useEffect } from 'react'
import {
  BookImage, Wand2, TrendingUp, Users,
  Lightbulb, Smartphone, Sparkles, Share2, X,
} from 'lucide-react'

const VERSION_KEY    = 'bt_upgrade_v3_seen'
const AUTO_CLOSE_MS  = 15000

// Features shown in the 2-column grid.
// The first entry spans both columns (accent) — spotlight on the biggest new thing.
const FEATURES = [
  {
    Icon: BookImage,
    iconColor: '#B8883B',
    iconBg:    '#FEF3C7',
    title:     'אלבום שנה ראשונה',
    desc:      '12 חודשי חיים, אפקטים ומסגרות — יצוא לאיכות הדפסה',
    accent:    true,
  },
  {
    Icon: Wand2,
    iconColor: '#8B5E3C',
    iconBg:    '#FFF0E0',
    title:     'עיצוב חדש בכל הדפים',
    desc:      'Claymorphism — חם, עגול ומזמין בכל המסכים',
  },
  {
    Icon: TrendingUp,
    iconColor: '#5BAD6F',
    iconBg:    '#DCFCE7',
    title:     'עקומות גדילה WHO',
    desc:      'גרפי אחוזונים לפי גיל ומין לפי תקן עולמי',
  },
  {
    Icon: Users,
    iconColor: '#6B9E8C',
    iconBg:    '#E8F5F1',
    title:     'החלפת ילד מהירה',
    desc:      'מעבר בין ילדים ישירות ממסך הבית',
  },
  {
    Icon: Lightbulb,
    iconColor: '#E8B84B',
    iconBg:    '#FEF9E6',
    title:     'תובנות חכמות',
    desc:      'ניתוח אוטומטי של מגמות ומדדים בדוחות',
  },
  {
    Icon: Smartphone,
    iconColor: '#9B8EC4',
    iconBg:    '#F3F0FF',
    title:     'התקנה לנייד',
    desc:      'הוסף לדף הבית לגישה מהירה כמו אפליקציה',
  },
]

export function UpgradePopup() {
  const [visible,  setVisible]  = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (localStorage.getItem(VERSION_KEY)) return
    localStorage.setItem(VERSION_KEY, '1')

    const delay = setTimeout(() => {
      setVisible(true)

      const start = Date.now()
      const tick  = setInterval(() => {
        const elapsed = Date.now() - start
        setProgress(Math.max(0, 100 - (elapsed / AUTO_CLOSE_MS) * 100))
      }, 80)

      const timer = setTimeout(() => {
        setVisible(false)
        clearInterval(tick)
      }, AUTO_CLOSE_MS)

      return () => { clearTimeout(timer); clearInterval(tick) }
    }, 1200)

    return () => clearTimeout(delay)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(61,43,31,0.62)', backdropFilter: 'blur(8px)' }}
      onClick={() => setVisible(false)}
    >
      <div
        className="w-full max-w-[480px] rounded-t-4xl overflow-hidden"
        style={{
          background:  '#FFFBF5',
          boxShadow:   '0 -8px 48px rgba(61,43,31,0.22), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Auto-close progress bar */}
        <div className="h-1 bg-cream-200">
          <div
            className="h-full rounded-full"
            style={{
              width:      `${progress}%`,
              background: 'linear-gradient(90deg, #A07050, #E8B84B)',
              transition: 'width 80ms linear',
            }}
          />
        </div>

        <div className="px-5 pt-5 pb-6" dir="rtl">

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-3xl flex items-center justify-center flex-shrink-0"
                style={{
                  background:  'linear-gradient(135deg, #A07050, #E8B84B)',
                  boxShadow:   '0 6px 20px rgba(232,184,75,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
              >
                <Sparkles size={26} className="text-white" />
              </div>
              <div>
                <p className="font-rubik font-black text-brown-800 text-xl leading-tight">מה חדש!</p>
                <p className="font-rubik text-brown-400 text-xs mt-0.5">גרסה 3.0 — אלבום + עיצוב חדש ועוד</p>
              </div>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="w-9 h-9 rounded-2xl bg-cream-200 flex items-center justify-center text-brown-500 active:scale-95 transition-transform cursor-pointer"
              aria-label="סגור"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Feature grid ── */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded-2xl px-3 py-3 ${f.accent ? 'col-span-2' : ''}`}
                style={{
                  background:  f.accent
                    ? 'linear-gradient(135deg, #FEF3C7 0%, #FFF8F0 100%)'
                    : '#FFFFFF',
                  boxShadow:   f.accent
                    ? '0 4px 16px rgba(232,184,75,0.18), inset 0 1px 0 rgba(255,255,255,0.95)'
                    : '0 2px 8px rgba(61,43,31,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                  border: f.accent
                    ? '1px solid rgba(232,184,75,0.3)'
                    : '1px solid rgba(245,230,211,0.7)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: f.iconBg,
                    boxShadow:       '0 2px 6px rgba(61,43,31,0.08)',
                  }}
                >
                  <f.Icon size={18} color={f.iconColor} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-rubik font-bold text-brown-800 text-xs leading-tight">{f.title}</p>
                  <p className="font-rubik text-brown-400 text-[10px] leading-tight mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Share row ── */}
          <div
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-3"
            style={{
              background: '#FFF8F0',
              boxShadow:  '0 2px 8px rgba(61,43,31,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
              border:     '1px solid rgba(245,230,211,0.7)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#FEF3C7', boxShadow: '0 2px 6px rgba(61,43,31,0.08)' }}
            >
              <Share2 size={14} color="#B8883B" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-rubik text-brown-700 text-xs leading-tight">אהבת? שתף/י עם הורים נוספים</p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText('https://baby-tracker-two-liart.vercel.app')
                  alert('הקישור הועתק! 🎉')
                }}
                className="font-rubik text-amber-700 font-semibold text-[11px] underline mt-0.5 cursor-pointer active:opacity-60"
              >
                baby-tracker-two-liart.vercel.app
              </button>
            </div>
          </div>

          {/* ── CTA ── */}
          <button
            onClick={() => setVisible(false)}
            className="w-full py-3.5 rounded-3xl font-rubik font-bold text-white text-sm active:scale-[0.98] transition-transform cursor-pointer"
            style={{
              background:  'linear-gradient(135deg, #A07050, #8B5E3C)',
              boxShadow:   '0 6px 20px rgba(139,94,60,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            יאללה נתחיל!
          </button>
        </div>
      </div>
    </div>
  )
}
