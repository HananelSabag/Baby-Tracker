import { useState, useEffect } from 'react'
import { t } from '../../lib/strings'
import { formatTime, formatTimeAgo } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddDiaperForm } from '../forms/AddDiaperForm'
import { Card } from '../ui/Card'

// green < 2h, amber 2–4h, red > 4h
function diaperUrgencyColor(isoDate, now) {
  const hours = (now - new Date(isoDate).getTime()) / 3600000
  if (hours < 2) return '#5BAD6F'
  if (hours < 4) return '#E8B84B'
  return '#E05A4B'
}

const QUICK_TYPES = [
  { key: 'wet',   emoji: '💧', label: 'רטוב' },
  { key: 'dirty', emoji: '💩', label: 'מלוכלך' },
  { key: 'both',  emoji: '✌️', label: 'שניהם' },
]

export function DiaperCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(Date.now())

  // refresh urgency color every minute
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const lastEvent = events[0]
  const wetCount   = events.filter(e => e.data?.type === 'wet').length
  const dirtyCount = events.filter(e => e.data?.type === 'dirty').length
  const bothCount  = events.filter(e => e.data?.type === 'both').length

  async function handleSave(data, occurredAt) {
    setSaving(true)
    try {
      await addEvent({ trackerId: tracker.id, memberId, childId, data, occurredAt: occurredAt.toISOString() })
      setSheetOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // One-tap save with current time
  async function handleQuickSave(type) {
    if (saving) return
    setSaving(true)
    try {
      await addEvent({ trackerId: tracker.id, memberId, childId, data: { type }, occurredAt: new Date().toISOString() })
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
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tracker.icon}</span>
            <span className="font-rubik font-semibold text-brown-800">{tracker.name}</span>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft active:scale-95 transition-transform"
            style={{ backgroundColor: tracker.color }}
          >+</button>
        </div>

        {/* Status — count + last time with urgency color + breakdown */}
        {events.length > 0 && (
          <div className="rounded-2xl px-4 py-2.5 mb-3" style={{ backgroundColor: `${tracker.color}18` }}>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-xs text-brown-500 font-rubik">{t('diaper.todayTotal')}</p>
                <p className="font-rubik font-bold text-brown-800 text-xl leading-tight">
                  {loading ? '...' : events.length}
                </p>
              </div>
              {lastEvent && (
                <div className="text-left">
                  <p className="text-xs text-brown-500 font-rubik">{t('diaper.lastChange')}</p>
                  <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">{formatTime(lastEvent.occurred_at)}</p>
                  <p className="font-rubik text-xs leading-tight" style={{ color: diaperUrgencyColor(lastEvent.occurred_at, now) }}>
                    {formatTimeAgo(lastEvent.occurred_at)} לפני
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 text-xs font-rubik text-brown-500 border-t border-black/5 pt-1.5">
              {wetCount > 0   && <span>🌊 {t('diaper.wet')} ×{wetCount}</span>}
              {dirtyCount > 0 && <span>💩 {t('diaper.dirty')} ×{dirtyCount}</span>}
              {bothCount > 0  && <span>✌️ {t('diaper.both')} ×{bothCount}</span>}
            </div>
          </div>
        )}

        {/* Quick type buttons — 1-tap save with current time */}
        <div className="flex gap-2">
          {QUICK_TYPES.map(({ key, emoji, label }) => (
            <button
              key={key}
              onClick={() => handleQuickSave(key)}
              disabled={saving}
              className="flex-1 flex flex-col items-center justify-center py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-40"
              style={{
                backgroundColor: `${tracker.color}18`,
                border: `1.5px solid ${tracker.color}35`,
              }}
            >
              <span className="text-2xl mb-1 leading-none">{emoji}</span>
              <span className="font-rubik text-xs font-semibold text-brown-700">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title={t('diaper.addChange')}>
        <AddDiaperForm onSave={handleSave} onCancel={() => setSheetOpen(false)} loading={saving} />
      </BottomSheet>
    </>
  )
}
