import { useState, useEffect, useRef } from 'react'

const AUTO_CLOSE_MS = 9000

function hiResAvatar(url) {
  if (!url) return url
  if (url.includes('googleusercontent.com')) return url.replace(/=s\d+-c/, '=s300-c')
  return url
}

const SISTER_LINES = [
  { text: 'אחותי הגדולה',            emoji: '👑' },
  { text: 'מזל טוב על הבייבי!',      emoji: '🎉' },
  { text: 'את אמא מדהימה',           emoji: '🦋' },
  { text: 'אוהב אותך מאוד',          emoji: '💜' },
]

const FLOAT_EMOJIS = ['✨', '🌟', '💜', '🎊', '⭐', '💫', '🎉', '🌸', '💜', '✨']

export function SisterPopup({ avatarUrl, name }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const floatsRef = useRef([])

  useEffect(() => {
    if (sessionStorage.getItem('bt_sister_shown')) return
    sessionStorage.setItem('bt_sister_shown', '1')

    floatsRef.current = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      emoji: FLOAT_EMOJIS[i % FLOAT_EMOJIS.length],
      left: `${3 + (i * 7) % 90}%`,
      delay: `${(i * 0.4) % 4}s`,
      duration: `${3.5 + (i * 0.3) % 3}s`,
      size: `${1.0 + (i % 3) * 0.35}rem`,
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

      {/* Floating emojis */}
      {floatsRef.current.map(h => (
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

      {/* Sheet */}
      <div
        className="relative w-full max-w-[480px] animate-slide-up flex flex-col"
        style={{ maxHeight: '92dvh', zIndex: 202 }}
      >
        <div className="bg-white rounded-t-4xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92dvh' }}>

          {/* ── Gradient header ── */}
          <div
            className="relative flex flex-col items-center pt-8 pb-7 px-6 flex-shrink-0"
            style={{ background: 'linear-gradient(160deg, #f3e8ff 0%, #e9d5ff 45%, #d8b4fe 100%)' }}
          >
            {/* X button */}
            <button
              onClick={() => setVisible(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-purple-500 font-bold text-base active:scale-95 transition-transform shadow-soft"
            >
              ✕
            </button>

            {/* Top emojis row */}
            <div className="flex gap-2 text-2xl mb-5 select-none">
              {['🎉', '✨', '👑', '✨', '🎉'].map((h, i) => (
                <span
                  key={i}
                  className="animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1.5s' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Avatar with glow ring */}
            <div className="relative mb-5">
              <div
                className="absolute inset-0 rounded-full bg-purple-300 animate-love-pulse"
                style={{ margin: '-8px' }}
              />
              <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-white shadow-2xl relative">
                {avatarUrl
                  ? <img src={hiResAvatar(avatarUrl)} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="text-6xl flex items-center justify-center w-full h-full bg-purple-100">👩</span>
                }
              </div>
            </div>

            {/* Name */}
            <p className="font-rubik font-black text-3xl text-purple-900 leading-tight text-center">
              {name}
            </p>
          </div>

          {/* ── Content ── */}
          <div className="px-5 py-5 flex-1 overflow-y-auto space-y-3">

            {/* Lines */}
            {SISTER_LINES.map((line, i) => (
              <div
                key={i}
                className="animate-love-row flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{
                  animationDelay: `${0.15 + i * 0.12}s`,
                  background: i % 2 === 0
                    ? 'linear-gradient(135deg, #faf5ff, #f3e8ff)'
                    : 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                }}
              >
                <span className="text-2xl flex-shrink-0">{line.emoji}</span>
                <p className="font-rubik font-bold text-purple-900 text-lg leading-tight">{line.text}</p>
              </div>
            ))}

            {/* Short message */}
            <div className="text-center pt-1 pb-2">
              <p className="font-rubik text-brown-500 text-sm leading-relaxed">
                שמח שיש לנו אפליקציה ביחד 💜
                <br />
                ברכות על הבייבי החמוד — אחותי הגדולה! 🌟
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #a855f7, #7c3aed)',
                }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={() => setVisible(false)}
              className="w-full py-4 rounded-3xl font-rubik font-black text-white text-xl active:scale-95 transition-transform shadow-soft"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #5b21b6 100%)' }}
            >
              🎉 מזל טוב אחותי!
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
