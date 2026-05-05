import { useState, useEffect, useRef } from 'react'
import { X, Heart } from 'lucide-react'

const AUTO_CLOSE_MS = 10000

function hiResAvatar(url) {
  if (!url) return url
  if (url.includes('googleusercontent.com')) return url.replace(/=s\d+-c/, '=s300-c')
  return url
}

const LOVE_LINES = [
  { text: 'האישה שהפכה את חיי לשלמים',  emoji: '💍', sub: 'מהיום הראשון ועד תמיד' },
  { text: 'האמא הכי מדהימה בעולם',       emoji: '👑', sub: 'אין לי מילים לתאר אותך' },
  { text: 'אני אוהב אותך ללא תנאי',      emoji: '♾️', sub: 'כל יום מחדש, כל שנייה' },
  { text: 'הגיבורה הבלתי מעורערת שלי',   emoji: '🦋', sub: 'חזקה, יפה, מושלמת' },
]

const FLOATING = ['❤️','💕','💖','🌹','💗','✨','💝','🌸','💫','💓','🥰','🌺']

export function LovePopup({ avatarUrl, name }) {
  const [visible, setVisible]   = useState(false)
  const [progress, setProgress] = useState(100)
  const heartsRef               = useRef([])

  useEffect(() => {
    if (sessionStorage.getItem('bt_love_shown')) return
    sessionStorage.setItem('bt_love_shown', '1')

    heartsRef.current = Array.from({ length: 16 }, (_, i) => ({
      id:       i,
      emoji:    FLOATING[i % FLOATING.length],
      left:     `${2 + (i * 6.1) % 92}%`,
      delay:    `${(i * 0.35) % 4.5}s`,
      duration: `${4 + (i * 0.28) % 3.5}s`,
      size:     `${1 + (i % 4) * 0.35}rem`,
      opacity:  0.6 + (i % 3) * 0.15,
    }))

    setVisible(true)

    const start = Date.now()
    const tick  = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / AUTO_CLOSE_MS) * 100))
    }, 50)

    const timer = setTimeout(() => {
      setVisible(false)
      clearInterval(tick)
    }, AUTO_CLOSE_MS)

    return () => { clearTimeout(timer); clearInterval(tick) }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">

      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-md animate-fade-in"
        style={{ background: 'linear-gradient(180deg, rgba(190,24,93,0.55) 0%, rgba(0,0,0,0.72) 100%)' }}
        onClick={() => setVisible(false)}
      />

      {/* Floating hearts */}
      {heartsRef.current.map(h => (
        <span
          key={h.id}
          className="fixed animate-float-heart pointer-events-none select-none"
          style={{
            left:              h.left,
            bottom:            '-2rem',
            fontSize:          h.size,
            opacity:           h.opacity,
            animationDelay:    h.delay,
            animationDuration: h.duration,
            zIndex:            201,
          }}
        >
          {h.emoji}
        </span>
      ))}

      {/* Main sheet */}
      <div
        className="relative w-full max-w-[480px] animate-slide-up flex flex-col"
        style={{ maxHeight: '94dvh', zIndex: 202 }}
      >
        <div
          className="bg-white rounded-t-[2.5rem] overflow-hidden flex flex-col"
          style={{
            maxHeight: '94dvh',
            boxShadow: '0 -8px 48px rgba(190,24,93,0.25), 0 -2px 0 rgba(255,255,255,0.15)',
          }}
        >

          {/* ── Header ── */}
          <div
            className="relative flex flex-col items-center pt-9 pb-8 px-6 flex-shrink-0"
            style={{
              background: 'linear-gradient(160deg, #fdf2f8 0%, #fce7f3 35%, #fbcfe8 70%, #f9a8d4 100%)',
            }}
          >
            {/* Close */}
            <button
              onClick={() => setVisible(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-2xl bg-white/80 flex items-center justify-center text-pink-400 active:scale-95 transition-transform border border-pink-100"
              style={{ boxShadow: '0 2px 8px rgba(190,24,93,0.12), inset 0 1px 0 rgba(255,255,255,0.9)' }}
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* Pulsing hearts row */}
            <div className="flex gap-1.5 text-xl mb-6 select-none">
              {['💕','❤️','💖','❤️','💕'].map((h, i) => (
                <span
                  key={i}
                  className="animate-pulse"
                  style={{ animationDelay: `${i * 0.18}s`, animationDuration: '1.6s' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Avatar */}
            <div className="relative mb-5">
              <div
                className="absolute inset-0 rounded-full animate-love-pulse"
                style={{
                  margin: '-10px',
                  background: 'radial-gradient(circle, #f9a8d4 0%, #ec4899 50%, transparent 70%)',
                  opacity: 0.45,
                }}
              />
              <div
                className="w-36 h-36 rounded-full overflow-hidden relative border-4 border-white"
                style={{ boxShadow: '0 8px 32px rgba(190,24,93,0.3), 0 0 0 2px rgba(249,168,212,0.5)' }}
              >
                {avatarUrl
                  ? <img src={hiResAvatar(avatarUrl)} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="text-6xl flex items-center justify-center w-full h-full bg-pink-100">👩</span>
                }
              </div>
              <div
                className="absolute -bottom-1 -left-1 w-8 h-8 rounded-xl bg-white flex items-center justify-center border border-pink-100"
                style={{ boxShadow: '0 2px 8px rgba(190,24,93,0.15)' }}
              >
                <Heart size={14} fill="#ec4899" className="text-pink-500" />
              </div>
            </div>

            {/* Name */}
            <p className="font-rubik font-black text-3xl text-pink-900 leading-tight text-center tracking-tight">
              {name}
            </p>
            <p className="font-rubik text-pink-400 text-sm mt-1 text-center">
              אהבת חיי ❤️
            </p>
          </div>

          {/* ── Content ── */}
          <div className="px-4 py-5 flex-1 overflow-y-auto space-y-3 bg-white">

            {/* Love lines */}
            {LOVE_LINES.map((line, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-pink-100 animate-love-row"
                style={{
                  animationDelay: `${0.1 + i * 0.1}s`,
                  background: i % 2 === 0
                    ? 'linear-gradient(135deg, #fff0f6 0%, #fce7f3 100%)'
                    : 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
                  boxShadow: '0 2px 10px rgba(190,24,93,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                }}
              >
                <span className="text-2xl flex-shrink-0">{line.emoji}</span>
                <div className="min-w-0">
                  <p className="font-rubik font-bold text-pink-900 text-base leading-tight">{line.text}</p>
                  <p className="font-rubik text-pink-400 text-[11px] mt-0.5 leading-tight">{line.sub}</p>
                </div>
              </div>
            ))}

            {/* Letter */}
            <div
              className="rounded-2xl px-5 py-4 border border-pink-100 text-center"
              style={{
                background: 'linear-gradient(160deg, #fff5f9, #fce7f3)',
                boxShadow: '0 2px 10px rgba(190,24,93,0.06)',
              }}
            >
              <p className="font-rubik text-pink-800 text-sm leading-[1.85] font-medium">
                יש לי את הזכות הכי גדולה בעולם —<br />
                להיות לצידך כל יום מחדש. 🌹<br />
                <span className="text-pink-500">תמשיכי להיות את עצמך,</span><br />
                כי את בדיוק מה שאני צריך. 💫
              </p>
            </div>

            {/* Progress */}
            <div className="w-full h-1 bg-pink-50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width:      `${progress}%`,
                  background: 'linear-gradient(90deg, #f9a8d4, #ec4899, #be185d)',
                }}
              />
            </div>

            {/* CTA */}
            <button
              onClick={() => setVisible(false)}
              className="w-full py-4 rounded-3xl font-rubik font-black text-white text-xl active:scale-[0.97] transition-transform"
              style={{
                background:  'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #be185d 100%)',
                boxShadow:   '0 6px 24px rgba(190,24,93,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              💋 אוהב אותך !
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
