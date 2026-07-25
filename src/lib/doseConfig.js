// Everything about how a dose tracker is configured and displayed.
//
// This used to live in four places at once. `HeroCard`, `VitaminDCard`,
// `ControlCenterPage` and `NotificationsPage` each declared their own fallback
// emoji list — in three different orders — so the *same* dose rendered a
// different icon depending on which screen you were looking at. Each also
// rebuilt the "slots" array from tracker.config with slightly different
// fallbacks.
//
// One module, one set of rules. Views render what resolveDoses returns.

export const MAX_DOSES = 6

export const DOSE_DEFAULT_LABELS = [
  'בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם',
]

// Positionally aligned with DOSE_DEFAULT_LABELS above, and with the semantic
// mapping in autoEmojiForLabel. The old positional list disagreed with both —
// it paired "צהריים" with 🌅 and "לילה" with 🌤.
export const DOSE_DEFAULT_EMOJIS = ['☀️', '🌙', '🌤', '⭐', '🌅', '💫']

// Options offered in the emoji picker when configuring a dose.
export const DOSE_TIME_EMOJIS = [
  '☀️', '🌤', '🌅', '🌙', '⭐', '💫', '🌛', '🌞', '💊', '🕐', '🌿', '🍃',
]

/** Suggest an emoji from what the user typed as the dose name. */
export function autoEmojiForLabel(label) {
  if (!label) return null
  if (label.includes('בוקר')) return '☀️'
  if (label.includes('ערב'))  return '🌙'
  if (label.includes('צהר'))  return '🌤'
  if (label.includes('לילה')) return '⭐'
  if (label.includes('שחר'))  return '🌅'
  return null
}

/**
 * Grow/shrink a stored array to exactly `count` entries, filling blanks from
 * the defaults. A tracker saved with two doses only stores two labels, so
 * raising the count later would otherwise leave unnamed slots.
 */
export function padToCount(values, count, defaults) {
  return Array.from({ length: count }, (_, i) => {
    const v = values?.[i]
    return (typeof v === 'string' && v.trim()) ? v : defaults[i % defaults.length]
  })
}

/**
 * The display slots for a dose tracker: one entry per daily dose, each with a
 * stable key, a label and an emoji. Every view uses this, so they cannot drift.
 *
 * @returns {{ key: string, label: string, emoji: string }[]}
 */
export function resolveDoses(tracker) {
  const config = tracker?.config ?? {}
  const count = clampCount(config.daily_doses)
  const labels = padToCount(config.dose_labels, count, DOSE_DEFAULT_LABELS)
  const emojis = padToCount(config.dose_emojis, count, DOSE_DEFAULT_EMOJIS)
  return Array.from({ length: count }, (_, i) => ({
    key: String(i),
    label: labels[i],
    emoji: emojis[i],
  }))
}

function clampCount(n) {
  const parsed = Number(n)
  if (!Number.isFinite(parsed)) return 2
  return Math.min(MAX_DOSES, Math.max(1, Math.floor(parsed)))
}

/**
 * Which dose slots are already recorded, from that tracker's events.
 *
 * Reads both `dose_index` (current) and `dose` (older rows) and normalises to
 * a string key, because the two write paths historically stored a number and a
 * string for the same thing.
 */
export function givenDoseKeys(events) {
  return new Set((events ?? []).map(e => String(e.data?.dose_index ?? e.data?.dose)))
}

/** Does this tracker render as dose buttons, or as a single simple stamp? */
export function isButtonDoseTracker(tracker) {
  const type = tracker?.tracker_type
  if (type === 'vitamin_d') return true
  return type === 'dose' && tracker?.config?.display_mode !== 'simple'
}
