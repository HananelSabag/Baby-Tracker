import { useState } from 'react'
import { t } from '../../lib/strings'
import { useEvents } from '../../hooks/useEvents'
import { Card } from '../ui/Card'
import { cn } from '../../lib/utils'

const DOSES = [
  { key: 'morning', label: t('vitaminD.morning'), emoji: '🌅' },
  { key: 'evening', label: t('vitaminD.evening'), emoji: '🌙' },
]

export function VitaminDCard({ tracker, familyId, memberId }) {
  const { events, addEvent } = useEvents(familyId, { trackerId: tracker.id, days: 1 })
  const [saving, setSaving] = useState(null)

  const givenDoses = new Set(events.map(e => e.data?.dose))

  async function handleDose(dose) {
    if (givenDoses.has(dose) || saving) return
    setSaving(dose)
    try {
      await addEvent({
        trackerId: tracker.id,
        memberId,
        data: { dose },
        occurredAt: new Date().toISOString(),
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{tracker.icon}</span>
        <span className="font-rubik font-semibold text-brown-800">{tracker.name}</span>
      </div>

      <div className="flex gap-3">
        {DOSES.map(dose => {
          const done = givenDoses.has(dose.key)
          const isSaving = saving === dose.key
          return (
            <button
              key={dose.key}
              onClick={() => handleDose(dose.key)}
              disabled={done || isSaving}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95',
                done ? 'opacity-100' : 'opacity-60 hover:opacity-80',
              )}
              style={{ backgroundColor: done ? tracker.color : `${tracker.color}20` }}
            >
              <span className="text-2xl">{dose.emoji}</span>
              <span className={cn('text-sm font-rubik font-semibold', done ? 'text-white' : 'text-brown-700')}>
                {dose.label}
              </span>
              <span className={cn('text-xs font-rubik', done ? 'text-white/80' : 'text-brown-400')}>
                {isSaving ? '...' : done ? t('vitaminD.done') : t('vitaminD.notDone')}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
