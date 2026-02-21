import { useState } from 'react'
import { t } from '../../lib/strings'
import { formatTime, formatTimeAgo, formatMl } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { useApp } from '../../hooks/useAppContext'
import { BottomSheet } from '../ui/BottomSheet'
import { AddFeedingForm } from '../forms/AddFeedingForm'
import { Card } from '../ui/Card'
import { TRACKER_TYPES } from '../../lib/constants'

export function FeedingCard({ tracker, familyId, memberId }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, days: 1 })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const todayTotal = events.reduce((sum, e) => sum + (e.data?.amount_ml ?? 0), 0)
  const lastEvent = events[0]

  async function handleSave(data, occurredAt) {
    setSaving(true)
    try {
      await addEvent({ trackerId: tracker.id, memberId, data, occurredAt: occurredAt.toISOString() })
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

        <div className="grid grid-cols-3 gap-3">
          <StatBox label={t('home.totalMl')} value={loading ? '...' : formatMl(todayTotal)} color={tracker.color} />
          <StatBox label={t('home.feedings')} value={loading ? '...' : events.length} color={tracker.color} />
          <StatBox
            label={t('home.lastFeeding')}
            value={lastEvent ? formatTime(lastEvent.occurred_at) : '—'}
            sub={lastEvent ? `${formatTimeAgo(lastEvent.occurred_at)} ${t('home.ago')}` : t('home.noFeedingYet')}
            color={tracker.color}
          />
        </div>
      </Card>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={t('feeding.addFeeding')}>
        <AddFeedingForm onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
      </BottomSheet>
    </>
  )
}

function StatBox({ label, value, sub, color }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: `${color}18` }}>
      <p className="text-xs text-brown-500 font-rubik mb-1">{label}</p>
      <p className="font-rubik font-bold text-brown-800 text-sm leading-tight">{value}</p>
      {sub && <p className="text-xs text-brown-400 mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}
