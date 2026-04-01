import { useNavigate } from 'react-router-dom'
import { goBack } from '../lib/utils'

const LAST_UPDATED = '6 במרץ 2026'
const CONTACT_EMAIL = 'hananelsabag1@gmail.com'

const sections = [
  {
    icon: '📋',
    title: 'מה המידע שאנחנו אוספים',
    content: [
      {
        subtitle: 'מידע שמסרת אתה/את',
        items: [
          'שם המשפחה ושם התפקיד שלך (אמא, אבא, סבא וכו\')',
          'שם הילד/ה, תאריך לידה, מין ותמונה — אם בחרת להוסיף',
          'נתוני מעקב: האכלות, חיתולים, שינה, ויטמינים, גדילה ועוד',
          'תמונת פרופיל שהעלית',
        ],
      },
      {
        subtitle: 'מידע שמגיע מ-Google בעת כניסה',
        items: [
          'שם מלא וכתובת מייל — לזיהוי החשבון בלבד',
          'תמונת פרופיל Google — מוצגת באפליקציה, לא מאוחסנת אצלנו',
        ],
      },
      {
        subtitle: 'מידע טכני (נשמר במכשיר שלך בלבד)',
        items: [
          'מזהה המשפחה והחבר — לטעינה מהירה בלי לחכות לשרת',
          'הגדרות התראות (כן/לא)',
          'אם ראית את הצעת ה-Push Notifications',
        ],
      },
    ],
  },
  {
    icon: '🎯',
    title: 'למה אנחנו משתמשים במידע',
    simple: true,
    items: [
      'להפעלת האפליקציה — לשמור ולהציג את נתוני המעקב של התינוק',
      'לשיתוף בין בני המשפחה — כדי שאבא, אמא וסבתא יראו את אותם נתונים',
      'לשליחת התראות Push — רק אם הפעלת אותן, רק מהסוג שבחרת',
      'לא לשום דבר אחר. אין פרסומות. אין ניתוח התנהגות. אין AI שלומד עליך.',
    ],
  },
  {
    icon: '🏢',
    title: 'עם מי אנחנו משתפים מידע',
    note: 'לא מוכרים, לא מעבירים ולא סוחרים בשום מידע אישי. נקודה.',
    content: [
      {
        subtitle: 'Supabase (supabase.com)',
        items: [
          'פלטפורמת מסד הנתונים והאחסון שעליה האפליקציה בנויה',
          'כל הנתונים שמורים שם עם הצפנה, מוגנים עם Row-Level Security',
          'השרתים נמצאים ב-AWS בפרנקפורט (EU West)',
          'מדיניות הפרטיות שלהם: supabase.com/privacy',
        ],
      },
      {
        subtitle: 'Google (כניסה בלבד)',
        items: [
          'משמש לאימות זהות בלבד — אנחנו לא שולחים לו מידע על פעולות שלך',
          'מדיניות הפרטיות שלהם: policies.google.com/privacy',
        ],
      },
      {
        subtitle: 'שירותי Push Notifications',
        items: [
          'Chrome/Android: Google FCM — מקבל הודעות מוצפנות בלבד (AES-128-GCM)',
          'Firefox: Mozilla Push Service',
          'Safari/iOS: Apple Push Notification Service',
          'ההודעות מוצפנות מקצה לקצה — שירות ה-Push רואה רק: "יש הודעה למכשיר X", לא את התוכן',
        ],
      },
      {
        subtitle: 'Vercel (vercel.com)',
        items: [
          'אחסון קבצי האפליקציה בלבד (HTML, JS, CSS)',
          'לא נוגע בנתונים שלך',
        ],
      },
    ],
  },
  {
    icon: '🔒',
    title: 'איך אנחנו מגנים על המידע',
    simple: true,
    items: [
      'כל חיבור לאפליקציה מוצפן ב-HTTPS בלבד',
      'Row-Level Security (RLS) — כל משפחה רואה רק את הנתונים שלה, ברמת מסד הנתונים',
      'אין סיסמאות — כניסה דרך Google OAuth בלבד, אנחנו לא מחזיקים סיסמאות',
      'Token גישה תקף ל-1 שעה, מתחדש אוטומטית',
      'התראות Push מוצפנות מקצה לקצה לפי תקן RFC 8291',
    ],
  },
  {
    icon: '🗑️',
    title: 'מחיקת מידע',
    simple: true,
    items: [
      'מחיקת ילד/ה — מוחקת את כל אירועי המעקב שלו/ה',
      'הסרת חבר מהמשפחה — מוחקת את פרטיו מהמשפחה',
      'מחיקת כל המידע — שלח/י מייל לכתובת למטה ונמחק תוך 72 שעות',
      'מינוי Push — ניתן לביטול בכל עת מדף הפרופיל',
    ],
  },
  {
    icon: '👶',
    title: 'גיל המשתמשים',
    simple: true,
    items: [
      'האפליקציה מיועדת להורים ומטפלים מעל גיל 18',
      'נתוני תינוקות נשמרים על ידי ההורים ובאחריותם',
      'אנחנו לא אוספים מידע ישירות מילדים',
    ],
  },
]

function Section({ section }) {
  return (
    <div className="bg-white rounded-3xl shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-100">
        <span className="text-2xl">{section.icon}</span>
        <h2 className="font-rubik font-bold text-brown-800 text-base">{section.title}</h2>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Note banner */}
        {section.note && (
          <div className="bg-green-50 rounded-2xl px-4 py-2.5">
            <p className="font-rubik text-green-700 text-sm font-medium">{section.note}</p>
          </div>
        )}

        {/* Simple bullet list */}
        {section.simple && (
          <ul className="space-y-2">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-brown-400 mt-0.5 flex-shrink-0">•</span>
                <p className="font-rubik text-brown-700 text-sm leading-relaxed">{item}</p>
              </li>
            ))}
          </ul>
        )}

        {/* Grouped content */}
        {section.content && section.content.map((group, gi) => (
          <div key={gi}>
            <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">
              {group.subtitle}
            </p>
            <ul className="space-y-1.5 bg-cream-50 rounded-2xl px-4 py-3">
              {group.items.map((item, ii) => (
                <li key={ii} className="flex items-start gap-2">
                  <span className="text-brown-300 flex-shrink-0 mt-0.5">›</span>
                  <p className="font-rubik text-brown-700 text-sm leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center" dir="rtl">
      <div className="w-full max-w-[480px] px-4 pt-6 pb-12">

        {/* Back button */}
        <button
          onClick={() => goBack(navigate, '/')}
          className="flex items-center gap-2 text-brown-500 font-rubik text-sm mb-5 active:opacity-70"
        >
          ← חזרה
        </button>

        {/* Hero */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="font-rubik font-bold text-3xl text-brown-800">מדיניות פרטיות</h1>
          <p className="font-rubik text-brown-400 text-sm mt-1">עודכן לאחרונה: {LAST_UPDATED}</p>

          {/* TL;DR */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-3xl px-5 py-4 text-right">
            <p className="font-rubik font-bold text-amber-800 text-sm mb-1">בקצרה (TL;DR)</p>
            <p className="font-rubik text-amber-700 text-sm leading-relaxed">
              אנחנו שומרים רק את המידע שאתה מכניס לאפליקציה.
              לא מוכרים, לא חולקים, לא מנתחים לצרכי פרסום.
              המידע שמור בבסיס נתונים מאובטח ושייך לך בלבד.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section, i) => (
            <Section key={i} section={section} />
          ))}

          {/* Contact */}
          <div className="bg-white rounded-3xl shadow-soft px-5 py-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">✉️</span>
              <h2 className="font-rubik font-bold text-brown-800 text-base">יצירת קשר</h2>
            </div>
            <p className="font-rubik text-brown-600 text-sm leading-relaxed mb-3">
              שאלות על הפרטיות שלך? בקשה למחיקת מידע? כתוב/י לנו ונחזור תוך 48 שעות:
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 bg-cream-100 rounded-2xl px-4 py-2.5 font-rubik text-brown-700 text-sm font-medium active:scale-95 transition-transform"
            >
              📧 {CONTACT_EMAIL}
            </a>
          </div>

          {/* Bottom note */}
          <p className="font-rubik text-brown-300 text-xs text-center px-4 leading-relaxed">
            BabyTracker היא אפליקציה פרטית ללא מטרות רווח.
            המידע שלך לעולם לא ישמש לפרסום, מכירה או ניתוח מחוץ לאפליקציה.
          </p>
        </div>
      </div>
    </div>
  )
}
