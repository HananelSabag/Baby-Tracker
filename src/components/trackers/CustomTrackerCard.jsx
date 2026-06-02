import { useState } from 'react'
import { t } from '../../lib/strings'
import { formatTime } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddCustomEventForm } from '../forms/AddCustomEventForm'

export function CustomTrackerCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
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
      <div
        className="bg-white rounded-3xl border border-cream-200 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
        style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        onClick={() => setSheetOpen(true)}
      >
        <div className="h-1 w-full" style={{ backgroundColor: tracker.color }} />
        <div className={compact ? 'p-3' : 'p-5'}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-2xl flex-shrink-0">{tracker.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-rubik font-semibold text-brown-800 truncate">{tracker.name}</p>
                <p className="text-xs text-brown-400 font-rubik truncate">
                  {loading ? '...' : `${events.length} ${t('tracker.events')}`}
                  {lastEvent ? ` · ${formatTime(lastEvent.occurred_at)}` : ''}
                </p>
              </div>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft flex-shrink-0"
              style={{ backgroundColor: tracker.color }}
            >
              +
            </div>
          </div>
        </div>
      </div>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={tracker.name}>
        <AddCustomEventForm tracker={tracker} onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
      </BottomSheet>
    </>
  )
}
