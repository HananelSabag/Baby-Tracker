// Published reference data used by the child summary page.
//
// GROUND RULE FOR THIS FILE: every number here must be traceable to a named,
// citable publication, and every consumer must render it next to its source.
// If a figure can't be sourced, it does not belong here — the summary page is
// allowed to describe the family's own data freely, but the moment it compares
// that data to "normal" it is making a health-adjacent claim and has to show
// its work. Nothing here is diagnostic; SOURCES carries the disclaimer.

// ── Sleep ────────────────────────────────────────────────────────────────────
//
// AASM consensus statement (Paruthi et al., J Clin Sleep Med 2016;12(11):1549),
// endorsed by the AAP. Hours are per 24h *including naps*.
//
// Note the lower bound of the document itself: the AASM made recommendations
// for ages 4 months through 18 years and deliberately did NOT issue one for
// infants under 4 months, citing insufficient evidence and a wide range of
// normal. We surface that absence instead of inventing a band — see
// sleepBandForAgeMonths returning null.
const SLEEP_BANDS = [
  { minMonths: 4,   maxMonths: 12,  low: 12, high: 16, label: '4–12 חודשים' },
  { minMonths: 12,  maxMonths: 36,  low: 11, high: 14, label: 'שנה–שנתיים' },
  { minMonths: 36,  maxMonths: 72,  low: 10, high: 13, label: '3–5 שנים' },
  { minMonths: 72,  maxMonths: 156, low: 9,  high: 12, label: '6–12 שנים' },
]

/**
 * Recommended sleep band for an age in months, or null when the AASM
 * statement does not cover that age (under 4 months).
 * @returns {{low:number, high:number, label:string} | null}
 */
export function sleepBandForAgeMonths(months) {
  if (months == null || months < 4) return null
  const band = SLEEP_BANDS.find(b => months >= b.minMonths && months < b.maxMonths)
  return band ? { low: band.low, high: band.high, label: band.label } : null
}

// ── Wet diapers ──────────────────────────────────────────────────────────────
//
// The familiar "6 or more wet diapers a day" hydration marker (AAP / standard
// pediatric guidance), which applies from roughly day 5 onward. It is a
// screening cue for parents, not a measurement — and it gets noisy once solids
// and potty training enter the picture, so we only show it in the early period.
export const WET_DIAPER_MIN_PER_DAY = 6
export const WET_DIAPER_RELEVANT_UNTIL_MONTHS = 12

// ── CDC developmental milestones ─────────────────────────────────────────────
//
// CDC "Learn the Signs. Act Early." checklists, 2022 revision (Zubler et al.,
// Pediatrics, 2022 — a joint AAP/CDC working group).
//
// The 2022 revision moved the inclusion criterion from the 50th percentile to
// the 75th: a milestone is listed at an age when *75% or more* of children can
// be expected to do it. That is the whole reason this is safe to show parents —
// under the old 50th-percentile framing, half of all children "missed"
// milestones by construction. We state the criterion on screen.
//
// These are ABRIDGED — a few representative items per age across the social,
// language, cognitive and motor domains. The page links to the full official
// checklist and says plainly that it is a sample. We do not track which
// milestones a child has reached, so nothing here is ever presented as an
// assessment of a particular child; it is "what this age band covers".
export const CDC_MILESTONE_AGES = [2, 4, 6, 9, 12, 15, 18, 24, 30]

const CDC_MILESTONES = {
  2: [
    { domain: 'חברתי',   text: 'נרגע/ת כשמרימים או מדברים אליו/ה' },
    { domain: 'חברתי',   text: 'מסתכל/ת לך בפנים' },
    { domain: 'שפה',     text: 'משמיע/ה קולות מלבד בכי' },
    { domain: 'קוגניטיבי', text: 'עוקב/ת אחריך בעיניים כשאתה זז' },
    { domain: 'מוטורי',  text: 'מרים/ה את הראש בשכיבה על הבטן' },
  ],
  4: [
    { domain: 'חברתי',   text: 'מחייך/ת מיוזמתו/ה כדי למשוך תשומת לב' },
    { domain: 'שפה',     text: 'משמיע/ה קולות גרגור ומגיב/ה כשמדברים אליו/ה' },
    { domain: 'קוגניטיבי', text: 'מסתכל/ת על הידיים בסקרנות' },
    { domain: 'מוטורי',  text: 'מחזיק/ה את הראש יציב בלי תמיכה' },
    { domain: 'מוטורי',  text: 'מחזיק/ה צעצוע שמניחים בכף היד' },
  ],
  6: [
    { domain: 'חברתי',   text: 'מזהה פרצופים מוכרים' },
    { domain: 'שפה',     text: 'מוציא/ה קולות בתורות אתך' },
    { domain: 'קוגניטיבי', text: 'מכניס/ה דברים לפה כדי לחקור אותם' },
    { domain: 'מוטורי',  text: 'מתהפך/ת מהבטן לגב' },
    { domain: 'מוטורי',  text: 'נשען/ת על הידיים בישיבה' },
  ],
  9: [
    { domain: 'חברתי',   text: 'ביישן/ית או נצמד/ת מול זרים' },
    { domain: 'שפה',     text: 'מרבה בהברות כמו "מָמָמָמָ"' },
    { domain: 'קוגניטיבי', text: 'מחפש/ת חפץ שנפל מהעיניים' },
    { domain: 'מוטורי',  text: 'יושב/ת בלי תמיכה' },
    { domain: 'מוטורי',  text: 'מעביר/ה חפץ מיד ליד' },
  ],
  12: [
    { domain: 'חברתי',   text: 'משחק/ת אתך משחקים כמו "איפה אמא"' },
    { domain: 'שפה',     text: 'קורא/ת להורה "אמא" או "אבא"' },
    { domain: 'קוגניטיבי', text: 'מכניס/ה חפץ לתוך מיכל' },
    { domain: 'מוטורי',  text: 'מושך/ת את עצמו/ה לעמידה' },
    { domain: 'מוטורי',  text: 'אוחז/ת חפץ בין אגודל לאצבע' },
  ],
  15: [
    { domain: 'חברתי',   text: 'מוחא/ת כפיים כשמתרגש/ת' },
    { domain: 'שפה',     text: 'אומר/ת מילה או שתיים מלבד אמא/אבא' },
    { domain: 'קוגניטיבי', text: 'מנסה להשתמש בחפצים כראוי (כוס, טלפון)' },
    { domain: 'מוטורי',  text: 'עושה כמה צעדים לבד' },
    { domain: 'מוטורי',  text: 'אוכל/ת לבד עם האצבעות' },
  ],
  18: [
    { domain: 'חברתי',   text: 'מתרחק/ת ממך אבל בודק/ת שאתה קרוב' },
    { domain: 'שפה',     text: 'אומר/ת שלוש מילים או יותר מלבד אמא/אבא' },
    { domain: 'קוגניטיבי', text: 'מחקה אותך בעבודות הבית' },
    { domain: 'מוטורי',  text: 'הולך/ת בלי להיאחז' },
    { domain: 'מוטורי',  text: 'משרבט/ת' },
  ],
  24: [
    { domain: 'חברתי',   text: 'שם/ה לב כשמישהו אחר נפגע או עצוב' },
    { domain: 'שפה',     text: 'מחבר/ת שתי מילים יחד' },
    { domain: 'קוגניטיבי', text: 'משחק/ת עם יותר מצעצוע אחד בו-זמנית' },
    { domain: 'מוטורי',  text: 'רץ/ה ובועט/ת בכדור' },
    { domain: 'מוטורי',  text: 'אוכל/ת עם כפית' },
  ],
  30: [
    { domain: 'חברתי',   text: 'משחק/ת לצד ילדים אחרים ולפעמים אתם' },
    { domain: 'שפה',     text: 'אומר/ת בערך 50 מילים' },
    { domain: 'קוגניטיבי', text: 'משחק/ת "כאילו" עם חפצים' },
    { domain: 'מוטורי',  text: 'קופץ/ת עם שתי הרגליים מהקרקע' },
    { domain: 'מוטורי',  text: 'מוריד/ה בגדים בעצמו/ה' },
  ],
}

/**
 * The checklist age band a child is currently in, plus the next one up.
 * `current` is the most recent checklist age they've passed.
 * Returns nulls when the child is too young / past the covered range.
 */
export function milestoneBandsForAgeMonths(months) {
  if (months == null || months < 0) return { current: null, next: null }
  const passed = CDC_MILESTONE_AGES.filter(a => months >= a)
  const upcoming = CDC_MILESTONE_AGES.find(a => months < a) ?? null
  const currentAge = passed.length ? passed[passed.length - 1] : null
  return {
    current: currentAge ? { age: currentAge, items: CDC_MILESTONES[currentAge] } : null,
    next:    upcoming   ? { age: upcoming,   items: CDC_MILESTONES[upcoming] }   : null,
  }
}

// ── Sources ──────────────────────────────────────────────────────────────────
export const SOURCES = [
  {
    id: 'who',
    title: 'תקני הגדילה של ארגון הבריאות העולמי (WHO)',
    detail: 'WHO Child Growth Standards — עקומות משקל, אורך והיקף ראש לגיל, 0–24 חודשים.',
    url: 'https://www.who.int/tools/child-growth-standards',
  },
  {
    id: 'aasm',
    title: 'המלצות שינה — AASM, באישור AAP',
    detail: 'Paruthi et al., J Clin Sleep Med 2016. ההמלצות מתחילות מגיל 4 חודשים; לתינוקות צעירים יותר לא נקבעה המלצה.',
    url: 'https://jcsm.aasm.org/doi/full/10.5664/jcsm.5866',
  },
  {
    id: 'cdc',
    title: 'אבני דרך התפתחותיות — CDC',
    detail: '"Learn the Signs. Act Early.", עדכון 2022 (Zubler et al., Pediatrics). מילון האבנים כולל מה ש-75% מהילדים ומעלה עושים בגיל הנתון.',
    url: 'https://www.cdc.gov/act-early/milestones/index.html',
  },
  {
    id: 'aap-diapers',
    title: 'סמן הידרציה — חיתולים רטובים',
    detail: 'הנחיית AAP: 6 חיתולים רטובים ביום ומעלה מהיום החמישי. סימן לבדיקה עצמית, לא מדד רפואי.',
    url: 'https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/default.aspx',
  },
]

export const MEDICAL_DISCLAIMER =
  'הנתונים כאן מתארים את מה שתיעדתם, לצד טווחי ייחוס שפורסמו. זו אינה הערכה רפואית ואינה תחליף לרופא/ת הילדים — הבדלים מהטווח הם לרוב נורמליים לחלוטין, וכל שאלה על הבריאות של הילד/ה שייכת לרופא/ה.'
