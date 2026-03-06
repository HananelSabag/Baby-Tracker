import { useState } from 'react'
import { t } from '../../lib/strings'
import { formatTime } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddDiaperForm } from '../forms/AddDiaperForm'
import { Card } from '../ui/Card'

export function DiaperCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const lastEvent = events[0]
  const wetCount = events.filter(e => e.data?.type === 'wet').length
  const dirtyCount = events.filter(e => e.data?.type === 'dirty').length
  const bothCount = events.filter(e => e.data?.type === 'both').length

  async function handleSave(data, occurredAt) {
    setSaving(true)
    try {
      await addEvent({ trackerId: tracker.id, memberId, childId, data, occurredAt: occurredAt.toISOString() })
      setSheetOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (compact) {
    return (
      <>
        <Card compact className="cursor-pointer" onClick={() => setSheetOpen(true)}>
          <div className="flex items-center gap-3">
            <span className="text-xl flex-shrink-0">{tracker.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-rubik font-semibold text-brown-800 text-sm">{tracker.name}</p>
              <p className="font-rubik text-xs text-brown-400">
                {lastEvent ? `${formatTime(lastEvent.occurred_at)} · ${events.length}×` : 'אין עדיין'}
              </p>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft flex-shrink-0"
              style={{ backgroundColor: tracker.color }}
            >+</div>
          </div>
        </Card>
        <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={t('diaper.addChange')}>
          <AddDiaperForm onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
        </BottomSheet>
      </>
    )
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

        <div className="rounded-2xl px-4 py-2" style={{ backgroundColor: `${tracker.color}18` }}>
          {/* Total + last change */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-brown-500 font-rubik">{t('diaper.todayTotal')}</p>
              <p className="font-rubik font-bold text-brown-800 text-xl leading-tight">
                {loading ? '...' : events.length}
              </p>
            </div>
            {lastEvent && (
              <div className="text-center">
                <p className="text-xs text-brown-500 font-rubik">{t('diaper.lastChange')}</p>
                <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">{formatTime(lastEvent.occurred_at)}</p>
              </div>
            )}
          </div>

          {/* Breakdown by type */}
          {events.length > 0 && (
            <div className="flex gap-3 text-xs font-rubik text-brown-500 border-t border-black/5 pt-2">
              {wetCount > 0 && <span>🌊 {t('diaper.wet')} ×{wetCount}</span>}
              {dirtyCount > 0 && <span>💩 {t('diaper.dirty')} ×{dirtyCount}</span>}
              {bothCount > 0 && <span>✌️ {t('diaper.both')} ×{bothCount}</span>}
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
