import { useState } from 'react'
import { t } from '../../lib/strings'
import { formatTime } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddCustomEventForm } from '../forms/AddCustomEventForm'
import { Card } from '../ui/Card'

export function CustomTrackerCard({ tracker, familyId, memberId, childId, viewDate }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const lastEvent = events[0]

  async function handleSave(data, occurredAt) {
    setSaving(true)
    try {
      await addEvent({ trackerId: tracker.id, memberId, childId, data, occurredAt: occurredAt.toISOString() })
      setSheetOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card className="cursor-pointer" onClick={() => setSheetOpen(true)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tracker.icon}</span>
            <div>
              <p className="font-rubik font-semibold text-brown-800">{tracker.name}</p>
              <p className="text-xs text-brown-400 font-rubik">
                {loading ? '...' : `${events.length} ${t('tracker.events')}`}
                {lastEvent ? ` · ${formatTime(lastEvent.occurred_at)}` : ''}
              </p>
            </div>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft"
            style={{ backgroundColor: tracker.color }}
          >
            +
          </div>
        </div>
      </Card>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={tracker.name}>
        <AddCustomEventForm tracker={tracker} onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
      </BottomSheet>
    </>
  )
}
