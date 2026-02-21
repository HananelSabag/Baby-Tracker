import { useState } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { Button } from '../components/ui/Button'

export function AuthPage() {
  const { signInWithGoogle } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    try {
      await signInWithGoogle()
      // Page will redirect to Google OAuth — no need to setLoading(false)
    } catch {
      setError(t('errors.authFailed'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col items-center justify-center px-8">

        {/* Logo area */}
        <div className="text-center mb-12">
          <div className="w-28 h-28 mx-auto mb-5 rounded-4xl shadow-card overflow-hidden bg-cream-200 flex items-center justify-center">
            <img src="/icons/icon-192.png" alt="הרל" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="font-size:64px">🍼</span>' }} />
          </div>
          <h1 className="font-rubik font-bold text-4xl text-brown-800 mb-2">{t('auth.welcome')}</h1>
          <p className="font-rubik text-brown-400 text-base leading-relaxed">{t('auth.subtitle')}</p>
        </div>

        {/* Sign in button */}
        <div className="w-full space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white rounded-2xl py-4 px-6 shadow-card font-rubik font-medium text-brown-800 text-base active:scale-95 transition-all disabled:opacity-60"
          >
            {!loading && (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? t('auth.signingIn') : t('auth.signInWithGoogle')}
          </button>

          {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}
        </div>

        {/* Decorative footer */}
        <p className="mt-12 text-xs text-brown-300 font-rubik text-center">
          מיוחד עבור הרל 🍼
        </p>
      </div>
    </div>
  )
}
