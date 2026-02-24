import { useState, useEffect, useRef } from 'react'

const AUTO_CLOSE_MS = 8000

function hiResAvatar(url) {
  if (!url) return url
  if (url.includes('googleusercontent.com')) return url.replace(/=s\d+-c/, '=s300-c')
  return url
}

const LOVE_LINES = [
  { text: 'אישתי האהובה',           emoji: '💍' },
  { text: 'אושר שלי',               emoji: '✨' },
  { text: 'אני אוהב אותך עד אין קץ', emoji: '♾️' },
  { text: 'הגיבורה שלי',            emoji: '🦸‍♀️' },
]

const HEART_EMOJIS = ['❤️', '💕', '💖', '💗', '💝', '🌹', '💫', '✨', '💓', '🥰']

export function LovePopup({ avatarUrl, name }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const heartsRef = useRef([])

  useEffect(() => {
    if (sessionStorage.getItem('bt_love_shown')) return
    sessionStorage.setItem('bt_love_shown', '1')

    heartsRef.current = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      emoji: HEART_EMOJIS[i % HEART_EMOJIS.length],
      left: `${3 + (i * 7) % 90}%`,
      delay: `${(i * 0.4) % 4}s`,
      duration: `${3.5 + (i * 0.3) % 3}s`,
      size: `${1.1 + (i % 3) * 0.4}rem`,
    }))

    setVisible(true)

    const start = Date.now()
    const tick = setInterval(() => {
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
        className="absolute inset-0 bg-black/75 backdrop-blur-md animate-fade-in"
        onClick={() => setVisible(false)}
      />

      {/* Floating hearts in backdrop */}
      {heartsRef.current.map(h => (
        <span
          key={h.id}
          className="fixed animate-float-heart pointer-events-none select-none"
          style={{
            left: h.left,
            bottom: '-2rem',
            fontSize: h.size,
            animationDelay: h.delay,
            animationDuration: h.duration,
            zIndex: 201,
          }}
        >
          {h.emoji}
        </span>
      ))}

      {/* Sheet — rises from bottom, tall */}
      <div
        className="relative w-full max-w-[480px] animate-slide-up flex flex-col"
        style={{ maxHeight: '92dvh', zIndex: 202 }}
      >
        <div className="bg-white rounded-t-4xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92dvh' }}>

          {/* ── Gradient header ── */}
          <div
            className="relative flex flex-col items-center pt-8 pb-7 px-6 flex-shrink-0"
            style={{ background: 'linear-gradient(160deg, #fce7f3 0%, #fbcfe8 45%, #f9a8d4 100%)' }}
          >
            {/* X button */}
            <button
              onClick={() => setVisible(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-pink-500 font-bold text-base active:scale-95 transition-transform shadow-soft"
            >
              ✕
            </button>

            {/* Top hearts row */}
            <div className="flex gap-2 text-2xl mb-5 select-none">
              {['💕','❤️','💖','❤️','💕'].map((h, i) => (
                <span
                  key={i}
                  className="animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1.5s' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Avatar with pulsing glow ring */}
            <div className="relative mb-5">
              <div
                className="absolute inset-0 rounded-full bg-pink-300 animate-love-pulse"
                style={{ margin: '-8px' }}
              />
              <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-white shadow-2xl relative">
                {avatarUrl
                  ? <img src={hiResAvatar(avatarUrl)} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="text-6xl flex items-center justify-center w-full h-full bg-pink-100">👩</span>
                }
              </div>
            </div>

            {/* Name */}
            <p className="font-rubik font-black text-3xl text-pink-900 leading-tight text-center">
              {name}
            </p>
          </div>

          {/* ── Content ── */}
          <div className="px-5 py-5 flex-1 overflow-y-auto space-y-3">

            {/* Love lines */}
            {LOVE_LINES.map((line, i) => (
              <div
                key={i}
                className="animate-love-row flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{
                  animationDelay: `${0.15 + i * 0.12}s`,
                  background: i % 2 === 0
                    ? 'linear-gradient(135deg, #fff0f6, #ffe4f0)'
                    : 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
                }}
              >
                <span className="text-2xl flex-shrink-0">{line.emoji}</span>
                <p className="font-rubik font-bold text-pink-800 text-lg leading-tight">{line.text}</p>
              </div>
            ))}

            {/* Short message */}
            <div className="text-center pt-1 pb-2">
              <p className="font-rubik text-brown-500 text-sm leading-relaxed">
                כל יום שעובר אני אוהב אותך יותר ויותר 💝
                <br />
                תודה שאת קיימת בחיי 🌹
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-pink-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #f472b6, #ec4899)',
                }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={() => setVisible(false)}
              className="w-full py-4 rounded-3xl font-rubik font-black text-white text-xl active:scale-95 transition-transform shadow-soft"
              style={{ background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #be185d 100%)' }}
            >
              💋 אוהב אותך !
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
