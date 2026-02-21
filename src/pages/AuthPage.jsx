import { useState } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'

export function AuthPage() {
  const { signInWithGoogle } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    try {
      await signInWithGoogle()
      // Page will redirect to Google OAuth
    } catch {
      setError(t('errors.authFailed'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center overflow-hidden">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col relative">

        {/* Decorative blobs */}
        <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #E8B84B 0%, transparent 70%)' }} />
        <div className="absolute top-[30%] left-[-60px] w-48 h-48 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #9B8EC4 0%, transparent 70%)' }} />
        <div className="absolute bottom-[15%] right-[-40px] w-40 h-40 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6B9E8C 0%, transparent 70%)' }} />

        {/* Top section — branding */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">

          {/* App icon */}
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-[2rem] shadow-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-cream-200 flex items-center justify-center border-4 border-white/60">
              <img
                src="/icons/icon-192.png"
                alt="Baby Tracker"
                className="w-full h-full object-cover"
                onError={e => {
                  e.target.style.display = 'none'
                  e.target.parentNode.innerHTML = '<span style="font-size:72px;line-height:1">🍼</span>'
                }}
              />
            </div>
            {/* Floating badge */}
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-full shadow-card flex items-center justify-center text-xl">
              👶
            </div>
          </div>

          {/* App name */}
          <h1 className="font-rubik font-black text-4xl text-brown-800 mb-1 tracking-tight">
            BabyTracker
          </h1>
          <p className="font-rubik text-brown-400 text-base text-center leading-relaxed mb-2">
            {t('auth.subtitle')}
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['🍼 האכלות', '👶 חיתולים', '☀️ ויטמינים', '📊 דוחות'].map(label => (
              <span key={label} className="px-3 py-1 bg-white rounded-full text-xs font-rubik font-medium text-brown-600 shadow-soft">
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom section — sign in */}
        <div className="px-8 pb-12 space-y-4">

          {/* Google sign-in button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white rounded-3xl py-4 px-6 shadow-card font-rubik font-semibold text-brown-800 text-base active:scale-[0.98] transition-all disabled:opacity-60 border border-cream-200"
          >
            {!loading ? (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" className="flex-shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth.signInWithGoogle')}
              </>
            ) : (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-brown-300 border-t-brown-700 rounded-full animate-spin" />
                {t('auth.signingIn')}
              </span>
            )}
          </button>

          {error && (
            <p className="text-red-500 text-sm text-center font-rubik">{error}</p>
          )}

          <p className="text-center text-xs text-brown-300 font-rubik pt-2">
            מעקב חכם לכל משפחה 🍼
          </p>
        </div>

      </div>
    </div>
  )
}
