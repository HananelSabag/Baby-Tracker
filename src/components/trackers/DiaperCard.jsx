import { useState } from 'react'
import { t } from '../../lib/strings'
import { formatTime } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddDiaperForm } from '../forms/AddDiaperForm'
import { Card } from '../ui/Card'

const DIAPER_LABELS = {
  wet: t('diaper.wet'),
  dirty: t('diaper.dirty'),
  both: t('diaper.both'),
}

export function DiaperCard({ tracker, familyId, memberId, childId }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, days: 1, childId })
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tracker.icon}</span>
            <span className="font-rubik font-semibold text-brown-800">{tracker.name}</span>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft"
            style={{ backgroundColor: tracker.color }}
          >
            +
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl px-4 py-3 flex-1 text-center" style={{ backgroundColor: `${tracker.color}18` }}>
            <p className="text-xs text-brown-500 font-rubik mb-0.5">היום</p>
            <p className="font-rubik font-bold text-brown-800">{loading ? '...' : events.length} החלפות</p>
          </div>
          {lastEvent && (
            <div className="rounded-2xl px-4 py-3 flex-1 text-center" style={{ backgroundColor: `${tracker.color}18` }}>
              <p className="text-xs text-brown-500 font-rubik mb-0.5">אחרון</p>
              <p className="font-rubik font-bold text-brown-800">{formatTime(lastEvent.occurred_at)}</p>
              <p className="text-xs text-brown-400">{DIAPER_LABELS[lastEvent.data?.type] ?? ''}</p>
            </div>
          )}
        </div>
      </Card>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={t('diaper.addChange')}>
        <AddDiaperForm onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
      </BottomSheet>
    </>
  )
}
