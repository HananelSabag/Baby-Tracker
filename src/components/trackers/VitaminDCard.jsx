import { useState } from 'react'
import { t } from '../../lib/strings'
import { useEvents } from '../../hooks/useEvents'
import { Card } from '../ui/Card'
import { cn } from '../../lib/utils'

// Dose slot emojis: morning, noon, evening, night
const DOSE_EMOJIS = ['☀️', '🌅', '🌙', '⭐']

export function VitaminDCard({ tracker, familyId, memberId, childId, viewDate }) {
  const { events, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  // pendingKeys: optimistic update — marks a dose as "done" instantly on tap,
  // before the DB round-trip + realtime update arrives. Prevents double-tapping.
  const [pendingKeys, setPendingKeys] = useState(new Set())

  // Read dose config from tracker, fallback to defaults
  const config = tracker.config ?? {}
  const doseCount = config.daily_doses ?? 2
  const doseLabels = config.dose_labels ?? ['בוקר', 'ערב']

  // Build dose slots array from config
  const doses = Array.from({ length: doseCount }, (_, i) => ({
    key: String(i),
    label: doseLabels[i] ?? `מינון ${i + 1}`,
    emoji: DOSE_EMOJIS[i] ?? '💊',
  }))

  // Which doses are confirmed from DB
  const confirmedKeys = new Set(events.map(e => String(e.data?.dose_index ?? e.data?.dose)))
  // Combined: confirmed + optimistic pending — used for all UI decisions
  const givenKeys = new Set([...confirmedKeys, ...pendingKeys])

  async function handleDose(doseKey, doseLabel) {
    if (givenKeys.has(doseKey)) return // already done (confirmed or pending)
    // Mark as done immediately (optimistic) to block any rapid re-taps
    setPendingKeys(prev => new Set([...prev, doseKey]))
    try {
      await addEvent({
        trackerId: tracker.id,
        memberId,
        childId,
        data: { dose_index: doseKey, dose_label: doseLabel },
        occurredAt: new Date().toISOString(),
      })
    } catch {
      // Rollback optimistic update on failure
      setPendingKeys(prev => { const n = new Set(prev); n.delete(doseKey); return n })
    }
  }

  const allDone = doses.every(d => givenKeys.has(d.key))

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tracker.icon}</span>
          <span className="font-rubik font-semibold text-brown-800">{tracker.name}</span>
        </div>
        {allDone && (
          <span className="text-xs font-rubik font-medium bg-tracker-vitaminD/20 text-amber-700 px-3 py-1 rounded-full">
            הכל ניתן ✓
          </span>
        )}
      </div>

      <div className={cn('grid gap-2', doses.length === 1 ? 'grid-cols-1' : doses.length === 2 ? 'grid-cols-2' : doses.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {doses.map(dose => {
          const done = givenKeys.has(dose.key)
          const isPending = pendingKeys.has(dose.key) && !confirmedKeys.has(dose.key)
          return (
            <button
              key={dose.key}
              onClick={() => handleDose(dose.key, dose.label)}
              disabled={done}
              className={cn(
                'flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95',
                done ? 'opacity-100' : 'opacity-60 hover:opacity-80',
              )}
              style={{ backgroundColor: done ? tracker.color : `${tracker.color}22` }}
            >
              <span className="text-2xl">{dose.emoji}</span>
              <span className={cn('text-sm font-rubik font-semibold', done ? 'text-white' : 'text-brown-700')}>
                {dose.label}
              </span>
              <span className={cn('text-xs font-rubik', done ? 'text-white/80' : 'text-brown-400')}>
                {isPending ? '...' : done ? t('vitaminD.done') : t('vitaminD.notDone')}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
