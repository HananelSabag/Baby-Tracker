import { useState, useEffect } from 'react'
import { usePushNotifications, DEFAULT_PREFS } from '../hooks/usePushNotifications'

const UPDATE_KEY = 'bt_update_v3_seen'

export function PushPromoPopup({ familyId, memberId }) {
  const [visible, setVisible] = useState(false)
  const [animIn, setAnimIn]   = useState(false)
  const [step, setStep]       = useState('idle') // 'idle' | 'loading' | 'granted' | 'denied'

  const { supported, permission, isSubscribed, subscribe } = usePushNotifications({ familyId, memberId })

  const canShowPush = supported && !isSubscribed && permission !== 'denied'

  useEffect(() => {
    if (localStorage.getItem(UPDATE_KEY)) return

    const t = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)))
    }, 2000)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    localStorage.setItem(UPDATE_KEY, '1')
    setAnimIn(false)
    setTimeout(() => setVisible(false), 350)
  }

  async function handleEnable() {
    setStep('loading')
    const result = await subscribe(DEFAULT_PREFS)
    if (result === 'granted') {
      setStep('granted')
      setTimeout(dismiss, 2200)
    } else {
      setStep('denied')
      setTimeout(dismiss, 3000)
    }
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-300"
        style={{ opacity: animIn ? 1 : 0 }}
        onClick={step === 'idle' ? dismiss : undefined}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-350 ease-out"
        style={{ transform: animIn ? 'translateY(0)' : 'translateY(110%)' }}
      >
        <div className="bg-white rounded-t-3xl shadow-2xl px-6 pt-5 pb-8 max-w-md mx-auto">

          {/* Handle bar */}
          <div className="w-10 h-1 bg-cream-300 rounded-full mx-auto mb-5" />

          {step === 'granted' ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎉</div>
              <p className="font-rubik font-bold text-brown-800 text-xl">הכל מוכן!</p>
              <p className="font-rubik text-brown-500 text-sm mt-2 leading-relaxed">
                תראות הופעלו — תקבלו עדכונים גם כשהאפליקציה סגורה
              </p>
            </div>
          ) : step === 'denied' ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">😕</div>
              <p className="font-rubik font-bold text-brown-800 text-lg">הרשאה נדחתה</p>
              <p className="font-rubik text-brown-500 text-sm mt-2 leading-relaxed">
                תמיד אפשר להפעיל מאוחר יותר ממרכז השליטה
              </p>
            </div>
          ) : (
            <>
              {/* Icon + Title */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0 text-3xl shadow-soft">
                  ✨
                </div>
                <div>
                  <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">
                    BabyTracker התחדש!
                  </p>
                  <p className="font-rubik text-brown-400 text-xs mt-0.5">
                    גרסה חדשה עם שיפורים גדולים
                  </p>
                </div>
              </div>

              {/* What's new */}
              <div className="flex flex-col gap-2 mb-4">
                {[
                  { icon: '🔗', text: 'תוקן — הצטרפות למשפחה קיימת עובדת עכשיו בצורה חלקה' },
                  { icon: '📊', text: 'כרטיס סיכום יומי — כל מה שקרה היום במבט אחד' },
                  { icon: '🎛️', text: 'מרכז שליטה — מעקבים, התראות והגדרות במקום אחד' },
                  canShowPush
                    ? { icon: '🔔', text: 'התראות חכמות — תזכורות גם כשהאפליקציה סגורה' }
                    : { icon: '🔔', text: 'התראות חכמות — הגדר שעות לכל מינון וחיתול' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 bg-cream-100 rounded-2xl px-3 py-2">
                    <span className="text-lg flex-shrink-0">{icon}</span>
                    <p className="font-rubik text-brown-700 text-sm">{text}</p>
                  </div>
                ))}
              </div>

              {canShowPush && (
                <p className="font-rubik text-brown-400 text-xs text-center mb-4">
                  תמיד אפשר לבטל ממרכז השליטה
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={dismiss}
                  className="flex-1 py-3 rounded-2xl bg-cream-100 font-rubik font-medium text-brown-600 text-sm active:scale-[0.98] transition-transform"
                >
                  {canShowPush ? 'אחר כך' : '🙌 מגניב, תודה!'}
                </button>
                {canShowPush && (
                  <button
                    onClick={handleEnable}
                    disabled={step === 'loading'}
                    className="flex-[2] py-3 rounded-2xl font-rubik font-bold text-white text-sm active:scale-[0.98] transition-all disabled:opacity-70"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    {step === 'loading' ? '⏳ מחכה לאישור...' : '🔔 הפעל התראות'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
