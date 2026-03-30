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
    light: '#6B9E8C14',
  },
  {
    icon: '📊',
    title: 'דוחות וגרפים שמספרים סיפור',
    desc: 'במקום לנחש, תנו לנתונים לדבר. גרפים שבועיים ברורים של זמני האכלה, שעות שינה וסטטיסטיקת חיתולים. עקבו אחרי דפוסים, זהו שינויים בשגרה והבינו את הצרכים של הילד שלכם.',
    color: '#7BA7E8',
    light: '#7BA7E814',
  },
  {
    icon: '💊',
    title: 'מעקבים מותאמים אישית',
    desc: 'מעבר להזנות ושינה — ויטמין D, תרופות, חיסונים או כל דבר אחר שחשוב לכם לתעד. אתם בונים את המעקב, המערכת שומרת את ההיסטוריה.',
    color: '#E8B84B',
    light: '#E8B84B14',
  },
  {
    icon: '📈',
    title: 'מעקב גדילה לפי תקן WHO',
    desc: 'תעדו משקל וגובה לאורך זמן וקבלו השוואה אוטומטית לעקומות הגדילה הרשמיות של ארגון הבריאות העולמי. תמיד תדעו בדיוק איפה הילד עומד באחוזונים.',
    color: '#5BAD6F',
    light: '#5BAD6F14',
  },
  {
    icon: '📱',
    title: 'מותאם לחוויית מובייל מלאה',
    desc: 'אין צורך בחנות אפליקציות. הוסיפו את BabyTracker ישירות למסך הבית של האייפון או האנדרואיד שלכם בלחיצה אחת — חוויה חלקה ומהירה, כולל תמיכה במספר ילדים.',
    color: '#9B8EC4',
    light: '#9B8EC414',
  },
]

const TRUST_BADGES = ['בחינם לחלוטין', 'ללא פרסומות', 'ללא כרטיס אשראי', 'התחברות מאובטחת']

function GoogleSignInButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 bg-white rounded-2xl py-4 px-6 font-rubik font-semibold text-brown-800 text-base active:scale-[0.98] transition-all disabled:opacity-60"
      style={{ boxShadow: '0 2px 12px rgba(139,94,60,0.12)', border: '1.5px solid #E8D5C4' }}
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

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 px-6 mb-5 mt-2">
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, #E0CEBE, transparent)' }} />
      <span className="font-rubik font-semibold text-xs text-brown-400 tracking-wide whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #E0CEBE, transparent)' }} />
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

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center overflow-x-hidden" dir="rtl">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col relative">

        {/* ── Ambient background blobs ── */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(232,184,75,0.22) 0%, transparent 65%)', transform: 'translate(35%, -35%)' }} />
        <div className="absolute top-[38%] left-0 w-60 h-60 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(155,142,196,0.16) 0%, transparent 65%)', transform: 'translate(-45%, 0)' }} />
        <div className="absolute bottom-[20%] right-0 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(107,158,140,0.16) 0%, transparent 65%)', transform: 'translate(40%, 0)' }} />

        {/* ══════════════════════════════
            HERO
        ══════════════════════════════ */}
        <div className="relative flex flex-col items-center px-7 pt-14 pb-10 text-center">
          {/* warm wash behind hero content */}
          <div className="absolute inset-0 pointer-events-none rounded-b-[3rem]"
            style={{ background: 'linear-gradient(180deg, rgba(255,226,180,0.30) 0%, transparent 100%)' }} />

          {/* App icon */}
          <div className="relative mb-7 z-10">
            <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(232,184,75,0.5), transparent)', filter: 'blur(20px)', transform: 'scale(1.5)' }} />
            <div
              className="w-28 h-28 rounded-[2rem] overflow-hidden flex items-center justify-center border-4 border-white relative"
              style={{ boxShadow: '0 8px 32px rgba(139,94,60,0.20)', background: 'linear-gradient(135deg, #FFF6E8 0%, #FFE4C0 100%)' }}
            >
              <img
                src="/icons/icon-192.png"
                alt="Baby Tracker"
                className="w-full h-full object-cover"
                onError={e => {
                  e.target.style.display = 'none'
                  e.target.parentNode.innerHTML = '<span style="font-size:64px;line-height:1">🍼</span>'
                }}
              />
            </div>
            <div className="absolute -bottom-2 -left-2 w-9 h-9 bg-white rounded-full flex items-center justify-center text-lg"
              style={{ boxShadow: '0 2px 8px rgba(139,94,60,0.15)', border: '1.5px solid #F0E6D9' }}>
              👶
            </div>
          </div>

          {/* Title */}
          <h1 className="font-rubik font-black text-5xl text-brown-800 mb-4 tracking-tight z-10 leading-none">
            BabyTracker
          </h1>

          <p className="font-rubik font-medium text-brown-600 text-[1.05rem] leading-relaxed mb-1.5 max-w-[17rem] z-10">
            כל מה שקורה עם הילד שלכם — מתועד, מסונכרן ונגיש מכל מקום.
          </p>
          <p className="font-rubik text-brown-400 text-sm leading-relaxed mb-8 max-w-[17rem] z-10">
            כלי חכם ופשוט להורים שרוצים לעשות סדר בשגרה של התינוק.
          </p>

          {/* Primary CTA */}
          <div className="w-full z-10">
            <GoogleSignInButton onClick={handleGoogleSignIn} loading={loading} />
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center font-rubik mt-3 z-10">{error}</p>
          )}

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-5 z-10">
            {TRUST_BADGES.map(label => (
              <span
                key={label}
                className="flex items-center gap-1 px-3 py-1 rounded-full font-rubik text-[11px] text-brown-400"
                style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(224,206,190,0.7)' }}
              >
                <span className="text-[#6B9E8C] font-bold">✓</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════
            FEATURES
        ══════════════════════════════ */}
        <SectionDivider label="מה מקבלים" />

        <div className="px-5 pb-4 space-y-3">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="bg-white rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${f.color}28`, boxShadow: '0 1px 8px rgba(139,94,60,0.07)' }}
            >
              {/* Colored accent stripe */}
              <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${f.color} 0%, ${f.color}55 100%)` }} />

              <div className="p-4 flex gap-3.5 items-start">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-[1.35rem] flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: f.light }}
                >
                  {f.icon}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="font-rubik font-bold text-brown-800 text-sm mb-1.5 leading-snug">{f.title}</p>
                  <p className="font-rubik text-brown-400 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════
            ABOUT
        ══════════════════════════════ */}
        <SectionDivider label="מי אני?" />

        <div
          className="mx-5 mb-5 bg-white rounded-3xl p-5"
          style={{ border: '1px solid #EEE2D8', boxShadow: '0 1px 8px rgba(139,94,60,0.07)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #FFF2DE, #FFE4C0)' }}
            >
              👨‍💻
            </div>
            <div>
              <p className="font-rubik font-bold text-brown-800 text-sm leading-tight">חננאל סבג</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">יוצר BabyTracker</p>
            </div>
          </div>
          <p className="font-rubik text-brown-500 text-sm leading-relaxed mb-2">
            בניתי את BabyTracker כשהבן שלי נולד, פשוט כי חיפשתי פתרון חכם, מהיר ומדויק יותר ממה שהיה קיים בחוץ. אחרי שראיתי כמה סדר ושקט המערכת הזו נתנה לנו בשגרה, החלטתי לפתוח אותה בחינם כדי לעזור להורים נוספים.
          </p>
          <p className="font-rubik text-brown-500 text-sm leading-relaxed mb-4">
            האפליקציה הזו היא פרויקט שנבנה ומתוחזק באהבה. הפידבק שלכם הוא הדלק שמניע את הפיתוח קדימה – אני קורא כל הודעה ותמיד מחפש דרכים לשפר, לתקן באגים ולהוסיף את הפיצ'רים שהכי חסרים לכם ביומיום.
          </p>
          <a
            href="mailto:hananel12345@gmail.com"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-rubik font-medium text-brown-600 text-sm active:scale-[0.98] transition-all"
            style={{ background: '#FFF8F0', border: '1px solid #E8D5C4', boxShadow: '0 1px 4px rgba(139,94,60,0.08)' }}
          >
            ✉️ hananel12345@gmail.com
          </a>
        </div>

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
