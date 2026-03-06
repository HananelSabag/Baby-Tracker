import { useState, useEffect } from 'react'
import { isToday, isYesterday } from 'date-fns'
import { t } from '../../lib/strings'
import { formatTime, formatTimeAgo, formatMl } from '../../lib/utils'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { AddFeedingForm } from '../forms/AddFeedingForm'
import { Card } from '../ui/Card'
import { supabase } from '../../lib/supabase'

export function FeedingCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastEverEvent, setLastEverEvent] = useState(null)

  // Fetch the most recent feeding ever (no date filter) — used as fallback when no feedings today
  useEffect(() => {
    if (!familyId || !tracker?.id) return
    let query = supabase.from('events')
      .select('*')
      .eq('family_id', familyId)
      .eq('tracker_id', tracker.id)
      .order('occurred_at', { ascending: false })
      .limit(1)
    if (childId) query = query.or(`child_id.eq.${childId},child_id.is.null`)
    query.then(({ data }) => setLastEverEvent(data?.[0] ?? null))
  }, [familyId, tracker?.id, childId, events.length])

  const todayTotal = events.reduce((sum, e) => sum + (e.data?.amount_ml ?? 0), 0)
  const lastEvent = events[0]
  // When viewing today and there are no feedings yet, fall back to the last feeding ever
  const displayEvent = lastEvent ?? (isToday(viewDate) ? lastEverEvent : null)

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
        <Card>
          {/* Header */}
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

          {/* Daily summary stats */}
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
          {displayEvent ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brown-500 font-rubik mb-0.5">{t('home.lastFeeding')}</p>
                <div className="flex items-center gap-2">
                  <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">{formatTime(displayEvent.occurred_at)}</p>
                  {!isToday(new Date(displayEvent.occurred_at)) && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-rubik px-2 py-0.5 rounded-full">
                      {isYesterday(new Date(displayEvent.occurred_at)) ? t('home.yesterday') : t('home.earlier')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-brown-400 font-rubik mt-0.5">{formatTimeAgo(displayEvent.occurred_at)} {t('home.ago')}</p>
              </div>
              {displayEvent.data?.amount_ml ? (
                <div className="text-center">
                  <p className="font-rubik font-bold text-3xl leading-tight" style={{ color: tracker.color }}>
                    {displayEvent.data.amount_ml}
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
