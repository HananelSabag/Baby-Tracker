import { useState, useEffect } from 'react'
import { isSameDay } from 'date-fns'
import { useEvents } from '../../hooks/useEvents'
import { Card } from '../ui/Card'
import { cn } from '../../lib/utils'
import { resolveDoses, givenDoseKeys } from '../../lib/doseConfig'

export function VitaminDCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
  const { events, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  // pendingKeys: optimistic update — marks a dose as "done" instantly on tap,
  // before the DB round-trip + realtime update arrives. Prevents double-tapping.
  const [pendingKeys, setPendingKeys] = useState(new Set())

  // A dose is always stamped with the current clock time, so tapping only makes
  // sense while looking at today.
  const isViewingToday = !viewDate || isSameDay(viewDate, new Date())

  // Optimistic marks belong to one day + one child. Without this reset they
  // leaked across the day navigator and showed yesterday's doses as "given".
  const dayKey = viewDate ? viewDate.toDateString() : 'today'
  useEffect(() => { setPendingKeys(new Set()) }, [dayKey, childId, tracker.id])

  const config = tracker.config ?? {}
  // Slots come from the shared resolver so this card, the hero chip and the
  // notifications screen can never show different emoji for the same dose.
  const doses = resolveDoses(tracker)

  // Which doses are confirmed from DB
  const confirmedKeys = givenDoseKeys(events)
  // Combined: confirmed + optimistic pending — used for all UI decisions
  const givenKeys = new Set([...confirmedKeys, ...pendingKeys])

  async function handleDose(doseKey, doseLabel) {
    if (!isViewingToday) return // read-only on past days — see isViewingToday
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

  if (compact) {
    return (
      <Card compact>
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">{tracker.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-rubik font-semibold text-brown-800 text-sm truncate leading-tight">{tracker.name}</p>
            {config.note && (
              <p className="font-rubik text-[10px] text-brown-400 truncate leading-tight">{config.note}</p>
            )}
          </div>
          {allDone && <span className="text-xs font-rubik font-medium text-amber-600">✓</span>}
          <div className="flex gap-1.5 flex-shrink-0">
            {doses.map(dose => {
              const done = givenKeys.has(dose.key)
              const isPending = pendingKeys.has(dose.key) && !confirmedKeys.has(dose.key)
              return (
                <button
                  key={dose.key}
                  onClick={() => handleDose(dose.key, dose.label)}
                  disabled={done || !isViewingToday}
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all active:scale-95',
                    done ? 'opacity-100' : 'opacity-40 hover:opacity-70',
                  )}
                  style={{ backgroundColor: done ? tracker.color : `${tracker.color}22` }}
                >
                  {isPending ? '⏳' : dose.emoji}
                </button>
              )
            })}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl flex-shrink-0">{tracker.icon}</span>
          <div>
            <p className="font-rubik font-semibold text-brown-800 leading-tight">{tracker.name}</p>
            {config.note && (
              <p className="font-rubik text-xs text-brown-400 leading-tight mt-0.5">{config.note}</p>
            )}
          </div>
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
              disabled={done || !isViewingToday}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 rounded-2xl transition-all active:scale-95',
                done ? 'opacity-100' : isViewingToday ? 'opacity-60 hover:opacity-80' : 'opacity-35',
              )}
              style={{ backgroundColor: done ? tracker.color : `${tracker.color}22` }}
            >
              <span className="text-xl">{isPending ? '⏳' : dose.emoji}</span>
              <span className={cn('text-sm font-rubik font-semibold', done ? 'text-white' : 'text-brown-700')}>
                {dose.label}
              </span>
              <span className={cn('text-xs font-rubik', done ? 'text-white/80' : 'text-brown-400')}>
                {done ? 'ניתן' : 'לא ניתן'}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
