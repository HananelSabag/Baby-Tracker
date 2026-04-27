import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'bt_pwa_install'
const DISMISS_DAYS = 14

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isInStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function canShow() {
  if (isInStandalone()) return false
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return true
  const { state, ts } = JSON.parse(stored)
  if (state === 'installed') return false
  if (state === 'dismissed') {
    const daysSince = (Date.now() - ts) / 86_400_000
    return daysSince >= DISMISS_DAYS
  }
  return true
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [iosExpanded, setIosExpanded] = useState(false)
  const deferredPrompt = useRef(null)
  const ios = useRef(isIOS())

  useEffect(() => {
    if (!canShow()) return

    if (ios.current) {
      // iOS: show after delay (no prompt event)
      const t = setTimeout(() => setVisible(true), 4000)
      return () => clearTimeout(t)
    }

    // Android/Chrome: wait for beforeinstallprompt
    function onPrompt(e) {
      e.preventDefault()
      deferredPrompt.current = e
      const t = setTimeout(() => setVisible(true), 4000)
      return () => clearTimeout(t)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => {
      dismiss('installed')
    })

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss(state = 'dismissed') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, ts: Date.now() }))
    setVisible(false)
    setIosExpanded(false)
  }

  async function handleInstall() {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    if (outcome === 'accepted') dismiss('installed')
    else dismiss('dismissed')
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-0 bottom-[72px] z-40 flex justify-center px-3 animate-slide-up"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="w-full max-w-[480px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.13)] border border-cream-200 overflow-hidden"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Main row */}
        <div className="flex items-center gap-3 px-3 py-3">
          {/* App icon */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-[#8B5E3C] flex items-center justify-center flex-shrink-0 shadow-soft">
            <span className="text-2xl">🍼</span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-rubik font-bold text-brown-800 text-sm leading-tight">BabyTracker</p>
            <p className="font-rubik text-brown-400 text-xs leading-tight mt-0.5">
              {ios.current ? 'הוסף למסך הבית לגישה מהירה' : 'התקן לגישה מהירה ללא דפדפן'}
            </p>
          </div>

          {/* CTA */}
          {ios.current ? (
            <button
              onClick={() => setIosExpanded(v => !v)}
              className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-[#8B5E3C] text-white font-rubik font-semibold text-xs active:opacity-80 transition-opacity"
            >
              {iosExpanded ? 'הסתר' : 'איך?'}
            </button>
          ) : (
            <button
              onClick={handleInstall}
              className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-[#8B5E3C] text-white font-rubik font-semibold text-xs active:opacity-80 transition-opacity"
            >
              התקן
            </button>
          )}

          {/* Dismiss */}
          <button
            onClick={() => dismiss('dismissed')}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center text-brown-400 text-xs active:scale-95 transition-transform font-bold"
          >
            ✕
          </button>
        </div>

        {/* iOS instructions — expands inline */}
        {ios.current && iosExpanded && (
          <div className="px-3 pb-3 pt-0.5 border-t border-cream-100">
            <div className="bg-cream-50 rounded-xl px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-lg flex-shrink-0">1️⃣</span>
                <p className="font-rubik text-brown-600 text-xs leading-snug">
                  לחצו על כפתור השיתוף
                  <span className="mx-1 text-sm">⬆️</span>
                  בתחתית Safari
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-lg flex-shrink-0">2️⃣</span>
                <p className="font-rubik text-brown-600 text-xs leading-snug">
                  גללו למטה ובחרו <span className="font-semibold text-brown-800">״הוסף למסך הבית״</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-lg flex-shrink-0">3️⃣</span>
                <p className="font-rubik text-brown-600 text-xs leading-snug">
                  לחצו <span className="font-semibold text-brown-800">הוסף</span> בפינה הימנית העליונה
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
