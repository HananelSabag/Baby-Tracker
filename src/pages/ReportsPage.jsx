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
  CartesianGrid, ReferenceLine,
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

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function countByTimeOfDay(events) {
  const c = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const e of events) c[timeOfDayBucket(e.occurred_at)] += 1
  return c
}

// weekOffset drives the comparison label so "% מהשבוע שעבר" only appears
// when viewing the current week. Past-week navigation uses "מהשבוע הקודם".
function deltaVs(thisWeek, lastWeek, weekOffset = 0) {
  const vsLabel = weekOffset === 0 ? 'מהשבוע שעבר' : 'מהשבוע הקודם'
  if (lastWeek === 0) {
    if (thisWeek === 0) return { dir: 'flat', text: 'ללא שינוי', pct: 0 }
    return { dir: 'up', text: 'חדש בשבוע זה', pct: null }
  }
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  if (pct === 0) return { dir: 'flat', text: 'ללא שינוי', pct: 0 }
  return {
    dir: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '+' : ''}${pct}% ${vsLabel}`,
    pct,
  }
}

// Pair sleep start/end events robustly — handles duplicate starts and orphan ends.
function pairSleepEvents(events) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  )
  const pairs = []
  let openStart = null
  for (const ev of sorted) {
    const type = ev.data?.type
    if (type === 'start') {
      openStart = ev
    } else if (type === 'end' && openStart) {
      pairs.push({ start: openStart, end: ev })
      openStart = null
    }
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

  const prevWeekBase  = addWeeks(weekBase, -1)
  const prevWeekStart = startOfWeek(prevWeekBase, { weekStartsOn: 0 })
  const prevWeekEnd   = endOfWeek(prevWeekBase,   { weekStartsOn: 0 })
  const prevWeekDays  = eachDayOfInterval({ start: prevWeekStart, end: prevWeekEnd })

  const weekLabel   = `${format(weekStart, 'd בMMM', { locale: he })} — ${format(weekEnd, 'd בMMM', { locale: he })}`
  const weekContext = weekOffset === 0 ? 'שבוע זה' : weekOffset === -1 ? 'שבוע שעבר' : `לפני ${Math.abs(weekOffset)} שבועות`

  const { events, loading: eventsLoading } = useEvents(identity.familyId, {
    startDate: weekStart,
    endDate:   weekEnd,
    childId:   identity.activeChildId,
  })

  // One-shot fetch for the previous week — past weeks are immutable so no
  // realtime channel is needed.
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

  const activeChild    = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null
  const activeTrackers = trackers.filter(tr => tr.is_active !== false)

  // Days elapsed in the displayed week — used so averages aren't distorted
  // by counting future days in the current week.
  const elapsedDaysInWeek = (() => {
    const today = new Date()
    if (today < weekStart) return 0
    if (today > weekEnd)   return 7
    return differenceInCalendarDays(today, weekStart) + 1
  })()

  function rawWeeklyTotal(tr, trEvents) {
    switch (tr.tracker_type) {
      case TRACKER_TYPES.FEEDING: {
        const ml = trEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
        return ml > 0 ? { num: ml, unit: 'mL' } : { num: trEvents.length, unit: 'count' }
      }
      case TRACKER_TYPES.DIAPER:
        return { num: trEvents.length, unit: 'count' }
      case TRACKER_TYPES.SLEEP: {
        const pairs = pairSleepEvents(trEvents)
        const hours = pairs.reduce(
          (s, p) => s + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)) / 3600000, 0
        )
        return { num: Math.round(hours * 10) / 10, unit: 'hours' }
      }
      default:
        return { num: trEvents.length, unit: 'count' }
    }
  }

  const summaries = useMemo(() => {
    const map = {}
    activeTrackers.forEach(tr => {
      const trEvents     = events.filter(e => e.tracker_id === tr.id)
      const trPrevEvents = prevEvents.filter(e => e.tracker_id === tr.id)
      const cur  = rawWeeklyTotal(tr, trEvents)
      const prev = rawWeeklyTotal(tr, trPrevEvents)
      let delta = null
      if (cur.unit === prev.unit && tr.tracker_type !== TRACKER_TYPES.GROWTH && weekOffset <= 0) {
        delta = deltaVs(cur.num, prev.num, weekOffset)
      }
      switch (tr.tracker_type) {
        case TRACKER_TYPES.FEEDING: {
          const ml = trEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
          map[tr.id] = { value: ml > 0 ? ml.toLocaleString() : trEvents.length, unit: ml > 0 ? 'מ"ל' : 'האכלות', delta }
          break
        }
        case TRACKER_TYPES.DIAPER:
          map[tr.id] = { value: trEvents.length, unit: 'החלפות', delta }
          break
        case TRACKER_TYPES.SLEEP: {
          const pairs = pairSleepEvents(trEvents)
          const totalHours = pairs.reduce(
            (s, p) => s + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)) / 3600000, 0
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
            map[tr.id] = { value: `${trEvents.length}/${doses * elapsedDaysInWeek}`, unit: 'מינונים', delta }
          }
          break
        }
        case TRACKER_TYPES.GROWTH: {
          const lastGrowth = [...trEvents].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))[0]
          const lastW = lastGrowth?.data?.weight_kg
          const lastH = lastGrowth?.data?.height_cm
          if (lastW != null)      map[tr.id] = { value: `${parseFloat(lastW)}`, unit: 'ק"ג', delta: null }
          else if (lastH != null) map[tr.id] = { value: `${parseFloat(lastH)}`, unit: 'ס"מ גובה', delta: null }
          else                    map[tr.id] = { value: '—', unit: 'גרף גדילה', delta: null }
          break
        }
        default:
          map[tr.id] = { value: trEvents.length, unit: 'אירועים', delta }
      }
    })
    return map
  }, [events, prevEvents, activeTrackers, weekOffset, elapsedDaysInWeek])

  const feedingTracker     = activeTrackers.find(t => t.tracker_type === TRACKER_TYPES.FEEDING)
  const nonFeedingTrackers = activeTrackers.filter(t => t.tracker_type !== TRACKER_TYPES.FEEDING)

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('reports.title')}</h1>
        {activeChild?.birth_date && (
          <div className="bg-cream-100 rounded-full px-3 py-1">
            <p className="font-rubik text-brown-500 text-xs font-medium">
              {activeChild.name} · {formatAge(activeChild.birth_date)}
            </p>
          </div>
        )}
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-2 bg-white rounded-2xl shadow-soft px-3 py-3">
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
      ) : activeTrackers.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📊</div>
          <p className="font-rubik font-semibold text-brown-600">{t('reports.noData')}</p>
        </div>
      ) : (
        <>
          {/* Feeding hero card — full width, featured */}
          {feedingTracker && (
            <FeedingHeroCard
              tracker={feedingTracker}
              events={events.filter(e => e.tracker_id === feedingTracker.id)}
              prevEvents={prevEvents.filter(e => e.tracker_id === feedingTracker.id)}
              weekDays={weekDays}
              elapsedDays={elapsedDaysInWeek}
              weekOffset={weekOffset}
              onClick={() => setSelectedTracker(feedingTracker)}
            />
          )}

          {/* Other trackers — 2-column grid */}
          {nonFeedingTrackers.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {nonFeedingTrackers.map(tr => (
                <TrackerTile
                  key={tr.id}
                  tracker={tr}
                  summary={summaries[tr.id] ?? { value: 0, unit: 'אירועים' }}
                  onClick={() => setSelectedTracker(tr)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedTracker && (
        <TrackerDetailSheet
          tracker={selectedTracker}
          weekEvents={events.filter(e => e.tracker_id === selectedTracker.id)}
          prevWeekEvents={prevEvents.filter(e => e.tracker_id === selectedTracker.id)}
          weekDays={weekDays}
          prevWeekDays={prevWeekDays}
          familyId={identity.familyId}
          childId={identity.activeChildId}
          child={activeChild}
          weekOffset={weekOffset}
          onClose={() => setSelectedTracker(null)}
        />
      )}
    </div>
  )
}

// ── Feeding hero card ────────────────────────────────────────────────────────
// Full-width featured card. Feeding is the #1 metric parents check, so it
// gets prominent treatment: large number, sparkline, projected total, and
// a smart insight chip showing peak feeding time + best day.
function FeedingHeroCard({ tracker, events, prevEvents, weekDays, elapsedDays, weekOffset, onClick }) {
  const totalMl       = events.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
  const prevMl        = prevEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
  const count         = events.length
  const avgPerFeeding = count > 0 ? Math.round(totalMl / count) : 0
  const avgPerDay     = elapsedDays > 0 ? Math.round(totalMl / elapsedDays) : 0

  // Projected weekly total — only shown mid-week for the current week
  const projected = weekOffset === 0 && elapsedDays > 0 && elapsedDays < 7
    ? Math.round((totalMl / elapsedDays) * 7) : null

  const delta = weekOffset <= 0 ? deltaVs(totalMl, prevMl, weekOffset) : null

  // Mini sparkline data (Sun→Sat reversed for RTL reading: recent on right)
  const sparkData = weekDays.map(day => ({
    day: dayLabel(day),
    ml:  events
      .filter(e => isSameDay(new Date(e.occurred_at), day))
      .reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0),
  })).reverse()

  const bestDay = sparkData.length > 0
    ? sparkData.reduce((best, d) => d.ml > best.ml ? d : best, sparkData[0])
    : null

  const tod    = countByTimeOfDay(events)
  const topTod = ['morning', 'afternoon', 'evening', 'night'].reduce(
    (a, b) => tod[a] >= tod[b] ? a : b
  )

  const deltaColor = !delta || delta.dir === 'flat'
    ? '#A87048'
    : delta.dir === 'up' ? '#22C55E' : '#EF4444'

  const deltaBg = !delta || delta.dir === 'flat'
    ? '#F5E6D3'
    : delta.dir === 'up' ? '#F0FDF4' : '#FEF2F2'

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-3xl shadow-soft overflow-hidden text-right active:scale-[0.98] transition-transform"
    >
      <div className="h-1.5" style={{ backgroundColor: tracker.color }} />
      <div className="p-4">

        {/* Row 1: tracker name + delta badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tracker.icon}</span>
            <div>
              <p className="font-rubik font-bold text-brown-800 text-base leading-tight">{tracker.name}</p>
              <p className="font-rubik text-brown-300 text-[11px]">הקש לפרטים מלאים ›</p>
            </div>
          </div>
          {delta && delta.pct !== 0 && (
            <div className="rounded-full px-2.5 py-1 flex-shrink-0" style={{ backgroundColor: deltaBg }}>
              <p className="font-rubik font-bold text-xs" style={{ color: deltaColor }}>
                {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'} {delta.text}
              </p>
            </div>
          )}
        </div>

        {/* Row 2: big number + sparkline */}
        <div className="flex items-end justify-between mb-4">
          <div className="min-w-0 flex-1">
            {totalMl > 0 ? (
              <>
                <p className="font-rubik font-bold text-[44px] text-brown-800 leading-none">
                  {totalMl.toLocaleString()}
                </p>
                <p className="font-rubik text-brown-400 text-sm mt-1">מ&quot;ל סה&quot;כ השבוע</p>
              </>
            ) : count > 0 ? (
              <>
                <p className="font-rubik font-bold text-[44px] text-brown-800 leading-none">{count}</p>
                <p className="font-rubik text-brown-400 text-sm mt-1">האכלות השבוע</p>
              </>
            ) : (
              <p className="font-rubik text-brown-300 text-xl py-3">אין נתונים עדיין</p>
            )}
          </div>

          {sparkData.some(d => d.ml > 0) && (
            <div className="w-28 h-16 flex-shrink-0 mr-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }} barSize={13}>
                  <Bar dataKey="ml" fill={tracker.color} radius={[3,3,0,0]} opacity={0.75} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Row 3: quick stats */}
        <div className="grid grid-cols-3 gap-0 pt-3 border-t border-cream-200">
          <div className="text-center px-2">
            <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">{count}</p>
            <p className="font-rubik text-brown-400 text-[10px] mt-0.5">האכלות</p>
          </div>
          <div className="text-center px-2 border-x border-cream-200">
            <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">{avgPerFeeding}</p>
            <p className="font-rubik text-brown-400 text-[10px] mt-0.5">מ&quot;ל ממוצע</p>
          </div>
          {projected != null ? (
            <div className="text-center px-2">
              <p className="font-rubik font-bold text-lg leading-tight" style={{ color: tracker.color }}>
                ~{projected.toLocaleString()}
              </p>
              <p className="font-rubik text-brown-400 text-[10px] mt-0.5">צפי שבועי</p>
            </div>
          ) : (
            <div className="text-center px-2">
              <p className="font-rubik font-bold text-brown-800 text-lg leading-tight">{avgPerDay}</p>
              <p className="font-rubik text-brown-400 text-[10px] mt-0.5">מ&quot;ל ליום</p>
            </div>
          )}
        </div>

        {/* Row 4: insight chip */}
        {count > 0 && (
          <div
            className="mt-3 rounded-2xl px-3 py-2 flex items-center gap-2"
            style={{ backgroundColor: `${tracker.color}18` }}
          >
            <span className="text-base flex-shrink-0">{TOD_LABEL[topTod].split(' ')[0]}</span>
            <p className="font-rubik text-xs leading-relaxed" style={{ color: tracker.color }}>
              רוב האכלות ב{TOD_LABEL[topTod].replace(/^.+?\s/, '')}
              {bestDay?.ml > 0 && bestDay.day
                ? ` · הכי הרבה ב${bestDay.day} (${bestDay.ml.toLocaleString()} מ"ל)`
                : ''}
            </p>
          </div>
        )}
      </div>
    </button>
  )
}

// ── Delta pill (compact, muted — going up isn't always good) ─────────────────
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
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-2xl">{tracker.icon}</span>
          <span className="text-brown-200 text-base">›</span>
        </div>
        <p className="font-rubik text-brown-400 text-[11px] truncate mb-0.5">{tracker.name}</p>
        <p className="font-rubik font-bold text-2xl text-brown-800 leading-none">{summary.value}</p>
        <p className="font-rubik text-brown-400 text-xs mt-0.5">{summary.unit}</p>
        {summary.delta && <DeltaPill delta={summary.delta} />}
      </div>
    </button>
  )
}

// ── Tracker detail bottom sheet ──────────────────────────────────────────────
function TrackerDetailSheet({
  tracker, weekEvents, prevWeekEvents, weekDays, prevWeekDays,
  familyId, childId, child, weekOffset, onClose,
}) {
  const isGrowth = tracker.tracker_type === TRACKER_TYPES.GROWTH

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
            prevWeekEvents={prevWeekEvents}
            weekDays={weekDays}
            prevWeekDays={prevWeekDays}
            weekOffset={weekOffset}
          />
        )}
      </div>
    </BottomSheet>
  )
}

// ── Comparison banner (this week vs previous week) ───────────────────────────
function ComparisonBanner({ tracker, thisValue, prevValue, unit, weekOffset }) {
  if (prevValue === 0) return null
  const delta = deltaVs(thisValue, prevValue, weekOffset)
  const arrowColor = delta.dir === 'up' ? '#22C55E' : delta.dir === 'down' ? '#EF4444' : '#A87048'

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-2"
      style={{ backgroundColor: `${tracker.color}12` }}
    >
      <div className="flex-1 text-center">
        <p className="font-rubik text-[11px] text-brown-400 mb-1">שבוע זה</p>
        <p className="font-rubik font-bold text-2xl text-brown-800">
          {typeof thisValue === 'number' ? thisValue.toLocaleString() : thisValue}
        </p>
        <p className="font-rubik text-[11px] text-brown-400">{unit}</p>
      </div>
      <div className="flex flex-col items-center gap-0.5 px-1 flex-shrink-0">
        <p className="font-rubik font-bold text-base" style={{ color: arrowColor }}>
          {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'}
        </p>
        {delta.pct !== null && delta.pct !== 0 && (
          <p className="font-rubik text-xs font-semibold" style={{ color: arrowColor }}>
            {Math.abs(delta.pct)}%
          </p>
        )}
      </div>
      <div className="flex-1 text-center opacity-55">
        <p className="font-rubik text-[11px] text-brown-400 mb-1">
          {weekOffset === 0 ? 'שבוע שעבר' : 'שבוע קודם'}
        </p>
        <p className="font-rubik font-bold text-2xl text-brown-600">
          {typeof prevValue === 'number' ? prevValue.toLocaleString() : prevValue}
        </p>
        <p className="font-rubik text-[11px] text-brown-400">{unit}</p>
      </div>
    </div>
  )
}

// ── Chart legend for dual bars ───────────────────────────────────────────────
function DualBarLegend({ color, weekOffset }) {
  return (
    <div className="flex gap-4 justify-center text-[11px] font-rubik text-brown-400 mt-1.5">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color, opacity: 0.3 }} />
        {weekOffset === 0 ? 'שבוע שעבר' : 'שבוע קודם'}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        השבוע
      </span>
    </div>
  )
}

// ── Standard weekly chart + stats ────────────────────────────────────────────
function TrackerChartContent({ tracker, weekEvents, prevWeekEvents, weekDays, prevWeekDays, weekOffset }) {
  const type = tracker.tracker_type

  // ── Feeding ─────────────────────────────────────────────────────────────
  if (type === TRACKER_TYPES.FEEDING) {
    const data = weekDays.map((day, i) => {
      const de      = weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day))
      const prevDay = prevWeekDays?.[i]
      const prevDe  = prevDay ? prevWeekEvents.filter(e => isSameDay(new Date(e.occurred_at), prevDay)) : []
      return {
        day:    dayLabel(day),
        ml:     de.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0),
        count:  de.length,
        prevMl: prevDe.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0),
      }
    }).reverse()

    const totalMl       = data.reduce((s, d) => s + d.ml, 0)
    const prevTotalMl   = data.reduce((s, d) => s + d.prevMl, 0)
    const totalCount    = data.reduce((s, d) => s + d.count, 0)
    const activeDays    = data.filter(d => d.ml > 0).length
    const avgMl         = activeDays > 0 ? Math.round(totalMl / activeDays) : 0
    const avgPerFeeding = totalCount > 0 ? Math.round(totalMl / totalCount) : 0
    const hasPrev       = prevTotalMl > 0

    return (
      <>
        <ComparisonBanner
          tracker={tracker}
          thisValue={totalMl}
          prevValue={prevTotalMl}
          unit='מ"ל'
          weekOffset={weekOffset}
        />

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label='סה"כ מ"ל' value={totalMl.toLocaleString()} color={tracker.color} />
          <MiniStat label="האכלות" value={totalCount} color={tracker.color} />
          <MiniStat label='מ"ל ממוצע/יום' value={avgMl} color={tracker.color} />
          <MiniStat label='מ"ל ממוצע/האכלה' value={avgPerFeeding} color={tracker.color} />
        </div>

        {data.some(d => d.ml > 0) && (
          <div>
            <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">
              {hasPrev ? 'השוואה יומית — השבוע לעומת הקודם' : 'מ"ל לפי יום'}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                <XAxis dataKey="day" {...AXIS} />
                <YAxis
                  {...AXIS} width={52} orientation="left"
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`}
                />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(v, name) => [
                    `${v} מ"ל`,
                    name === 'ml' ? 'השבוע' : (weekOffset === 0 ? 'שבוע שעבר' : 'שבוע קודם'),
                  ]}
                />
                {hasPrev && (
                  <Bar dataKey="prevMl" fill={tracker.color} radius={[3,3,0,0]} maxBarSize={16} opacity={0.28} name="prevMl" />
                )}
                <Bar dataKey="ml" fill={tracker.color} radius={[6,6,0,0]} maxBarSize={16} name="ml" />
              </BarChart>
            </ResponsiveContainer>
            {hasPrev && <DualBarLegend color={tracker.color} weekOffset={weekOffset} />}
          </div>
        )}

        <TimeOfDayBreakdown events={weekEvents} color={tracker.color} />
        <DryEvents events={weekEvents} tracker={tracker} />
      </>
    )
  }

  // ── Diaper ──────────────────────────────────────────────────────────────
  if (type === TRACKER_TYPES.DIAPER) {
    const data = weekDays.map((day, i) => {
      const prevDay = prevWeekDays?.[i]
      return {
        day:       dayLabel(day),
        count:     weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day)).length,
        prevCount: prevDay ? prevWeekEvents.filter(e => isSameDay(new Date(e.occurred_at), prevDay)).length : 0,
      }
    }).reverse()

    const total     = data.reduce((s, d) => s + d.count, 0)
    const prevTotal = data.reduce((s, d) => s + d.prevCount, 0)
    const hasPrev   = prevTotal > 0

    return (
      <>
        <ComparisonBanner
          tracker={tracker}
          thisValue={total}
          prevValue={prevTotal}
          unit="החלפות"
          weekOffset={weekOffset}
        />

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label='סה"כ החלפות' value={total} color={tracker.color} />
          <MiniStat label="ממוצע/יום" value={Math.round(total / 7 * 10) / 10} color={tracker.color} />
        </div>

        {data.some(d => d.count > 0) && (
          <div>
            {hasPrev && (
              <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">
                השוואה יומית
              </p>
            )}
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                <XAxis dataKey="day" {...AXIS} />
                <YAxis {...AXIS} width={30} orientation="left" allowDecimals={false} />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(v, name) => [
                    v,
                    name === 'count' ? 'השבוע' : (weekOffset === 0 ? 'שבוע שעבר' : 'שבוע קודם'),
                  ]}
                />
                {hasPrev && (
                  <Bar dataKey="prevCount" fill={tracker.color} radius={[3,3,0,0]} maxBarSize={16} opacity={0.28} />
                )}
                <Bar dataKey="count" fill={tracker.color} radius={[6,6,0,0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
            {hasPrev && <DualBarLegend color={tracker.color} weekOffset={weekOffset} />}
          </div>
        )}

        <TimeOfDayBreakdown events={weekEvents} color={tracker.color} />
        <DryEvents events={weekEvents} tracker={tracker} />
      </>
    )
  }

  // ── Sleep ────────────────────────────────────────────────────────────────
  if (type === TRACKER_TYPES.SLEEP) {
    const weekPairs = pairSleepEvents(weekEvents)
    const data = weekDays.map(day => {
      const ms = weekPairs
        .filter(p => isSameDay(new Date(p.start.occurred_at), day))
        .reduce((sum, p) => sum + (new Date(p.end.occurred_at) - new Date(p.start.occurred_at)), 0)
      return { day: dayLabel(day), hours: Math.round(ms / 3600000 * 10) / 10 }
    }).reverse()

    const total      = Math.round(data.reduce((s, d) => s + d.hours, 0) * 10) / 10
    const activeDays = data.filter(d => d.hours > 0).length
    const avg        = activeDays > 0 ? Math.round(total / activeDays * 10) / 10 : 0

    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label='סה"כ שינה' value={`${total} שע'`} color={tracker.color} />
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

  // ── Vitamin D / Dose — compliance grid ──────────────────────────────────
  const isSimpleDose = type === TRACKER_TYPES.DOSE && (tracker.config?.display_mode === 'simple')
  if ((type === TRACKER_TYPES.VITAMIN_D || type === TRACKER_TYPES.DOSE) && !isSimpleDose) {
    const config     = tracker.config ?? {}
    const doseCount  = config.daily_doses ?? 2
    const doseLabels = config.dose_labels ?? ['בוקר', 'ערב']
    const days = weekDays.map(day => {
      const de    = weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day))
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
                <div
                  key={i}
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

  // ── Custom / simple dose ─────────────────────────────────────────────────
  const data = weekDays.map(day => ({
    day:   dayLabel(day),
    count: weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day)).length,
  })).reverse()
  const total     = data.reduce((s, d) => s + d.count, 0)
  const config    = tracker.config ?? {}
  const maxPerDay = config.daily_doses
  return (
    <>
      <MiniStat label='סה"כ אירועים' value={total} color={tracker.color} />
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
  const pct   = Math.max(2, Math.min(98, percentile))
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
      <p className="font-rubik font-bold text-xl text-brown-800 leading-tight">
        {value} <span className="text-sm font-normal text-brown-400">{unit}</span>
      </p>
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
  const [metric, setMetric] = useState('weight')

  const birthDate = child?.birth_date
  const gender    = child?.gender

  const measurements = useMemo(() => {
    return [...events]
      .filter(e => e.data?.weight_kg != null || e.data?.height_cm != null || e.data?.head_cm != null)
      .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      .map(e => ({
        date:   new Date(e.occurred_at),
        weight: e.data?.weight_kg != null ? parseFloat(e.data.weight_kg) : null,
        height: e.data?.height_cm != null ? parseFloat(e.data.height_cm) : null,
        head:   e.data?.head_cm   != null ? parseFloat(e.data.head_cm)   : null,
        age:    birthDate ? ageInMonths(birthDate, e.occurred_at) : null,
      }))
  }, [events, birthDate])

  const last = measurements[measurements.length - 1]
  const prev = measurements[measurements.length - 2]

  const whoWeightTable = gender === 'female' ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS
  const whoHeightTable = gender === 'female' ? WHO_HEIGHT_GIRLS : WHO_HEIGHT_BOYS
  const whoHeadTable   = gender === 'female' ? WHO_HEAD_GIRLS   : WHO_HEAD_BOYS

  const weightLabel = last?.weight != null && last.age != null ? getWeightPercentileLabel(last.weight, last.age, gender) : null
  const heightLabel = last?.height != null && last.age != null ? getHeightPercentileLabel(last.height, last.age, gender) : null
  const headLabel   = last?.head   != null && last.age != null ? getHeadPercentileLabel(last.head,   last.age, gender) : null

  const allLabels = [weightLabel, heightLabel, headLabel].filter(Boolean)
  const overallStatus = useMemo(() => {
    if (allLabels.length === 0) return null
    const hasCritical = allLabels.some(l => l.band === 'low' || l.band === 'high')
    const hasWarning  = allLabels.some(l => l.band === 'low-normal' || l.band === 'high-normal')
    if (hasCritical) return { emoji: '📋', title: 'מדד אחד חורג מהטווח',  sub: 'המידע להשוואה בלבד — ראו הערה למטה', color: '#F59E0B', bg: '#FFFBEB' }
    if (hasWarning)  return { emoji: '🔍', title: 'מדד אחד לתשומת לב',    sub: 'המידע להשוואה בלבד — ראו הערה למטה', color: '#F59E0B', bg: '#FFFBEB' }
    return             { emoji: '✅', title: 'כל המדדים בטווח WHO',      sub: 'המידע להשוואה בלבד — ראו הערה למטה', color: '#22C55E', bg: '#F0FDF4' }
  }, [allLabels])

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

  const chartData = useMemo(() => {
    if (!birthDate) return null
    const validAges  = measurements.map(m => m.age).filter(a => a != null)
    const babyMaxAge = validAges.length > 0 ? Math.max(...validAges) : 0
    const endAge     = Math.min(36, Math.max(6, Math.ceil(babyMaxAge) + 2))
    const ageSet     = new Set(Array.from({length: endAge + 1}, (_, i) => i))
    measurements.forEach(m => { if (m.age != null) ageSet.add(Math.round(m.age * 10) / 10) })
    const ages = [...ageSet].sort((a, b) => a - b)
    return ages.map(age => {
      const roundedAge = Math.round(age * 10) / 10
      if (metric === 'weight') {
        const ref = interpolateWHO(whoWeightTable, age)
        const m   = measurements.find(me => me.weight != null && me.age != null && Math.abs(me.age - age) < 0.06)
        return { age: roundedAge, p3: ref?.[0], p15: ref?.[1], p50: ref?.[2], p85: ref?.[3], p97: ref?.[4], baby: m?.weight ?? null }
      } else if (metric === 'height') {
        const ref = interpolateWHO(whoHeightTable, age)
        const m   = measurements.find(me => me.height != null && me.age != null && Math.abs(me.age - age) < 0.06)
        return { age: roundedAge, p3: ref?.[0], p50: ref?.[1], p97: ref?.[2], baby: m?.height ?? null }
      } else {
        const ref = interpolateWHO(whoHeadTable, age)
        const m   = measurements.find(me => me.head != null && me.age != null && Math.abs(me.age - age) < 0.06)
        return { age: roundedAge, p3: ref?.[0], p50: ref?.[1], p97: ref?.[2], baby: m?.head ?? null }
      }
    })
  }, [measurements, metric, birthDate, gender])

  const unit        = metric === 'weight' ? 'ק"ג' : 'ס"מ'
  const hasHead     = measurements.some(m => m.head != null)
  const chartHasData = chartData && chartData.length > 0 && measurements.some(m =>
    metric === 'weight' ? m.weight != null : metric === 'height' ? m.height != null : m.head != null
  )

  return (
    <div className="space-y-4">
      {measurements.length === 0 && (
        <div className="text-center py-8">
          <p className="font-rubik text-brown-400 text-sm">אין מדידות עדיין</p>
          <p className="font-rubik text-brown-300 text-xs mt-1">הוסף מדידה מדף הבית</p>
        </div>
      )}

      {overallStatus && birthDate && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: overallStatus.bg }}>
          <span className="text-2xl flex-shrink-0">{overallStatus.emoji}</span>
          <div>
            <p className="font-rubik font-bold text-sm" style={{ color: overallStatus.color }}>{overallStatus.title}</p>
            <p className="font-rubik text-xs text-brown-500 mt-0.5">{overallStatus.sub}</p>
          </div>
        </div>
      )}

      {measurements.length > 0 && (
        <div className="flex gap-2">
          <MetricCard icon="⚖️" label="משקל"     value={last.weight} unit='ק"ג' pLabel={birthDate ? weightLabel : null} />
          <MetricCard icon="📏" label="גובה"      value={last.height} unit='ס"מ' pLabel={birthDate ? heightLabel : null} />
          {hasHead && <MetricCard icon="🔵" label='היקף ראש' value={last.head} unit='ס"מ' pLabel={birthDate ? headLabel : null} />}
        </div>
      )}

      {delta && (
        <div className="bg-cream-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-base">📈</span>
          <div>
            <p className="font-rubik text-xs text-brown-400">מאז מדידה קודמת ({delta.date})</p>
            <p className="font-rubik text-sm font-semibold text-brown-700">{delta.text}</p>
          </div>
        </div>
      )}

      {!birthDate && measurements.length > 0 && (
        <div className="bg-amber-50 rounded-2xl px-4 py-3 text-center">
          <p className="font-rubik text-amber-700 text-sm">
            💡 הוסף תאריך לידה בהגדרות הילד/ה כדי לראות אחוזוני WHO
          </p>
        </div>
      )}

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

      {measurements.length > 0 && (
        <div className="bg-cream-100 rounded-2xl px-4 py-3">
          <p className="font-rubik text-xs text-brown-400 leading-relaxed text-center">
            ⚠️ המידע מוצג לצורך מעקב אישי בלבד, על בסיס טבלאות WHO (2006).
            אינו מהווה ייעוץ רפואי ואינו מחליף בדיקה אצל רופא ילדים.
            ייתכנו שגיאות חישוב.
          </p>
        </div>
      )}

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

// ── Time-of-day breakdown ─────────────────────────────────────────────────────
function TimeOfDayBreakdown({ events, color, title = 'מתי קרה השבוע' }) {
  if (!events.length) return null
  const counts = countByTimeOfDay(events)
  const total  = events.length
  const order  = ['morning', 'afternoon', 'evening', 'night']
  const max    = Math.max(...order.map(k => counts[k]))
  const top    = order.reduce((a, b) => counts[a] >= counts[b] ? a : b)
  const topPct = Math.round((counts[top] / total) * 100)

  return (
    <div>
      <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">{title}</p>
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
function MiniStat({ label, value }) {
  return (
    <div className="bg-cream-100 rounded-2xl px-3 py-2.5 text-center">
      <p className="font-rubik font-bold text-xl text-brown-800 leading-none">{value}</p>
      <p className="font-rubik text-brown-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}

// ── Recent events list (last 5) ──────────────────────────────────────────────
function DryEvents({ events, tracker }) {
  if (events.length === 0) return null
  const sorted = [...events].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0, 5)
  const schema = tracker.field_schema ?? []

  function summarise(e) {
    if (!e.data || Object.keys(e.data).length === 0) return null
    if (tracker.tracker_type === TRACKER_TYPES.DIAPER) {
      const map = { wet: t('diaper.wet'), dirty: t('diaper.dirty'), both: t('diaper.both') }
      return map[e.data.type] ?? ''
    }
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
