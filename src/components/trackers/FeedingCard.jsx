import { useState } from 'react'
import { t } from '../../lib/strings'
import { formatTime, formatTimeAgo, formatMl } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddFeedingForm } from '../forms/AddFeedingForm'
import { Card } from '../ui/Card'

export function FeedingCard({ tracker, familyId, memberId, childId, viewDate }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const todayTotal = events.reduce((sum, e) => sum + (e.data?.amount_ml ?? 0), 0)
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
        {/* Header */}
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

        {/* Last feeding — primary info */}
        <div className="rounded-2xl px-4 py-3 mb-2" style={{ backgroundColor: `${tracker.color}18` }}>
          {lastEvent ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brown-500 font-rubik mb-0.5">{t('home.lastFeeding')}</p>
                <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">{formatTime(lastEvent.occurred_at)}</p>
                <p className="text-xs text-brown-400 font-rubik mt-0.5">{formatTimeAgo(lastEvent.occurred_at)} {t('home.ago')}</p>
              </div>
              {lastEvent.data?.amount_ml ? (
                <div className="text-center">
                  <p className="font-rubik font-bold text-3xl leading-tight" style={{ color: tracker.color }}>
                    {lastEvent.data.amount_ml}
                  </p>
                  <p className="text-xs text-brown-400 font-rubik">{t('feeding.ml')}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-brown-400 font-rubik text-sm text-center py-1">{t('home.noFeedingYet')}</p>
          )}
        </div>

        {/* Today's totals — secondary */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl px-3 py-2 text-center bg-cream-100">
            <p className="text-xs text-brown-400 font-rubik">{t('home.totalMl')}</p>
            <p className="font-rubik font-semibold text-brown-700 text-sm">{loading ? '...' : formatMl(todayTotal)}</p>
          </div>
          <div className="flex-1 rounded-xl px-3 py-2 text-center bg-cream-100">
            <p className="text-xs text-brown-400 font-rubik">{t('home.feedings')}</p>
            <p className="font-rubik font-semibold text-brown-700 text-sm">{loading ? '...' : events.length}</p>
          </div>
        </div>
      </Card>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={t('feeding.addFeeding')}>
        <AddFeedingForm onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
      </BottomSheet>
    </>
  )
}
