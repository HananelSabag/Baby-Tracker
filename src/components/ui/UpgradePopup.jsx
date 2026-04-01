import { useState, useEffect } from 'react'

const VERSION_KEY = 'bt_upgrade_v2_seen'
const AUTO_CLOSE_MS = 12000

const FEATURES = [
  { emoji: '⚡', title: 'FAB מהיר', desc: 'תפריט מרכזי לכל הפעולות' },
  { emoji: '✏️', title: 'עריכת תצוגה', desc: 'גרור, הסתר והראה מעקבים' },
  { emoji: '👁️', title: 'הסתרת מעקבים', desc: 'שליטה מלאה על מסך הבית' },
  { emoji: '💊', title: 'צ\'יפים אינטראקטיביים', desc: 'תן מנה בלחיצה ובטל בלחיצה' },
  { emoji: '👤', title: 'פרופיל משודרג', desc: 'תמונה בגדול, כרטיס משפחה' },
  { emoji: '🔔', title: 'התראות עצמאיות', desc: 'דף התראות נפרד ומסודר' },
]

export function UpgradePopup() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (localStorage.getItem(VERSION_KEY)) return
    localStorage.setItem(VERSION_KEY, '1')

    // Small delay so the app loads first
    const delay = setTimeout(() => {
      setVisible(true)

      const start = Date.now()
      const tick = setInterval(() => {
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
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={() => setVisible(false)}
    >
      <div
        className="w-full max-w-[480px] rounded-t-3xl overflow-hidden"
        style={{ background: '#FFFBF5' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-cream-200">
          <div
            className="h-full rounded-full transition-none"
            style={{ width: `${progress}%`, background: '#8B5E3C' }}
          />
        </div>

        <div className="px-5 pt-5 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-soft">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">עדכון גדול הגיע!</p>
                <p className="font-rubik text-brown-400 text-xs">גרסה 2.0 — שדרוג UI מלא</p>
              </div>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center text-brown-500 active:scale-95 transition-transform font-bold text-sm"
            >
              ✕
            </button>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 bg-white rounded-2xl px-3 py-2.5 shadow-soft"
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{f.emoji}</span>
                <div className="min-w-0">
                  <p className="font-rubik font-semibold text-brown-800 text-xs leading-tight">{f.title}</p>
                  <p className="font-rubik text-brown-400 text-[10px] leading-tight mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => setVisible(false)}
            className="w-full py-3.5 rounded-2xl font-rubik font-bold text-white text-sm active:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #8B5E3C, #C4873A)' }}
          >
            יאללה נתחיל! 🎉
          </button>
        </div>
      </div>
    </div>
  )
}
