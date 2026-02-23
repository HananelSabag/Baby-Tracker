import { useState, useEffect } from 'react'

const AUTO_CLOSE_MS = 3000

// Bump Google avatar URL to a higher resolution (default s96 → s300)
function hiResAvatar(url) {
  if (!url) return url
  if (url.includes('googleusercontent.com')) return url.replace(/=s\d+-c/, '=s300-c')
  return url
}

export function LovePopup({ avatarUrl, name }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (sessionStorage.getItem('bt_love_shown')) return
    sessionStorage.setItem('bt_love_shown', '1')
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setVisible(false)}
      />

      {/* Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xs p-7 text-center animate-popup-enter">
        {/* X button – top right */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-pink-400 hover:text-pink-600 transition-colors text-base font-bold"
        >
          ✕
        </button>

        {/* Heart decorations */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 text-lg select-none pointer-events-none">
          <span>💕</span><span>❤️</span><span>💕</span>
        </div>

        {/* Profile picture */}
        <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-4 mt-2 ring-4 ring-pink-200 shadow-lg">
          {avatarUrl
            ? <img src={hiResAvatar(avatarUrl)} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            : <span className="text-6xl flex items-center justify-center w-full h-full bg-pink-50">👩</span>
          }
        </div>

        {/* Name */}
        <p className="font-rubik font-bold text-2xl text-brown-800 mb-3 leading-tight">{name}</p>

        {/* Love message */}
        <div className="bg-pink-50 rounded-2xl px-4 py-4 mb-5 space-y-1">
          <p className="font-rubik font-bold text-pink-600 text-lg leading-snug">
            אישתי היקרה 💖
          </p>
          <p className="font-rubik text-brown-700 text-base leading-relaxed">
            אני אוהב אותך ❤️
          </p>
        </div>

        {/* Countdown bar */}
        <div className="w-full h-1.5 bg-pink-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-pink-400 rounded-full transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={() => setVisible(false)}
          className="w-full py-3 bg-pink-500 hover:bg-pink-600 active:scale-95 rounded-2xl font-rubik font-bold text-white text-base transition-all shadow-soft"
        >
          סגור 💋
        </button>
      </div>
    </div>
  )
}
