import { useState, useEffect, useMemo } from 'react'
import { TRACKER_TYPES } from '../../lib/constants'
import { formatTime, formatTimeAgo, formatMl, cn } from '../../lib/utils'

const DOSE_EMOJIS = ['☀️', '🌅', '🌙', '⭐']

function formatDur(ms) {
  if (ms < 0) ms = 0
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}:${String(m).padStart(2, '0')} שע'`
  if (h > 0) return `${h} שע'`
  return `${m} דק'`
}

function getSleepStats(events, now) {
  const sorted = [...events].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
  const sessions = []
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].data?.type === 'start') {
      const end = sorted[i + 1]?.data?.type === 'end' ? sorted[i + 1] : null
      sessions.push({ start: sorted[i], end })
      if (end) i++
    }
  }
  const isSleeping = sessions.length > 0 && sessions[sessions.length - 1].end === null
  const currentMs = isSleeping ? now - new Date(sessions[sessions.length - 1].start.occurred_at).getTime() : 0
  const totalMs = sessions.reduce((sum, s) => {
    if (s.end) return sum + (new Date(s.end.occurred_at) - new Date(s.start.occurred_at))
    return sum + currentMs
  }, 0)
  return { isSleeping, totalMs }
}

function TrackerChip({ tracker, events, now }) {
  const type = tracker.tracker_type
  const last = events[0]
  let label

  if (type === TRACKER_TYPES.VITAMIN_D || (type === TRACKER_TYPES.DOSE && tracker.config?.display_mode !== 'simple')) {
    const doseCount = tracker.config?.daily_doses ?? 2
    const given = new Set(events.map(e => String(e.data?.dose_index ?? e.data?.dose)))
    const allDone = given.size >= doseCount
    label = (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: doseCount }, (_, i) => (
          <span key={i} className={cn('text-xs', given.has(String(i)) ? 'opacity-100' : 'opacity-20')}>
            {DOSE_EMOJIS[i] ?? '💊'}
          </span>
        ))}
        {allDone && <span className="font-rubik text-xs text-amber-600 font-semibold mr-0.5">✓</span>}
      </span>
    )
  } else if (type === TRACKER_TYPES.DIAPER) {
    label = last
      ? <span className="font-rubik text-xs text-brown-600">{formatTime(last.occurred_at)} · {events.length}×</span>
      : <span className="font-rubik text-xs text-brown-300">עדיין לא</span>
  } else if (type === TRACKER_TYPES.SLEEP) {
    const { isSleeping, totalMs } = getSleepStats(events, now)
    label = isSleeping
      ? <span className="font-rubik text-xs font-semibold" style={{ color: tracker.color }}>ישן · {formatDur(totalMs)}</span>
      : totalMs > 0
        ? <span className="font-rubik text-xs text-brown-600">{formatDur(totalMs)} שינה</span>
        : <span className="font-rubik text-xs text-brown-300">לא ישן</span>
  } else if (type === TRACKER_TYPES.GROWTH) {
    const w = last?.data?.weight_kg
    const h = last?.data?.height_cm
    label = w != null
      ? <span className="font-rubik text-xs text-brown-600">{parseFloat(w)} ק"ג</span>
      : h != null
        ? <span className="font-rubik text-xs text-brown-600">{parseFloat(h)} ס"מ</span>
        : <span className="font-rubik text-xs text-brown-300">—</span>
  } else {
    label = last
      ? <span className="font-rubik text-xs text-brown-600">{events.length}×</span>
      : <span className="font-rubik text-xs text-brown-300">—</span>
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-2xl px-2.5 py-2"
      style={{ backgroundColor: `${tracker.color}18` }}
    >
      <span className="text-base flex-shrink-0">{tracker.icon}</span>
      <div className="min-w-0">
        <p className="font-rubik text-xs text-brown-400 leading-tight">{tracker.name}</p>
        <div className="leading-tight">{label}</div>
      </div>
    </div>
  )
}

function SmartStatusLine({ trackers, eventsByTracker, now }) {
  for (const tr of trackers) {
    if (tr.tracker_type === TRACKER_TYPES.SLEEP) {
      const { isSleeping, totalMs } = getSleepStats(eventsByTracker[tr.id] ?? [], now)
      if (isSleeping) {
        return (
          <div className="px-4 pb-3 pt-2 border-t border-cream-100">
            <p className="font-rubik text-xs text-center" style={{ color: tr.color }}>
              😴 הבייבי ישן כבר {formatDur(totalMs)}
            </p>
          </div>
        )
      }
    }
    if (tr.tracker_type === TRACKER_TYPES.VITAMIN_D || tr.tracker_type === TRACKER_TYPES.DOSE) {
      if (tr.config?.display_mode === 'simple') continue
      const doseCount = tr.config?.daily_doses ?? 2
      if (doseCount < 1) continue
      const given = new Set((eventsByTracker[tr.id] ?? []).map(e => String(e.data?.dose_index ?? e.data?.dose)))
      if (given.size >= doseCount) {
        return (
          <div className="px-4 pb-3 pt-2 border-t border-cream-100">
            <p className="font-rubik text-xs text-amber-600 text-center">☀️ {tr.name} הושלם — כל הכבוד!</p>
          </div>
        )
      }
    }
  }
  return null
}

export function HeroCard({ trackers, eventsByTracker, isToday }) {
  const [now, setNow] = useState(Date.now())

  const feedingTracker = trackers.find(t => t.tracker_type === TRACKER_TYPES.FEEDING)
  const feedingEvents = feedingTracker ? (eventsByTracker[feedingTracker.id] ?? []) : []
  const otherTrackers = trackers.filter(t => t.tracker_type !== TRACKER_TYPES.FEEDING)

  const lastFeeding = feedingEvents[0]
  const totalMl = feedingEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)

  const anySleeping = useMemo(() => {
    for (const tr of trackers) {
      if (tr.tracker_type !== TRACKER_TYPES.SLEEP) continue
      const { isSleeping } = getSleepStats(eventsByTracker[tr.id] ?? [], Date.now())
      if (isSleeping) return true
    }
    return false
  }, [trackers, eventsByTracker])

  useEffect(() => {
    const interval = anySleeping ? 1000 : 30000
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [anySleeping])

  return (
    <div className="bg-white rounded-3xl shadow-card overflow-hidden mb-3">

      {/* Header — warm gradient with prominent feeding section */}
      <div className="px-4 pt-4 pb-4" style={{ background: 'linear-gradient(145deg, #FFFBF5 0%, #FFF3E0 100%)' }}>
        <p className="font-rubik font-bold text-brown-600 text-sm mb-3">📊 סיכום היום</p>

        {feedingTracker ? (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: `${feedingTracker.color}18` }}>
            {lastFeeding ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-brown-500 font-rubik mb-0.5">האכלה אחרונה</p>
                  <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">
                    {formatTime(lastFeeding.occurred_at)}
                  </p>
                  <p className="text-xs text-brown-400 font-rubik mt-0.5">
                    {formatTimeAgo(lastFeeding.occurred_at)} לפני · {feedingEvents.length} ארוחות
                  </p>
                </div>
                {totalMl > 0 && (
                  <div className="text-center">
                    <p className="font-rubik font-bold text-3xl leading-tight" style={{ color: feedingTracker.color }}>
                      {totalMl}
                    </p>
                    <p className="text-xs text-brown-400 font-rubik">מ"ל</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-brown-400 font-rubik text-sm text-center py-1">עדיין אין האכלות היום</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Chips row for the rest of the trackers */}
      {otherTrackers.length > 0 && (
        <div className="px-4 py-3 border-t border-cream-100 flex flex-wrap gap-2">
          {otherTrackers.map(tr => (
            <TrackerChip
              key={tr.id}
              tracker={tr}
              events={eventsByTracker[tr.id] ?? []}
              now={now}
            />
          ))}
        </div>
      )}

      {isToday && <SmartStatusLine trackers={trackers} eventsByTracker={eventsByTracker} now={now} />}
    </div>
  )
}
