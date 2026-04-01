import { useState, useEffect, useMemo } from 'react'
import { isToday as isTodayFn, isYesterday } from 'date-fns'
import { TRACKER_TYPES } from '../../lib/constants'
import { formatTime, formatTimeAgo, cn } from '../../lib/utils'
import { ageInMonths, getWeightPercentileLabel, getHeightPercentileLabel } from '../../lib/whoGrowthData'
import { supabase } from '../../lib/supabase'

const DOSE_EMOJIS = ['☀️', '🌅', '🌙', '⭐']

function urgencyColor(isoDate, now) {
  const hours = (now - new Date(isoDate).getTime()) / 3600000
  if (hours < 2) return '#5BAD6F'
  if (hours < 3) return '#E8B84B'
  return '#E05A4B'
}

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

// ── Interactive dose chip (VitaminD / Dose tracker) ───────────────────────────
function DoseChip({ tracker, events, familyId, memberId, childId, isToday }) {
  const doseCount = tracker.config?.daily_doses ?? 2
  const doseLabels = tracker.config?.dose_labels ?? ['בוקר', 'ערב', 'צהריים', 'לילה']
  const [pending, setPending] = useState(new Set()) // optimistic "saving" set

  const given = new Set(events.map(e => String(e.data?.dose_index ?? e.data?.dose)))
  const allDone = given.size >= doseCount

  async function handleDoseTap(i) {
    if (!isToday) return // only interactive when viewing today
    const key = String(i)
    if (pending.has(key)) return

    if (given.has(key)) {
      // Undo — delete the event for this dose
      const eventToDelete = events.find(e => String(e.data?.dose_index ?? e.data?.dose) === key)
      if (!eventToDelete) return
      setPending(prev => new Set([...prev, key]))
      try {
        await supabase.from('events').delete().eq('id', eventToDelete.id)
      } finally {
        setPending(prev => { const s = new Set(prev); s.delete(key); return s })
      }
    } else {
      // Give dose
      setPending(prev => new Set([...prev, key]))
      try {
        await supabase.from('events').insert({
          family_id: familyId,
          tracker_id: tracker.id,
          member_id: memberId,
          child_id: childId,
          occurred_at: new Date().toISOString(),
          data: { dose_index: i, dose_label: doseLabels[i] ?? `מינון ${i + 1}` },
        })
      } finally {
        setPending(prev => { const s = new Set(prev); s.delete(key); return s })
      }
    }
  }

  return (
    <div
      className="rounded-2xl px-2.5 py-2 flex-shrink-0"
      style={{ backgroundColor: `${tracker.color}18` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base">{tracker.icon}</span>
        <p className="font-rubik text-xs text-brown-400 leading-tight truncate max-w-[72px]">{tracker.name}</p>
      </div>
      {/* Dose buttons */}
      <div className="flex gap-1">
        {Array.from({ length: doseCount }, (_, i) => {
          const key = String(i)
          const isDone = given.has(key)
          const isPending = pending.has(key)
          return (
            <button
              key={i}
              onClick={() => handleDoseTap(i)}
              disabled={isPending || !isToday}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all active:scale-90 disabled:opacity-50"
              style={{
                backgroundColor: isDone ? tracker.color : `${tracker.color}25`,
                border: `1.5px solid ${isDone ? tracker.color : `${tracker.color}40`}`,
                borderStyle: (!isDone && isToday) ? 'dashed' : 'solid',
              }}
              title={doseLabels[i] ?? `מינון ${i + 1}`}
            >
              {isPending ? '⏳' : isDone ? '✓' : (DOSE_EMOJIS[i] ?? '💊')}
            </button>
          )
        })}
      </div>
      {allDone ? (
        <p className="font-rubik text-[10px] text-amber-600 font-semibold mt-1 text-center">הכל ✓</p>
      ) : isToday ? (
        <p className="font-rubik text-[9px] text-brown-300 mt-1 text-center">הקש לסימון</p>
      ) : null}
    </div>
  )
}

// ── Static chip for non-interactive trackers ──────────────────────────────────
function StaticChip({ tracker, events, now, child }) {
  const type = tracker.tracker_type
  const last = events[0]
  let label

  if (type === TRACKER_TYPES.DIAPER) {
    const diaperColor = last ? (() => {
      const hours = (now - new Date(last.occurred_at).getTime()) / 3600000
      if (hours < 2) return '#5BAD6F'
      if (hours < 4) return '#E8B84B'
      return '#E05A4B'
    })() : null
    label = last
      ? <span className="font-rubik text-xs font-semibold" style={{ color: diaperColor }}>{formatTime(last.occurred_at)} · {events.length}×</span>
      : <span className="font-rubik text-xs text-brown-300">עדיין לא</span>
  } else if (type === TRACKER_TYPES.SLEEP) {
    const { isSleeping, totalMs } = getSleepStats(events, now)
    label = isSleeping
      ? <span className="font-rubik text-xs font-semibold" style={{ color: tracker.color }}>ישן · {formatDur(totalMs)}</span>
      : totalMs > 0
        ? <span className="font-rubik text-xs text-brown-600">{formatDur(totalMs)} שינה</span>
        : <span className="font-rubik text-xs text-brown-300">לא ישן</span>
  } else if (type === TRACKER_TYPES.GROWTH) {
    if (!last) return null
    const w = last.data?.weight_kg != null ? parseFloat(last.data.weight_kg) : null
    const h = last.data?.height_cm != null ? parseFloat(last.data.height_cm) : null
    let result = null
    if (child?.birth_date) {
      const months = ageInMonths(child.birth_date, last.occurred_at)
      if (months !== null) {
        result = w != null
          ? getWeightPercentileLabel(w, months, child.gender ?? 'male')
          : h != null
            ? getHeightPercentileLabel(h, months, child.gender ?? 'male')
            : null
      }
    }
    if (result) {
      const isNormal = result.percentile >= 15 && result.percentile <= 85
      const isConcerning = result.percentile < 3 || result.percentile > 97
      label = (
        <div>
          <span className={cn('font-rubik text-xs font-bold leading-tight',
            isNormal ? 'text-green-600' : isConcerning ? 'text-red-500' : 'text-amber-600'
          )}>
            אחוזון {result.percentile}
          </span>
          <p className="font-rubik text-xs text-brown-400 leading-tight">{result.desc}</p>
        </div>
      )
    } else {
      label = w != null
        ? <span className="font-rubik text-xs text-brown-600">{w} ק"ג</span>
        : <span className="font-rubik text-xs text-brown-600">{h} ס"מ</span>
    }
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
  const lines = []

  for (const tr of trackers) {
    if (tr.tracker_type === TRACKER_TYPES.SLEEP) {
      const { isSleeping, totalMs } = getSleepStats(eventsByTracker[tr.id] ?? [], now)
      if (isSleeping) {
        lines.push(
          <p key={tr.id} className="font-rubik text-xs text-center" style={{ color: tr.color }}>
            😴 הבייבי ישן כבר {formatDur(totalMs)}
          </p>
        )
      }
    }
    if (tr.tracker_type === TRACKER_TYPES.VITAMIN_D || tr.tracker_type === TRACKER_TYPES.DOSE) {
      if (tr.config?.display_mode === 'simple') continue
      const doseCount = tr.config?.daily_doses ?? 2
      if (doseCount < 1) continue
      const given = new Set((eventsByTracker[tr.id] ?? []).map(e => String(e.data?.dose_index ?? e.data?.dose)))
      if (given.size >= doseCount) {
        lines.push(
          <p key={tr.id} className="font-rubik text-xs text-amber-600 text-center">☀️ {tr.name} הושלם — כל הכבוד!</p>
        )
      }
    }
  }

  if (lines.length === 0) return null
  return (
    <div className="px-4 pb-3 pt-2 border-t border-cream-100 flex flex-col gap-1">
      {lines}
    </div>
  )
}

function isDoseTracker(tr) {
  return tr.tracker_type === TRACKER_TYPES.VITAMIN_D ||
    (tr.tracker_type === TRACKER_TYPES.DOSE && tr.config?.display_mode !== 'simple')
}

export function HeroCard({ trackers, eventsByTracker, isToday, child, familyId, childId, memberId }) {
  const [now, setNow] = useState(Date.now())
  const [lastEverFeeding, setLastEverFeeding] = useState(null)

  const feedingTracker = trackers.find(t => t.tracker_type === TRACKER_TYPES.FEEDING)
  const feedingEvents  = feedingTracker ? (eventsByTracker[feedingTracker.id] ?? []) : []
  const otherTrackers  = trackers.filter(t => t.tracker_type !== TRACKER_TYPES.FEEDING)

  const lastFeeding = feedingEvents[0]
  const displayFeeding = lastFeeding ?? (isToday ? lastEverFeeding : null)
  const totalMlToday = feedingEvents.reduce((sum, e) => sum + (e.data?.amount_ml ?? 0), 0)

  useEffect(() => {
    if (!familyId || !feedingTracker || feedingEvents.length > 0) {
      setLastEverFeeding(null)
      return
    }
    let query = supabase.from('events')
      .select('*')
      .eq('family_id', familyId)
      .eq('tracker_id', feedingTracker.id)
      .order('occurred_at', { ascending: false })
      .limit(1)
    if (childId) query = query.eq('child_id', childId)
    query.then(({ data }) => setLastEverFeeding(data?.[0] ?? null))
  }, [familyId, feedingTracker?.id, childId, feedingEvents.length])

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

      {/* Header with feeding summary */}
      <div className="px-4 pt-4 pb-4" style={{ background: 'linear-gradient(145deg, #FFFBF5 0%, #FFF3E0 100%)' }}>
        <p className="font-rubik font-bold text-brown-600 text-sm mb-3">📊 סיכום היום</p>

        {feedingTracker ? (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: `${feedingTracker.color}18` }}>
            {displayFeeding ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-brown-500 font-rubik mb-0.5">האכלה אחרונה</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">
                      {formatTime(displayFeeding.occurred_at)}
                    </p>
                    {!isTodayFn(new Date(displayFeeding.occurred_at)) && (
                      <span className="text-xs bg-amber-100 text-amber-700 font-rubik px-2 py-0.5 rounded-full">
                        {isYesterday(new Date(displayFeeding.occurred_at)) ? 'אתמול' : 'מוקדם יותר'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-rubik mt-0.5" style={{ color: urgencyColor(displayFeeding.occurred_at, now) }}>
                    {formatTimeAgo(displayFeeding.occurred_at)} לפני
                  </p>
                </div>
                <div className="text-center flex flex-col gap-1">
                  {(displayFeeding.data?.amount_ml ?? 0) > 0 && (
                    <div>
                      <p className="font-rubik font-bold text-3xl leading-tight" style={{ color: feedingTracker.color }}>
                        {displayFeeding.data.amount_ml}
                      </p>
                      <p className="text-xs text-brown-400 font-rubik">מ"ל</p>
                    </div>
                  )}
                  {totalMlToday > 0 && (
                    <div className="mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: `${feedingTracker.color}20` }}>
                      <p className="font-rubik text-xs font-semibold" style={{ color: feedingTracker.color }}>{totalMlToday} מ"ל היום</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-brown-400 font-rubik text-sm text-center py-1">עדיין אין האכלות היום</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Chips row — dose trackers are interactive, others are static */}
      {otherTrackers.length > 0 && (
        <div className="px-4 py-3 border-t border-cream-100 flex flex-wrap gap-2">
          {otherTrackers.map(tr =>
            isDoseTracker(tr) ? (
              <DoseChip
                key={tr.id}
                tracker={tr}
                events={eventsByTracker[tr.id] ?? []}
                familyId={familyId}
                memberId={memberId}
                childId={childId}
                isToday={isToday}
              />
            ) : (
              <StaticChip
                key={tr.id}
                tracker={tr}
                events={eventsByTracker[tr.id] ?? []}
                now={now}
                child={child}
              />
            )
          )}
        </div>
      )}

      {isToday && <SmartStatusLine trackers={trackers} eventsByTracker={eventsByTracker} now={now} />}
    </div>
  )
}
