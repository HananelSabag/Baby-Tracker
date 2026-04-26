import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { he } from 'date-fns/locale'

// Generate a random 6-character uppercase family code
export function generateFamilyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Generate a unique device token
export function generateDeviceToken() {
  return `dt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

// Format time as HH:mm
export function formatTime(date) {
  return format(new Date(date), 'HH:mm')
}

// Format date label for history grouping
export function formatDateLabel(date) {
  const d = new Date(date)
  if (isToday(d)) return 'היום'
  if (isYesterday(d)) return 'אתמול'
  return format(d, 'EEEE, d בMMMM', { locale: he })
}

// Time since last event (human-readable Hebrew)
export function formatTimeAgo(date) {
  return formatDistanceToNow(new Date(date), { locale: he, addSuffix: false })
}

// Format ml amount
export function formatMl(amount) {
  return `${amount} מ"ל`
}

// Group events array by day (returns Map of dateLabel -> events[])
export function groupEventsByDay(events) {
  const groups = new Map()
  events.forEach(event => {
    const label = formatDateLabel(event.occurred_at)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push(event)
  })
  return groups
}

// Merge class names conditionally
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// Safe back navigation — goes back in history if possible, otherwise navigates to fallback
export function goBack(navigate, fallback = '/') {
  if (window.history.length > 1) {
    navigate(-1)
  } else {
    navigate(fallback, { replace: true })
  }
}

// Hebrew age formatter for a baby's birth_date.
//
// Display rules (per Hananel):
//   • Under 1 year: months + remaining-weeks (e.g. "3 חודשים ו-2 שבועות").
//     A child <1 month old is shown in weeks only.
//   • 1 year exactly: "שנה" (or "שנה ו-X חודשים").
//   • 1+ years: years + months, no weeks (weeks are noise at that age).
//
// Returns null when birthDate is missing/invalid so callers can skip rendering.
export function formatAge(birthDate, asOf = new Date()) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null

  const now = asOf instanceof Date ? asOf : new Date(asOf)
  if (now < birth) return null

  // Whole years (calendar-aware)
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  let days = now.getDate() - birth.getDate()
  if (days < 0) {
    months -= 1
    // borrow days from the previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  // ── 1+ year old: years + months only (no weeks). ────────────────────────────
  if (years >= 1) {
    const yPart = years === 1 ? 'שנה' : `${years} שנים`
    if (months === 0) return yPart
    const mPart = months === 1 ? 'חודש' : `${months} חודשים`
    return `${yPart} ו-${mPart}`
  }

  // ── Under 1 year: months + remaining weeks. ─────────────────────────────────
  // months here is whole calendar months (0..11). Compute remaining weeks
  // from the leftover days within the partial month.
  const weeks = Math.floor(days / 7)

  if (months === 0) {
    // Newborn / first month
    if (weeks === 0) return days <= 1 ? 'יום' : `${days} ימים`
    return weeks === 1 ? 'שבוע' : `${weeks} שבועות`
  }

  const mPart = months === 1 ? 'חודש' : `${months} חודשים`
  if (weeks === 0) return mPart
  const wPart = weeks === 1 ? 'שבוע' : `${weeks} שבועות`
  return `${mPart} ו-${wPart}`
}
