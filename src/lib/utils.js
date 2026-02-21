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
