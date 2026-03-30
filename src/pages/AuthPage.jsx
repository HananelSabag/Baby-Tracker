import { useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'

const FEATURES = [
  {
    icon: '👨‍👩‍👦',
    title: 'כולם מסונכרנים בזמן אמת',
    desc: 'אמא, אבא, סבא או הבייביסיטר — שתפו קוד משפחה וכולם יראו את אותו המידע. כל הזנה, החתלה או יקיצה מתעדכנים מיידית אצל כולם עם התראות חיות, כדי שתמיד תדעו מי עשה מה ומתי.',
    color: '#6B9E8C',
    gradient: 'linear-gradient(135deg, #3D7060 0%, #6B9E8C 100%)',
  },
  {
    icon: '📊',
    title: 'דוחות וגרפים שמספרים סיפור',
    desc: 'במקום לנחש, תנו לנתונים לדבר. גרפים שבועיים ברורים של זמני האכלה, שעות שינה וסטטיסטיקת חיתולים.',
    short: 'גרפים שבועיים של שינה, האכלות וחיתולים.',
    color: '#7BA7E8',
    light: '#7BA7E818',
  },
  {
    icon: '💊',
    title: 'מעקבים מותאמים אישית',
    desc: 'מעבר להזנות ושינה — ויטמין D, תרופות, חיסונים או כל דבר אחר שחשוב לכם לתעד.',
    short: 'ויטמין D, תרופות, חיסונים — כל מה שחשוב.',
    color: '#E8B84B',
    light: '#E8B84B18',
  },
  {
    icon: '📈',
    title: 'מעקב גדילה לפי תקן WHO',
    desc: 'תעדו משקל וגובה לאורך זמן עם עקומות הגדילה הרשמיות של ארגון הבריאות העולמי.',
    short: 'עקומות גדילה עם אחוזונים לפי WHO.',
    color: '#5BAD6F',
    light: '#5BAD6F18',
  },
  {
    icon: '📱',
    title: 'מותאם לחוויית מובייל מלאה',
    desc: 'אין צורך בחנות אפליקציות. הוסיפו את BabyTracker ישירות למסך הבית בלחיצה אחת.',
    short: 'הוסיפו למסך הבית — ללא חנות אפליקציות.',
    color: '#9B8EC4',
    light: '#9B8EC418',
  },
]

const TRUST_BADGES = ['בחינם לחלוטין', 'ללא פרסומות', 'ללא כרטיס אשראי', 'התחברות מאובטחת']

function GoogleSignInButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 rounded-2xl py-[15px] px-6 font-rubik font-semibold text-brown-800 text-base active:scale-[0.98] transition-all disabled:opacity-60 select-none"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #faf4ed 100%)',
        boxShadow: '0 2px 0 #cba882, 0 6px 20px rgba(139,94,60,0.13)',
        border: '1px solid #e4ceB4',
      }}
    >
      {!loading ? (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0">
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
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex-1 h-px bg-cream-300" />
      <span className="font-rubik font-bold text-[10px] tracking-[0.18em] uppercase text-brown-300 whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-cream-300" />
    </div>
  )
}

export function AuthPage() {
  const { signInWithGoogle } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch {
      setError(t('errors.authFailed'))
      setLoading(false)
    }
  }

  const [heroFeature, ...gridFeatures] = FEATURES

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center overflow-x-hidden" dir="rtl">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col">

        {/* ══════════════════════════════
            HERO
        ══════════════════════════════ */}
        <section className="relative flex flex-col items-center px-7 pt-14 pb-12 text-center">

          {/* Radial spotlight */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 85% 50% at 50% 22%, rgba(232,184,75,0.20) 0%, transparent 68%)' }} />

          {/* Floating decorative emojis */}
          <span className="absolute top-9 right-7 text-2xl select-none pointer-events-none"
            style={{ opacity: 0.28, transform: 'rotate(14deg)' }}>🍼</span>
          <span className="absolute top-16 left-6 text-xl select-none pointer-events-none"
            style={{ opacity: 0.22, transform: 'rotate(-15deg)' }}>💤</span>
          <span className="absolute top-[11%] right-[22%] text-base select-none pointer-events-none"
            style={{ opacity: 0.18, transform: 'rotate(8deg)' }}>⭐</span>
          <span className="absolute top-[30%] left-4 text-2xl select-none pointer-events-none"
            style={{ opacity: 0.18, transform: 'rotate(-8deg)' }}>🌙</span>

          {/* App icon with halo rings */}
          <div className="relative z-10 mb-9" style={{ width: 112, height: 112 }}>
            {/* Outer halo */}
            <div style={{
              position: 'absolute', width: 152, height: 152,
              top: -20, left: -20, borderRadius: '50%',
              border: '1px solid rgba(232,184,75,0.14)',
              background: 'rgba(232,184,75,0.04)',
            }} />
            {/* Inner halo */}
            <div style={{
              position: 'absolute', width: 130, height: 130,
              top: -9, left: -9, borderRadius: '50%',
              border: '1px solid rgba(232,184,75,0.26)',
              background: 'rgba(232,184,75,0.07)',
            }} />
            {/* Icon */}
            <div
              className="w-28 h-28 rounded-[2rem] overflow-hidden flex items-center justify-center border-4 border-white"
              style={{
                boxShadow: '0 10px 36px rgba(139,94,60,0.18), 0 2px 8px rgba(139,94,60,0.10)',
                background: 'linear-gradient(135deg, #FFF6E8 0%, #FFDFAC 100%)',
              }}
            >
              <img
                src="/icons/icon-192.png"
                alt="BabyTracker"
                className="w-full h-full object-cover"
                onError={e => {
                  e.target.style.display = 'none'
                  e.target.parentNode.innerHTML = '<span style="font-size:64px;line-height:1">🍼</span>'
                }}
              />
            </div>
            {/* Badge */}
            <div className="absolute -bottom-1.5 -left-1.5 w-8 h-8 bg-white rounded-full flex items-center justify-center text-base"
              style={{ boxShadow: '0 2px 8px rgba(139,94,60,0.15)', border: '1.5px solid #F0E6D9' }}>
              👶
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-rubik font-black text-5xl text-brown-800 leading-none tracking-tight mb-4 z-10">
            BabyTracker
          </h1>

          <p className="font-rubik font-medium text-brown-700 text-[1.05rem] leading-relaxed max-w-[16rem] mb-1.5 z-10">
            כל מה שקורה עם הילד שלכם —<br />מתועד, מסונכרן ונגיש מכל מקום.
          </p>
          <p className="font-rubik text-brown-400 text-sm leading-relaxed max-w-[15rem] mb-9 z-10">
            כלי חכם ופשוט להורים שרוצים לעשות סדר בשגרה של התינוק.
          </p>

          {/* Google CTA */}
          <div className="w-full z-10">
            <GoogleSignInButton onClick={handleGoogleSignIn} loading={loading} />
          </div>
          {error && <p className="text-red-500 text-sm font-rubik mt-3 z-10">{error}</p>}

          {/* Trust badges — plain text row, no pills */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-5 z-10">
            {TRUST_BADGES.map(label => (
              <span key={label} className="flex items-center gap-1 font-rubik text-[11px] text-brown-400">
                <span className="font-bold" style={{ color: '#6B9E8C' }}>✓</span>
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════
            FEATURES
        ══════════════════════════════ */}
        <section className="px-5 pb-6">
          <SectionLabel>הכל במקום אחד</SectionLabel>

          {/* Hero feature — full-width colored card */}
          <div
            className="rounded-3xl p-5 mb-3 relative overflow-hidden"
            style={{ background: heroFeature.gradient, boxShadow: '0 6px 28px rgba(61,112,96,0.28)' }}
          >
            {/* decorative circles */}
            <div style={{ position: 'absolute', width: 140, height: 140, top: -40, left: -28, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 90, height: 90, bottom: -30, right: -16, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

            <div className="relative z-10 flex gap-4 items-start">
              <span className="text-[2.6rem] leading-none flex-shrink-0 mt-0.5 select-none">
                {heroFeature.icon}
              </span>
              <div>
                <p className="font-rubik font-black text-white text-lg leading-snug mb-2">
                  {heroFeature.title}
                </p>
                <p className="font-rubik text-white/75 text-xs leading-relaxed">
                  {heroFeature.desc}
                </p>
              </div>
            </div>
          </div>

          {/* 2 × 2 compact grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {gridFeatures.map(f => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-3.5 flex flex-col items-center text-center"
                style={{ border: `1.5px solid ${f.color}2e`, boxShadow: '0 1px 6px rgba(139,94,60,0.06)' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-2.5"
                  style={{ backgroundColor: f.light }}
                >
                  {f.icon}
                </div>
                <p className="font-rubik font-bold text-brown-800 text-xs leading-snug mb-1">
                  {f.title}
                </p>
                <p className="font-rubik text-brown-400 text-[10px] leading-relaxed">
                  {f.short}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════
            ABOUT
        ══════════════════════════════ */}
        <section
          className="mx-5 mb-5 rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(155deg, #FFF6E6 0%, #FFEFD4 100%)',
            border: '1px solid #ECDABB',
            boxShadow: '0 2px 12px rgba(139,94,60,0.07)',
          }}
        >
          <div className="px-5 pt-5 pb-5">
            <SectionLabel>מי אני?</SectionLabel>

            {/* Author header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #FFE4A8, #FFCA70)' }}
              >
                👨‍💻
              </div>
              <div>
                <p className="font-rubik font-black text-brown-800 text-base leading-tight">חננאל סבג</p>
                <p className="font-rubik text-brown-400 text-xs mt-0.5">יוצר BabyTracker</p>
              </div>
            </div>

            <p className="font-rubik text-brown-600 text-sm leading-relaxed mb-3">
              בניתי את BabyTracker כשהבן שלי נולד, פשוט כי חיפשתי פתרון חכם, מהיר ומדויק יותר ממה שהיה קיים בחוץ. אחרי שראיתי כמה סדר ושקט המערכת הזו נתנה לנו בשגרה, החלטתי לפתוח אותה בחינם כדי לעזור להורים נוספים.
            </p>
            <p className="font-rubik text-brown-600 text-sm leading-relaxed mb-4">
              האפליקציה הזו היא פרויקט שנבנה ומתוחזק באהבה. הפידבק שלכם הוא הדלק שמניע את הפיתוח קדימה – אני קורא כל הודעה ותמיד מחפש דרכים לשפר, לתקן באגים ולהוסיף את הפיצ'רים שהכי חסרים לכם ביומיום.
            </p>

            <a
              href="mailto:hananelsabag1@gmail.com"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-rubik font-medium text-brown-700 text-sm active:scale-[0.98] transition-all"
              style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid #DBBF96', boxShadow: '0 1px 4px rgba(139,94,60,0.09)' }}
            >
              ✉️ hananelsabag1@gmail.com
            </a>
          </div>
        </section>

        {/* ══════════════════════════════
            FOOTER
        ══════════════════════════════ */}
        <div className="px-8 pb-12 flex flex-col items-center gap-3">
          <p className="text-center text-xs text-brown-300 font-rubik">
            בכניסה לאפליקציה אתם מסכימים ל
          </p>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-rubik font-medium text-brown-500 text-xs active:scale-[0.98] transition-all"
            style={{ background: '#FFFFFF', border: '1.5px solid #D8C8BA', boxShadow: '0 1px 4px rgba(139,94,60,0.08)' }}
          >
            🔐 מדיניות הפרטיות
          </Link>
        </div>

      </div>
    </div>
  )
}
