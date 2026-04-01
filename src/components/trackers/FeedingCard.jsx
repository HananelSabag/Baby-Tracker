import { useState } from 'react'
import { t } from '../../lib/strings'
import { formatMl } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddFeedingForm } from '../forms/AddFeedingForm'
import { Card } from '../ui/Card'
import { FEEDING_PRESETS } from '../../lib/constants'

export function FeedingCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const todayTotal = events.reduce((sum, e) => sum + (e.data?.amount_ml ?? 0), 0)

  async function handleSave(data, occurredAt) {
    setSaving(true)
    try {
      await addEvent({ trackerId: tracker.id, memberId, childId, data, occurredAt: occurredAt.toISOString() })
      setSheetOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // One-tap save with current time — no sheet needed
  async function handleQuickSave(ml) {
    if (saving) return
    setSaving(true)
    try {
      await addEvent({ trackerId: tracker.id, memberId, childId, data: { amount_ml: ml }, occurredAt: new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  if (compact) {
    return (
      <>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{tracker.icon}</span>
              <span className="font-rubik font-semibold text-brown-800 text-sm">{tracker.name}</span>
            </div>
            <button
              onClick={() => setSheetOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft active:scale-95 transition-transform"
              style={{ backgroundColor: tracker.color }}
            >+</button>
          </div>
          {events.length > 0 ? (
            <div className="flex gap-2">
              {todayTotal > 0 && (
                <div className="flex-1 rounded-xl px-3 py-2.5 text-center bg-cream-100">
                  <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">{todayTotal}</p>
                  <p className="font-rubik text-brown-400 text-xs">{t('feeding.ml')}</p>
                </div>
              )}
              <div className="flex-1 rounded-xl px-3 py-2.5 text-center bg-cream-100">
                <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">{events.length}</p>
                <p className="font-rubik text-brown-400 text-xs">{t('home.feedings')}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSheetOpen(true)}
              className="w-full py-2 text-brown-400 font-rubik text-sm text-center active:opacity-70"
            >
              {t('home.noFeedingYet')}
            </button>
          )}
        </Card>
        <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={t('feeding.addFeeding')}>
          <AddFeedingForm onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
        </BottomSheet>
      </>
    )
  }

  return (
    <>
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tracker.icon}</span>
            <span className="font-rubik font-semibold text-brown-800">{tracker.name}</span>
          </div>
          {/* "+" opens sheet for custom amount / time adjustment */}
          <button
            onClick={() => setSheetOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft active:scale-95 transition-transform"
            style={{ backgroundColor: tracker.color }}
          >+</button>
        </div>

        {/* Quick preset buttons — 1-tap save with current time */}
        <div className="flex gap-1.5 mb-3">
          {FEEDING_PRESETS.map(ml => (
            <button
              key={ml}
              onClick={() => handleQuickSave(ml)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-rubik font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
              style={{
                backgroundColor: `${tracker.color}1A`,
                color: tracker.color,
                border: `1.5px solid ${tracker.color}45`,
              }}
            >
              {ml}
            </button>
          ))}
        </div>

        {/* Today's totals */}
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
