import { useState, useMemo, useEffect } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useEvents } from '../hooks/useEvents'
import { useChildren } from '../hooks/useChildren'
import { TRACKER_TYPES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { formatAge } from '../lib/utils'
import {
  format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, isSameDay,
  differenceInCalendarDays,
} from 'date-fns'
import { he } from 'date-fns/locale'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts'
import { Spinner } from '../components/ui/Spinner'
import { BottomSheet } from '../components/ui/BottomSheet'
import {
  WHO_WEIGHT_BOYS, WHO_WEIGHT_GIRLS, WHO_HEIGHT_BOYS, WHO_HEIGHT_GIRLS,
  WHO_HEAD_BOYS, WHO_HEAD_GIRLS,
  interpolateWHO, ageInMonths,
  getWeightPercentileLabel, getHeightPercentileLabel, getHeadPercentileLabel,
} from '../lib/whoGrowthData'

// ── Chart style constants ────────────────────────────────────────────────────
const CHART_TOOLTIP = {
  contentStyle: {
    fontFamily: 'Rubik', borderRadius: 12, border: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13,
  },
}
const AXIS = {
  axisLine: false, tickLine: false,
  tick: { fontFamily: 'Rubik', fontSize: 11, fill: '#A87048' },
}

function dayLabel(date) {
  return format(date, 'EEE', { locale: he })
}

// ── Insight helpers ──────────────────────────────────────────────────────────

// Bucket an ISO timestamp into morning/afternoon/evening/night.
// Local time of the user's browser is used (matches what the parent saw on
// the wall clock when they tapped).
function timeOfDayBucket(iso) {
  const h = new Date(iso).getHours()
  if (h >= 6  && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  if (h >= 18 && h < 24) return 'evening'
  return 'night'
}

const TOD_LABEL = {
  morning:   '🌅 בוקר',
  afternoon: '☀️ צהריים',
  evening:   '🌇 ערב',
  night:     '🌙 לילה',
}

// Returns { morning, afternoon, evening, night } counts.
function countByTimeOfDay(events) {
  const c = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const e of events) c[timeOfDayBucket(e.occurred_at)] += 1
  return c
}

// Format a week-over-week delta as a small object the UI can render.
// Returns null when the previous week had zero baseline (would divide by 0).
function deltaVs(thisWeek, lastWeek) {
  if (lastWeek === 0) {
    if (thisWeek === 0) return { dir: 'flat', text: 'ללא שינוי', pct: 0 }
    return { dir: 'up', text: 'חדש השבוע', pct: null }
  }
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  if (pct === 0) return { dir: 'flat', text: 'ללא שינוי', pct: 0 }
  return {
    dir: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '+' : ''}${pct}% מהשבוע שעבר`,
    pct,
  }
}

// Pair sleep `start` / `end` events robustly.
//
// The naive version assumed strict alternation: start, end, start, end, …
// In real usage parents sometimes log two consecutive starts (forgot to
// end the first session) or an end with no matching start. The naive code
// silently dropped the whole pair. Behaviour we want:
//   • multiple consecutive starts: pair the LATEST one with the next end
//     (assume the user re-tapped because they forgot, not because there
//     were two simultaneous sleeps)
//   • ends without a preceding start: ignore them
//   • a final unmatched start: ignored here (caller can show "still asleep")
function pairSleepEvents(events) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  )
  const pairs = []
  let openStart = null
  for (const ev of sorted) {
    const type = ev.data?.type
    if (type === 'start') {
      // If there's already an open start, the previous one is replaced —
      // treated as a duplicate tap, not a new session.
      openStart = ev
    } else if (type === 'end' && openStart) {
      pairs.push({ start: openStart, end: ev })
      openStart = null
    }
    // Orphan ends with no openStart are dropped.
  }
  return pairs
}

// ── Main page ────────────────────────────────────────────────────────────────
export function ReportsPage() {
  const { identity } = useApp()
  const { trackers, loading: trackersLoading } = useTrackers(identity.familyId)
  const { children } = useChildren(identity.familyId)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedTracker, setSelectedTracker] = useState(null)

  const weekBase  = addWeeks(new Date(), weekOffset)
  const weekStart = startOfWeek(weekBase, { weekStartsOn: 0 })
  const weekEnd   = endOfWeek(weekBase,   { weekStartsOn: 0 })
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Previous-week range — used for the "vs last week" insight strip and
  // for delta arrows on each tracker tile. We fetch this separately from
  // useEvents so we don't disturb the existing query/realtime channel.
  const prevWeekBase  = addWeeks(weekBase, -1)
  const prevWeekStart = startOfWeek(prevWeekBase, { weekStartsOn: 0 })
  const prevWeekEnd   = endOfWeek(prevWeekBase,   { weekStartsOn: 0 })

  const weekLabel   = `${format(weekStart, 'd בMMM', { locale: he })} — ${format(weekEnd, 'd בMMM', { locale: he })}`
  const weekContext = weekOffset === 0 ? 'שבוע זה' : weekOffset === -1 ? 'שבוע שעבר' : `לפני ${Math.abs(weekOffset)} שבועות`

  const { events, loading: eventsLoading } = useEvents(identity.familyId, {
    startDate: weekStart,
    endDate:   weekEnd,
    childId:   identity.activeChildId,
  })

  // Previous-week one-shot fetch — no realtime channel needed since past
  // weeks are immutable (events for last week aren't being inserted now).
  const [prevEvents, setPrevEvents] = useState([])
  useEffect(() => {
    if (!identity.familyId) return
    let cancelled = false
    let q = supabase
      .from('events')
      .select('*')
      .eq('family_id', identity.familyId)
      .gte('occurred_at', prevWeekStart.toISOString())
      .lte('occurred_at', prevWeekEnd.toISOString())
    if (identity.activeChildId) q = q.eq('child_id', identity.activeChildId)
    q.then(({ data }) => { if (!cancelled) setPrevEvents(data ?? []) })
    return () => { cancelled = true }
  }, [identity.familyId, identity.activeChildId, prevWeekStart.toISOString()])

  const loading = trackersLoading || eventsLoading

  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null
  const activeTackers = trackers.filter(tr => tr.is_active !== false)

  // For the current week the denominator should reflect days elapsed, not 7.
  // Returns the number of calendar days from weekStart up to and including today,
  // capped at 7. For past weeks always returns 7.
  const elapsedDaysInWeek = (() => {
    const today = new Date()
    if (today < weekStart) return 0
    if (today > weekEnd)   return 7
    return differenceInCalendarDays(today, weekStart) + 1
  })()

  // Numeric "primary metric" per tracker — the thing we compare week-over-week.
  // Returns { num, unit } where num is the number to compare (mL, count, hours).
  function rawWeeklyTotal(tr, trEvents) {
    switch (tr.tracker_type) {
      case TRACKER_TYPES.FEEDING: {
        const ml = trEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
        return ml > 0
          ? { num: ml, unit: 'mL' }
          : { num: trEvents.length, unit: 'count' }
      }
      case TRACKER_TYPES.DIAPER:
        return { num: trEvents.length, unit: 'count' }
      case TRACKER_TYPES.SLEEP: {
        const pairs = pairSleepEvents(trEvents)
        const hours = pairs.reduce(
          (s, p) => s + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)) / 3600000,
          0
        )
        return { num: Math.round(hours * 10) / 10, unit: 'hours' }
      }
      case TRACKER_TYPES.VITAMIN_D:
      case TRACKER_TYPES.DOSE:
      case TRACKER_TYPES.GROWTH:
      default:
        return { num: trEvents.length, unit: 'count' }
    }
  }

  // Compute per-tracker weekly summary for the grid tiles
  const summaries = useMemo(() => {
    const map = {}
    activeTackers.forEach(tr => {
      const trEvents     = events.filter(e => e.tracker_id === tr.id)
      const trPrevEvents = prevEvents.filter(e => e.tracker_id === tr.id)

      const cur  = rawWeeklyTotal(tr, trEvents)
      const prev = rawWeeklyTotal(tr, trPrevEvents)

      // Delta is meaningful only when the current week is "complete-ish" and
      // both weeks share the same unit. Skip deltas for trackers whose unit
      // we can't compare (e.g. growth measurements aren't a "weekly total").
      let delta = null
      if (
        cur.unit === prev.unit &&
        tr.tracker_type !== TRACKER_TYPES.GROWTH &&
        weekOffset <= 0 // only show deltas for current or past weeks; future weeks make no sense
      ) {
        delta = deltaVs(cur.num, prev.num)
      }

      switch (tr.tracker_type) {
        case TRACKER_TYPES.FEEDING: {
          const ml = trEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
          map[tr.id] = {
            value: ml > 0 ? `${ml}` : trEvents.length,
            unit: ml > 0 ? 'מ"ל' : 'האכלות',
            delta,
          }
          break
        }
        case TRACKER_TYPES.DIAPER:
          map[tr.id] = { value: trEvents.length, unit: 'החלפות', delta }
          break
        case TRACKER_TYPES.SLEEP: {
          // Robust pairing — see pairSleepEvents() helper. Tolerates orphan
          // starts/ends so a missed "end" doesn't drop the whole session.
          const pairs = pairSleepEvents(trEvents)
          const totalHours = pairs.reduce(
            (s, p) => s + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)) / 3600000,
            0
          )
          map[tr.id] = { value: Math.round(totalHours * 10) / 10, unit: "שע' שינה", delta }
          break
        }
        case TRACKER_TYPES.VITAMIN_D:
        case TRACKER_TYPES.DOSE: {
          const config = tr.config ?? {}
          if (tr.tracker_type === TRACKER_TYPES.DOSE && config.display_mode === 'simple') {
            map[tr.id] = { value: trEvents.length, unit: 'אירועים', delta }
          } else {
            const doses = config.daily_doses ?? 2
            const given = trEvents.length
            // Use elapsed days for partial weeks so the ratio is honest
            map[tr.id] = {
              value: `${given}/${doses * elapsedDaysInWeek}`,
              unit: 'מינונים',
              delta,
            }
          }
          break
        }
        case TRACKER_TYPES.GROWTH: {
          const lastGrowth = [...trEvents].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))[0]
          const lastW = lastGrowth?.data?.weight_kg
          const lastH = lastGrowth?.data?.height_cm
          if (lastW != null) {
            map[tr.id] = { value: `${parseFloat(lastW)}`, unit: 'ק"ג השבוע', delta: null }
          } else if (lastH != null) {
            map[tr.id] = { value: `${parseFloat(lastH)}`, unit: 'ס"מ גובה השבוע', delta: null }
          } else {
            map[tr.id] = { value: '—', unit: 'הקש לגרף גדילה', delta: null }
          }
          break
        }
        default:
          map[tr.id] = { value: trEvents.length, unit: 'אירועים', delta }
      }
    })
    return map
  }, [events, prevEvents, activeTackers, weekOffset, elapsedDaysInWeek])

  // ── Top-level insights (3-card strip) ─────────────────────────────────────
  // Each card surfaces ONE numeric insight + its week-over-week delta.
  // We deliberately keep these factual, not medical — no recommendations,
  // no "this is healthy/unhealthy" colouring.
  const insights = useMemo(() => {
    const out = []

    const feedingTracker = activeTackers.find(t => t.tracker_type === TRACKER_TYPES.FEEDING)
    const diaperTracker  = activeTackers.find(t => t.tracker_type === TRACKER_TYPES.DIAPER)
    const sleepTracker   = activeTackers.find(t => t.tracker_type === TRACKER_TYPES.SLEEP)

    // Feeding total mL — most parents check this first
    if (feedingTracker) {
      const cur  = events.filter(e => e.tracker_id === feedingTracker.id)
      const prev = prevEvents.filter(e => e.tracker_id === feedingTracker.id)
      const curMl  = cur.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
      const prevMl = prev.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
      out.push({
        key: 'feeding',
        emoji: feedingTracker.icon ?? '🍼',
        label: 'מ"ל השבוע',
        value: curMl,
        delta: weekOffset <= 0 ? deltaVs(curMl, prevMl) : null,
        color: feedingTracker.color,
      })
    }

    // Diaper count + best time-of-day
    if (diaperTracker) {
      const cur  = events.filter(e => e.tracker_id === diaperTracker.id)
      const prev = prevEvents.filter(e => e.tracker_id === diaperTracker.id)
      out.push({
        key: 'diaper',
        emoji: diaperTracker.icon ?? '👶',
        label: 'חיתולים השבוע',
        value: cur.length,
        delta: weekOffset <= 0 ? deltaVs(cur.length, prev.length) : null,
        color: diaperTracker.color,
      })
    }

    // Sleep hours
    if (sleepTracker) {
      const cur  = events.filter(e => e.tracker_id === sleepTracker.id)
      const prev = prevEvents.filter(e => e.tracker_id === sleepTracker.id)
      const curH  = pairSleepEvents(cur).reduce(
        (s, p) => s + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)) / 3600000, 0
      )
      const prevH = pairSleepEvents(prev).reduce(
        (s, p) => s + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)) / 3600000, 0
      )
      out.push({
        key: 'sleep',
        emoji: sleepTracker.icon ?? '🌙',
        label: "שע' שינה השבוע",
        value: Math.round(curH * 10) / 10,
        delta: weekOffset <= 0 ? deltaVs(Math.round(curH * 10) / 10, Math.round(prevH * 10) / 10) : null,
        color: sleepTracker.color,
      })
    }

    return out
  }, [events, prevEvents, activeTackers, weekOffset])

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('reports.title')}</h1>
        {activeChild?.birth_date && (
          <p className="font-rubik text-brown-400 text-xs">
            {activeChild.name} · {formatAge(activeChild.birth_date)}
          </p>
        )}
      </div>

      {/* Smart insights strip — week-over-week deltas, factual only */}
      {insights.length > 0 && !loading && (
        <InsightsStrip insights={insights} />
      )}

      {/* Week navigator */}
      <div className="flex items-center gap-2 bg-white rounded-2xl shadow-soft px-3 py-3 mb-5">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-brown-600 text-xl font-bold active:scale-95 transition-transform flex-shrink-0"
        >‹</button>
        <div className="flex-1 text-center">
          <p className="font-rubik font-bold text-brown-800 text-sm">{weekLabel}</p>
          <p className="font-rubik text-brown-400 text-xs mt-0.5">{weekContext}</p>
        </div>
        <button
          onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
          disabled={weekOffset === 0}
          className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-brown-600 text-xl font-bold active:scale-95 transition-transform disabled:opacity-25 flex-shrink-0"
        >›</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : activeTackers.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📊</div>
          <p className="font-rubik font-semibold text-brown-600">{t('reports.noData')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {activeTackers.map(tr => (
            <TrackerTile
              key={tr.id}
              tracker={tr}
              summary={summaries[tr.id] ?? { value: 0, unit: 'אירועים' }}
              onClick={() => setSelectedTracker(tr)}
            />
          ))}
        </div>
      )}

      {/* Detail popup */}
      {selectedTracker && (
        <TrackerDetailSheet
          tracker={selectedTracker}
          weekEvents={events.filter(e => e.tracker_id === selectedTracker.id)}
          weekDays={weekDays}
          familyId={identity.familyId}
          childId={identity.activeChildId}
          child={activeChild}
          onClose={() => setSelectedTracker(null)}
        />
      )}
    </div>
  )
}

// ── Insights strip (top of Reports) ──────────────────────────────────────────
function InsightsStrip({ insights }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-hide">
      {insights.map(ins => (
        <div
          key={ins.key}
          className="flex-shrink-0 w-40 rounded-2xl bg-white shadow-soft p-3"
          style={{ borderTop: `3px solid ${ins.color}` }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">{ins.emoji}</span>
            <p className="font-rubik text-brown-400 text-[11px] leading-tight">{ins.label}</p>
          </div>
          <p className="font-rubik font-bold text-brown-800 text-2xl leading-none">{ins.value}</p>
          {ins.delta && <DeltaPill delta={ins.delta} />}
        </div>
      ))}
    </div>
  )
}

// Compact delta indicator: ▲ / ▼ / — plus % text. Color is intentionally
// muted (brown-500) — going UP isn't always good (more diapers ≠ better)
// and going DOWN isn't always bad (less feeding ≠ worse). Keep it factual.
function DeltaPill({ delta, className = '' }) {
  if (!delta) return null
  const arrow = delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'
  return (
    <p className={`font-rubik text-brown-500 text-[11px] mt-1 leading-tight ${className}`}>
      <span className="font-bold">{arrow}</span> {delta.text}
    </p>
  )
}

// ── Tracker grid tile ────────────────────────────────────────────────────────
function TrackerTile({ tracker, summary, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl shadow-soft overflow-hidden text-right active:scale-[0.97] transition-transform w-full"
    >
      <div className="h-1.5" style={{ backgroundColor: tracker.color }} />
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xl">{tracker.icon}</span>
          <p className="font-rubik font-semibold text-brown-800 text-sm truncate">{tracker.name}</p>
        </div>
        <p className="font-rubik font-bold text-2xl text-brown-800 leading-none">{summary.value}</p>
        <p className="font-rubik text-brown-400 text-xs mt-0.5">{summary.unit}</p>
        {summary.delta && <DeltaPill delta={summary.delta} />}
      </div>
    </button>
  )
}

// ── Tracker detail bottom sheet ──────────────────────────────────────────────
function TrackerDetailSheet({ tracker, weekEvents, weekDays, familyId, childId, child, onClose }) {
  const isGrowth = tracker.tracker_type === TRACKER_TYPES.GROWTH

  // For growth: fetch all-time events
  const { events: allEvents, loading: allLoading } = useEvents(
    isGrowth ? familyId : null,
    { trackerId: isGrowth ? tracker.id : null, childId }
  )

  return (
    <BottomSheet isOpen onClose={onClose} title={`${tracker.icon} ${tracker.name}`}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {isGrowth ? (
          allLoading
            ? <div className="flex justify-center py-8"><Spinner size="lg" /></div>
            : <GrowthDetailContent events={allEvents} child={child} tracker={tracker} />
        ) : (
          <TrackerChartContent
            tracker={tracker}
            weekEvents={weekEvents}
            weekDays={weekDays}
          />
        )}
      </div>
    </BottomSheet>
  )
}

// ── Standard weekly chart + stats ────────────────────────────────────────────
function TrackerChartContent({ tracker, weekEvents, weekDays }) {
  const type = tracker.tracker_type

  // Feeding
  if (type === TRACKER_TYPES.FEEDING) {
    const data = weekDays.map(day => {
      const de = weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day))
      return { day: dayLabel(day), ml: de.reduce((s,e) => s + (e.data?.amount_ml ?? 0), 0), count: de.length }
    }).reverse()
    const totalMl    = data.reduce((s,d) => s + d.ml, 0)
    const totalCount = data.reduce((s,d) => s + d.count, 0)
    const activeDays = data.filter(d => d.ml > 0).length
    const avgMl      = activeDays > 0 ? Math.round(totalMl / activeDays) : 0
    return (
      <>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="סה&quot;כ מ&quot;ל" value={totalMl} color={tracker.color} />
          <MiniStat label="האכלות" value={totalCount} color={tracker.color} />
          <MiniStat label='מ"ל/יום' value={avgMl} color={tracker.color} />
        </div>
        {data.some(d => d.ml > 0) && (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis
                {...AXIS}
                width={52}
                orientation="left"
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
              />
              <Tooltip {...CHART_TOOLTIP} formatter={v => [`${v} מ"ל`, '']} />
              <Bar dataKey="ml" fill={tracker.color} radius={[6,6,0,0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <TimeOfDayBreakdown events={weekEvents} color={tracker.color} />
        <DryEvents events={weekEvents} tracker={tracker} />
      </>
    )
  }

  // Diaper
  if (type === TRACKER_TYPES.DIAPER) {
    const data = weekDays.map(day => ({
      day: dayLabel(day),
      count: weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day)).length,
    })).reverse()
    const total = data.reduce((s,d) => s + d.count, 0)
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="סה&quot;כ החלפות" value={total} color={tracker.color} />
          <MiniStat label="ממוצע/יום" value={Math.round(total / 7 * 10) / 10} color={tracker.color} />
        </div>
        {data.some(d => d.count > 0) && (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis {...AXIS} width={30} orientation="left" allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} formatter={v => [v, '']} />
              <Bar dataKey="count" fill={tracker.color} radius={[6,6,0,0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <TimeOfDayBreakdown events={weekEvents} color={tracker.color} />
        <DryEvents events={weekEvents} tracker={tracker} />
      </>
    )
  }

  // Sleep
  if (type === TRACKER_TYPES.SLEEP) {
    // Pair across the full week (so cross-midnight sessions aren't lost) and
    // tolerate orphan events — see pairSleepEvents() above.
    const weekPairs = pairSleepEvents(weekEvents)
    const data = weekDays.map(day => {
      const ms = weekPairs
        .filter(p => isSameDay(new Date(p.start.occurred_at), day))
        .reduce((sum, p) => sum + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)), 0)
      return { day: dayLabel(day), hours: Math.round(ms / 3600000 * 10) / 10 }
    }).reverse()
    const total = Math.round(data.reduce((s,d) => s + d.hours, 0) * 10) / 10
    const activeDays = data.filter(d => d.hours > 0).length
    const avg = activeDays > 0 ? Math.round(total / activeDays * 10) / 10 : 0
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="סה&quot;כ שינה" value={`${total} שע'`} color={tracker.color} />
          <MiniStat label="ממוצע/יום" value={`${avg} שע'`} color={tracker.color} />
        </div>
        {data.some(d => d.hours > 0) && (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis {...AXIS} width={30} orientation="left" />
              <Tooltip {...CHART_TOOLTIP} formatter={v => [`${v} שע'`, '']} />
              <Bar dataKey="hours" fill={tracker.color} radius={[6,6,0,0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <DryEvents events={weekEvents} tracker={tracker} />
      </>
    )
  }

  // Vitamin D / Dose — compliance grid (skip for simple-mode dose trackers)
  const isSimpleDose = type === TRACKER_TYPES.DOSE && (tracker.config?.display_mode === 'simple')
  if ((type === TRACKER_TYPES.VITAMIN_D || type === TRACKER_TYPES.DOSE) && !isSimpleDose) {
    const config     = tracker.config ?? {}
    const doseCount  = config.daily_doses ?? 2
    const doseLabels = config.dose_labels ?? ['בוקר', 'ערב']
    const days = weekDays.map(day => {
      const de = weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day))
      const given = new Set(de.map(e => String(e.data?.dose_index ?? e.data?.dose)))
      return { label: dayLabel(day), doses: Array.from({length: doseCount}, (_, i) => given.has(String(i))) }
    })
    const totalGiven = days.flatMap(d => d.doses).filter(Boolean).length
    return (
      <>
        <MiniStat label="מינונים ניתנו" value={`${totalGiven} / ${doseCount * 7}`} color={tracker.color} />
        <div className="space-y-2 mt-1">
          <div className="flex gap-1">
            <div className="w-10" />
            {days.map((d,i) => <div key={i} className="flex-1 text-center text-xs font-rubik text-brown-400">{d.label}</div>)}
          </div>
          {Array.from({length: doseCount}, (_, di) => (
            <div key={di} className="flex items-center gap-1">
              <span className="text-xs font-rubik text-brown-500 w-10 text-right truncate">{doseLabels[di]}</span>
              {days.map((d,i) => (
                <div key={i}
                  className={`flex-1 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${d.doses[di] ? 'text-white' : 'bg-cream-200'}`}
                  style={d.doses[di] ? {backgroundColor: tracker.color} : {}}
                >
                  {d.doses[di] ? '✓' : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
        <DryEvents events={weekEvents} tracker={tracker} />
      </>
    )
  }

  // Dose + Custom — simple event count chart
  const data = weekDays.map(day => ({
    day: dayLabel(day),
    count: weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day)).length,
  })).reverse()
  const total = data.reduce((s,d) => s + d.count, 0)
  const config = tracker.config ?? {}
  const maxPerDay = config.daily_doses
  return (
    <>
      <MiniStat label="סה&quot;כ אירועים" value={total} color={tracker.color} />
      {data.some(d => d.count > 0) && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
            <XAxis dataKey="day" {...AXIS} />
            <YAxis {...AXIS} width={30} orientation="left" allowDecimals={false} />
            <Tooltip {...CHART_TOOLTIP} formatter={v => [v, '']} />
            {maxPerDay && <ReferenceLine y={maxPerDay} stroke={tracker.color} strokeDasharray="4 2" opacity={0.5} />}
            <Bar dataKey="count" fill={tracker.color} radius={[6,6,0,0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <DryEvents events={weekEvents} tracker={tracker} />
    </>
  )
}

// ── Percentile meter bar ──────────────────────────────────────────────────────
function PercentileMeter({ percentile }) {
  const pct = Math.max(2, Math.min(98, percentile))
  const color = pct < 3 ? '#EF4444' : pct < 15 ? '#F59E0B' : pct < 85 ? '#22C55E' : pct < 97 ? '#F59E0B' : '#EF4444'
  return (
    <div className="relative h-2 rounded-full my-2" style={{
      background: 'linear-gradient(to right, #EF444435 0% 3%, #F59E0B35 3% 15%, #22C55E35 15% 85%, #F59E0B35 85% 97%, #EF444435 97% 100%)',
    }}>
      <div
        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm"
        style={{ left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', backgroundColor: color }}
      />
    </div>
  )
}

// ── Single metric card (weight / height / head) ───────────────────────────────
function MetricCard({ icon, label, value, unit, pLabel }) {
  if (value == null) return null
  return (
    <div className="flex-1 bg-white rounded-2xl p-3 shadow-soft min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-sm">{icon}</span>
        <p className="font-rubik text-xs text-brown-400 truncate">{label}</p>
      </div>
      <p className="font-rubik font-bold text-xl text-brown-800 leading-tight">{value} <span className="text-sm font-normal text-brown-400">{unit}</span></p>
      {pLabel && (
        <>
          <PercentileMeter percentile={pLabel.percentile} />
          <p className="font-rubik text-xs font-semibold" style={{ color: pLabel.bandColor }}>
            P{pLabel.percentile} · {pLabel.bandLabel}
          </p>
        </>
      )}
    </div>
  )
}

// ── Growth detail with WHO curves ────────────────────────────────────────────
function GrowthDetailContent({ events, child, tracker }) {
  const [metric, setMetric] = useState('weight') // 'weight' | 'height' | 'head'

  const birthDate = child?.birth_date
  const gender    = child?.gender

  const measurements = useMemo(() => {
    return [...events]
      .filter(e => e.data?.weight_kg != null || e.data?.height_cm != null || e.data?.head_cm != null)
      .sort((a,b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      .map(e => ({
        date: new Date(e.occurred_at),
        weight: e.data?.weight_kg != null ? parseFloat(e.data.weight_kg) : null,
        height: e.data?.height_cm != null ? parseFloat(e.data.height_cm) : null,
        head:   e.data?.head_cm   != null ? parseFloat(e.data.head_cm)   : null,
        age: birthDate ? ageInMonths(birthDate, e.occurred_at) : null,
      }))
  }, [events, birthDate])

  const last = measurements[measurements.length - 1]
  const prev = measurements[measurements.length - 2]

  const whoWeightTable = gender === 'female' ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS
  const whoHeightTable = gender === 'female' ? WHO_HEIGHT_GIRLS : WHO_HEIGHT_BOYS
  const whoHeadTable   = gender === 'female' ? WHO_HEAD_GIRLS   : WHO_HEAD_BOYS

  // Percentile labels for all three metrics of last measurement
  const weightLabel = last?.weight != null && last.age != null ? getWeightPercentileLabel(last.weight, last.age, gender) : null
  const heightLabel = last?.height != null && last.age != null ? getHeightPercentileLabel(last.height, last.age, gender) : null
  const headLabel   = last?.head   != null && last.age != null ? getHeadPercentileLabel(last.head,   last.age, gender) : null

  // Overall status: worst band across all available metrics
  const allLabels = [weightLabel, heightLabel, headLabel].filter(Boolean)
  const overallStatus = useMemo(() => {
    if (allLabels.length === 0) return null
    const hasCritical = allLabels.some(l => l.band === 'low' || l.band === 'high')
    const hasWarning  = allLabels.some(l => l.band === 'low-normal' || l.band === 'high-normal')
    if (hasCritical) return { emoji: '📋', title: 'מדד אחד חורג מהטווח',   sub: 'המידע להשוואה בלבד — ראו הערה למטה', color: '#F59E0B', bg: '#FFFBEB' }
    if (hasWarning)  return { emoji: '🔍', title: 'מדד אחד לתשומת לב',      sub: 'המידע להשוואה בלבד — ראו הערה למטה', color: '#F59E0B', bg: '#FFFBEB' }
    return               { emoji: '✅', title: 'כל המדדים בטווח WHO',       sub: 'המידע להשוואה בלבד — ראו הערה למטה', color: '#22C55E', bg: '#F0FDF4' }
  }, [allLabels])

  // Delta from previous measurement
  const delta = useMemo(() => {
    if (!prev || !last) return null
    const parts = []
    if (last.weight != null && prev.weight != null) {
      const d = Math.round((last.weight - prev.weight) * 100) / 100
      parts.push(`${d > 0 ? '+' : ''}${d} ק"ג`)
    }
    if (last.height != null && prev.height != null) {
      const d = Math.round((last.height - prev.height) * 10) / 10
      parts.push(`${d > 0 ? '+' : ''}${d} ס"מ גובה`)
    }
    if (last.head != null && prev.head != null) {
      const d = Math.round((last.head - prev.head) * 10) / 10
      parts.push(`${d > 0 ? '+' : ''}${d} ס"מ ראש`)
    }
    if (parts.length === 0) return null
    return { text: parts.join(' · '), date: format(prev.date, 'd/M', { locale: he }) }
  }, [last, prev])

  // Chart data
  const chartData = useMemo(() => {
    if (!birthDate) return null
    const validAges = measurements.map(m => m.age).filter(a => a != null)
    const babyMaxAge = validAges.length > 0 ? Math.max(...validAges) : 0
    const endAge = Math.min(36, Math.max(6, Math.ceil(babyMaxAge) + 2))

    const ageSet = new Set(Array.from({length: endAge + 1}, (_, i) => i))
    measurements.forEach(m => { if (m.age != null) ageSet.add(Math.round(m.age * 10) / 10) })
    const ages = [...ageSet].sort((a,b) => a - b)

    return ages.map(age => {
      const roundedAge = Math.round(age * 10) / 10
      if (metric === 'weight') {
        const ref = interpolateWHO(whoWeightTable, age)
        const m = measurements.find(me => me.weight != null && me.age != null && Math.abs(me.age - age) < 0.06)
        return { age: roundedAge, p3: ref?.[0], p15: ref?.[1], p50: ref?.[2], p85: ref?.[3], p97: ref?.[4], baby: m?.weight ?? null }
      } else if (metric === 'height') {
        const ref = interpolateWHO(whoHeightTable, age)
        const m = measurements.find(me => me.height != null && me.age != null && Math.abs(me.age - age) < 0.06)
        return { age: roundedAge, p3: ref?.[0], p50: ref?.[1], p97: ref?.[2], baby: m?.height ?? null }
      } else {
        const ref = interpolateWHO(whoHeadTable, age)
        const m = measurements.find(me => me.head != null && me.age != null && Math.abs(me.age - age) < 0.06)
        return { age: roundedAge, p3: ref?.[0], p50: ref?.[1], p97: ref?.[2], baby: m?.head ?? null }
      }
    })
  }, [measurements, metric, birthDate, gender])

  const unit = metric === 'weight' ? 'ק"ג' : 'ס"מ'
  const hasHead = measurements.some(m => m.head != null)
  const chartHasData = chartData && chartData.length > 0 && measurements.some(m =>
    metric === 'weight' ? m.weight != null : metric === 'height' ? m.height != null : m.head != null
  )

  return (
    <div className="space-y-4">

      {/* No measurements */}
      {measurements.length === 0 && (
        <div className="text-center py-8">
          <p className="font-rubik text-brown-400 text-sm">אין מדידות עדיין</p>
          <p className="font-rubik text-brown-300 text-xs mt-1">הוסף מדידה מדף הבית</p>
        </div>
      )}

      {/* Overall status banner */}
      {overallStatus && birthDate && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: overallStatus.bg }}>
          <span className="text-2xl flex-shrink-0">{overallStatus.emoji}</span>
          <div>
            <p className="font-rubik font-bold text-sm" style={{ color: overallStatus.color }}>{overallStatus.title}</p>
            <p className="font-rubik text-xs text-brown-500 mt-0.5">{overallStatus.sub}</p>
          </div>
        </div>
      )}

      {/* Three metric cards */}
      {measurements.length > 0 && (
        <div className="flex gap-2">
          <MetricCard icon="⚖️" label="משקל"  value={last.weight} unit='ק"ג' pLabel={birthDate ? weightLabel : null} />
          <MetricCard icon="📏" label="גובה"   value={last.height} unit='ס"מ' pLabel={birthDate ? heightLabel : null} />
          {hasHead && <MetricCard icon="🔵" label='היקף ראש' value={last.head} unit='ס"מ' pLabel={birthDate ? headLabel : null} />}
        </div>
      )}

      {/* Delta from previous measurement */}
      {delta && (
        <div className="bg-cream-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-base">📈</span>
          <div>
            <p className="font-rubik text-xs text-brown-400">מאז מדידה קודמת ({delta.date})</p>
            <p className="font-rubik text-sm font-semibold text-brown-700">{delta.text}</p>
          </div>
        </div>
      )}

      {/* No birthdate warning */}
      {!birthDate && measurements.length > 0 && (
        <div className="bg-amber-50 rounded-2xl px-4 py-3 text-center">
          <p className="font-rubik text-amber-700 text-sm">
            💡 הוסף תאריך לידה בהגדרות הילד/ה כדי לראות אחוזוני WHO
          </p>
        </div>
      )}

      {/* Metric chart tabs */}
      {measurements.length > 0 && (
        <div className="flex gap-2 bg-cream-200 rounded-2xl p-1">
          {[
            { value: 'weight', label: '⚖️ משקל' },
            { value: 'height', label: '📏 גובה' },
            ...(hasHead ? [{ value: 'head', label: '🔵 ראש' }] : []),
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setMetric(opt.value)}
              className={`flex-1 py-2 rounded-xl font-rubik font-medium text-sm transition-all ${metric === opt.value ? 'bg-white shadow-soft text-brown-800' : 'text-brown-400'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Growth chart */}
      {chartHasData && (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" />
              <XAxis
                dataKey="age" {...AXIS}
                label={{ value: 'גיל (חודשים)', position: 'insideBottom', offset: -2, fontFamily: 'Rubik', fontSize: 10, fill: '#A87048' }}
                tickFormatter={v => `${v}`} height={30}
              />
              <YAxis {...AXIS} width={36} orientation="left" domain={['auto', 'auto']} />
              <Tooltip
                {...CHART_TOOLTIP}
                formatter={(v, name) => {
                  if (v == null) return [null, name]
                  const labels = { p3: 'P3', p15: 'P15', p50: 'P50 (חציון)', p85: 'P85', p97: 'P97', baby: child?.name ?? 'הילד/ה' }
                  return [`${v} ${unit}`, labels[name] ?? name]
                }}
                labelFormatter={v => `גיל: ${v} חודשים`}
              />
              <Line dataKey="p3"  stroke="#D6C4B0" strokeWidth={1}   strokeDasharray="3 3" dot={false} legendType="none" />
              {metric === 'weight' && <Line dataKey="p15" stroke="#C4A882" strokeWidth={1.5} strokeDasharray="5 2" dot={false} legendType="none" />}
              <Line dataKey="p50" stroke="#A87048" strokeWidth={2}   strokeDasharray="0"   dot={false} legendType="none" />
              {metric === 'weight' && <Line dataKey="p85" stroke="#C4A882" strokeWidth={1.5} strokeDasharray="5 2" dot={false} legendType="none" />}
              <Line dataKey="p97" stroke="#D6C4B0" strokeWidth={1}   strokeDasharray="3 3" dot={false} legendType="none" />
              <Line dataKey="baby" stroke={tracker.color} strokeWidth={2.5}
                dot={{ fill: tracker.color, r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }}
                connectNulls={false} name="baby"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-3 justify-center flex-wrap text-xs font-rubik text-brown-400">
            <span><span className="inline-block w-4 h-0 mr-1 border-t border-dashed border-brown-300 opacity-60" style={{verticalAlign:'middle'}} />P3/P97</span>
            {metric === 'weight' && <span><span className="inline-block w-4 h-0 mr-1 border-t border-dashed border-brown-400 opacity-70" style={{verticalAlign:'middle'}} />P15/P85</span>}
            <span><span className="inline-block w-4 h-0.5 bg-brown-500 mr-1 opacity-70" style={{verticalAlign:'middle'}} />P50</span>
            <span style={{color: tracker.color}}>● {child?.name ?? 'הילד/ה'}</span>
          </div>
          <p className="font-rubik text-xs text-brown-300 text-center">עקומות WHO — גיל בחודשים</p>
        </>
      )}

      {/* Disclaimer */}
      {measurements.length > 0 && (
        <div className="bg-cream-100 rounded-2xl px-4 py-3">
          <p className="font-rubik text-xs text-brown-400 leading-relaxed text-center">
            ⚠️ המידע מוצג לצורך מעקב אישי בלבד, על בסיס טבלאות WHO (2006).
            אינו מהווה ייעוץ רפואי ואינו מחליף בדיקה אצל רופא ילדים.
            ייתכנו שגיאות חישוב.
          </p>
        </div>
      )}

      {/* Measurements history */}
      {measurements.length > 0 && (
        <div>
          <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">היסטוריית מדידות</p>
          <div className="space-y-2">
            {[...measurements].reverse().slice(0, 10).map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-cream-100 rounded-2xl px-4 py-2.5">
                <div className="flex gap-3 flex-wrap">
                  {m.weight != null && <span className="font-rubik text-brown-800 text-sm font-medium">{m.weight} ק"ג</span>}
                  {m.height != null && <span className="font-rubik text-brown-800 text-sm font-medium">{m.height} ס"מ</span>}
                  {m.head   != null && <span className="font-rubik text-brown-500 text-sm">ראש {m.head} ס"מ</span>}
                </div>
                <div className="text-left">
                  <p className="font-rubik text-brown-400 text-xs">{format(m.date, 'd בMMM yyyy', { locale: he })}</p>
                  {m.age != null && (
                    <p className="font-rubik text-brown-300 text-xs">
                      גיל: {Math.floor(m.age)}ח׳ {Math.round((m.age % 1) * 30)}י׳
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Time-of-day breakdown (used in feeding + diaper detail sheets) ───────────
//
// Shows a 4-bucket bar (morning/afternoon/evening/night) so parents can see
// "when did most of these happen this week". Pure data view — no advice.
function TimeOfDayBreakdown({ events, color, title = 'מתי קרה השבוע' }) {
  if (!events.length) return null
  const counts = countByTimeOfDay(events)
  const total  = events.length
  const order  = ['morning', 'afternoon', 'evening', 'night']
  const max    = Math.max(...order.map(k => counts[k]))

  // Find the dominant bucket for the headline
  const top = order.reduce((a, b) => counts[a] >= counts[b] ? a : b)
  const topPct = Math.round((counts[top] / total) * 100)

  return (
    <div>
      <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="bg-cream-100 rounded-2xl p-3 space-y-2">
        <p className="font-rubik text-sm text-brown-700">
          רוב הפעילות ({topPct}%) ב{TOD_LABEL[top].replace(/^.+?\s/, '')}
        </p>
        <div className="space-y-1.5">
          {order.map(k => (
            <div key={k} className="flex items-center gap-2">
              <span className="font-rubik text-xs text-brown-500 w-20 flex-shrink-0">{TOD_LABEL[k]}</span>
              <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: max > 0 ? `${(counts[k] / max) * 100}%` : '0%',
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="font-rubik text-xs font-semibold text-brown-700 w-6 text-left flex-shrink-0">
                {counts[k]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Small stat card ──────────────────────────────────────────────────────────
function MiniStat({ label, value, color }) {
  return (
    <div className="bg-cream-100 rounded-2xl px-3 py-2.5 text-center">
      <p className="font-rubik font-bold text-xl text-brown-800 leading-none">{value}</p>
      <p className="font-rubik text-brown-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}

// ── Dry events list (last 5) ─────────────────────────────────────────────────
function DryEvents({ events, tracker }) {
  if (events.length === 0) return null
  const sorted = [...events].sort((a,b) => new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0, 5)
  const schema = tracker.field_schema ?? []

  function summarise(e) {
    if (!e.data || Object.keys(e.data).length === 0) return null
    // Built-in diaper: translate type value to Hebrew
    if (tracker.tracker_type === TRACKER_TYPES.DIAPER) {
      const map = { wet: t('diaper.wet'), dirty: t('diaper.dirty'), both: t('diaper.both') }
      return map[e.data.type] ?? ''
    }
    // Built-in feeding: show ml
    if (tracker.tracker_type === TRACKER_TYPES.FEEDING && e.data.amount_ml) {
      return `${e.data.amount_ml} מ"ל`
    }
    return schema.map(f => {
      const v = e.data[f.key]
      if (v == null) return null
      return `${f.label}: ${v}`
    }).filter(Boolean).join(' · ')
  }

  return (
    <div>
      <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">{t('reports.recent')}</p>
      <div className="space-y-1.5">
        {sorted.map(e => {
          const summary = summarise(e)
          return (
            <div key={e.id} className="flex items-center justify-between bg-cream-100 rounded-2xl px-3 py-2">
              <span className="font-rubik text-brown-400 text-xs">
                {format(new Date(e.occurred_at), 'EEE d/M, HH:mm', { locale: he })}
              </span>
              {summary && (
                <span className="font-rubik text-brown-700 text-sm font-medium">{summary}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
