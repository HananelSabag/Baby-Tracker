import { useState, useMemo } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useEvents } from '../hooks/useEvents'
import { useChildren } from '../hooks/useChildren'
import { TRACKER_TYPES } from '../lib/constants'
import {
  format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, isSameDay,
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
  interpolateWHO, ageInMonths, getWeightPercentileLabel, getHeightPercentileLabel,
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

  const weekLabel   = `${format(weekStart, 'd בMMM', { locale: he })} — ${format(weekEnd, 'd בMMM', { locale: he })}`
  const weekContext = weekOffset === 0 ? 'שבוע זה' : weekOffset === -1 ? 'שבוע שעבר' : `לפני ${Math.abs(weekOffset)} שבועות`

  const { events, loading: eventsLoading } = useEvents(identity.familyId, {
    startDate: weekStart,
    endDate:   weekEnd,
    childId:   identity.activeChildId,
  })

  const loading = trackersLoading || eventsLoading

  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null
  const activeTackers = trackers.filter(tr => tr.is_active !== false)

  // Compute per-tracker weekly summary for the grid tiles
  const summaries = useMemo(() => {
    const map = {}
    activeTackers.forEach(tr => {
      const trEvents = events.filter(e => e.tracker_id === tr.id)
      switch (tr.tracker_type) {
        case TRACKER_TYPES.FEEDING: {
          const ml = trEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0)
          map[tr.id] = { value: ml > 0 ? `${ml}` : trEvents.length, unit: ml > 0 ? 'מ"ל' : 'האכלות' }
          break
        }
        case TRACKER_TYPES.DIAPER:
          map[tr.id] = { value: trEvents.length, unit: 'החלפות' }
          break
        case TRACKER_TYPES.SLEEP: {
          const pairs = []
          const sorted = [...trEvents].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].data?.type === 'start' && sorted[i+1]?.data?.type === 'end') {
              pairs.push((new Date(sorted[i+1].occurred_at) - new Date(sorted[i].occurred_at)) / 3600000)
              i++
            }
          }
          const total = Math.round(pairs.reduce((s, h) => s + h, 0) * 10) / 10
          map[tr.id] = { value: total, unit: "שע' שינה" }
          break
        }
        case TRACKER_TYPES.VITAMIN_D: {
          const config = tr.config ?? {}
          const doses = config.daily_doses ?? 2
          const given = trEvents.length
          map[tr.id] = { value: `${given}/${doses * 7}`, unit: 'מינונים' }
          break
        }
        case TRACKER_TYPES.GROWTH: {
          // Most recent measurement this child has (all time, not just week)
          map[tr.id] = { value: '⚖️', unit: 'לחץ לגרף גדילה' }
          break
        }
        default:
          map[tr.id] = { value: trEvents.length, unit: 'אירועים' }
      }
    })
    return map
  }, [events, activeTackers])

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-4">{t('reports.title')}</h1>

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
        <DryEvents events={weekEvents} tracker={tracker} />
      </>
    )
  }

  // Sleep
  if (type === TRACKER_TYPES.SLEEP) {
    const data = weekDays.map(day => {
      const de = [...weekEvents.filter(e => isSameDay(new Date(e.occurred_at), day))]
        .sort((a,b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      let ms = 0
      for (let i = 0; i < de.length; i++) {
        if (de[i].data?.type === 'start' && de[i+1]?.data?.type === 'end') {
          ms += new Date(de[i+1].occurred_at) - new Date(de[i].occurred_at)
          i++
        }
      }
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

  // Vitamin D — compliance grid
  if (type === TRACKER_TYPES.VITAMIN_D) {
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

// ── Growth detail with WHO curves ────────────────────────────────────────────
function GrowthDetailContent({ events, child, tracker }) {
  const [metric, setMetric] = useState('weight') // 'weight' | 'height'

  const birthDate = child?.birth_date
  const gender    = child?.gender // 'male' | 'female' | null

  // Parse measurements sorted oldest-first
  const measurements = useMemo(() => {
    return [...events]
      .filter(e => e.data?.weight_kg != null || e.data?.height_cm != null)
      .sort((a,b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      .map(e => ({
        date: new Date(e.occurred_at),
        weight: e.data?.weight_kg != null ? parseFloat(e.data.weight_kg) : null,
        height: e.data?.height_cm != null ? parseFloat(e.data.height_cm) : null,
        age: birthDate ? ageInMonths(birthDate, e.occurred_at) : null,
      }))
  }, [events, birthDate])

  // Last measurement for the summary
  const last = measurements[measurements.length - 1]
  const lastWeight = last?.weight
  const lastHeight = last?.height
  const lastAge    = last?.age

  // WHO reference table for selected metric
  const whoWeightTable = gender === 'female' ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS
  const whoHeightTable = gender === 'female' ? WHO_HEIGHT_GIRLS : WHO_HEIGHT_BOYS

  // Build chart data: 0-24 months reference + actual measurements
  const chartData = useMemo(() => {
    if (!birthDate) return null
    const maxAge = Math.min(
      Math.ceil(Math.max(24, ...measurements.map(m => m.age ?? 0))),
      36
    )

    // All distinct age-months to plot (every integer + actual measurement ages)
    const ageSet = new Set(Array.from({length: maxAge + 1}, (_, i) => i))
    measurements.forEach(m => {
      if (m.age != null) ageSet.add(Math.round(m.age * 2) / 2)
    })
    const ages = [...ageSet].sort((a,b) => a - b)

    return ages.map(age => {
      if (metric === 'weight') {
        const ref = interpolateWHO(whoWeightTable, age)
        // [p3, p15, p50, p85, p97]
        const m = measurements.find(me => me.weight != null && me.age != null && Math.abs(me.age - age) < 0.26)
        return {
          age,
          p3:   ref?.[0],
          p50:  ref?.[2],
          p97:  ref?.[4],
          baby: m?.weight ?? null,
        }
      } else {
        const ref = interpolateWHO(whoHeightTable, age)
        // [p3, p50, p97]
        const m = measurements.find(me => me.height != null && me.age != null && Math.abs(me.age - age) < 0.26)
        return {
          age,
          p3:   ref?.[0],
          p50:  ref?.[1],
          p97:  ref?.[2],
          baby: m?.height ?? null,
        }
      }
    })
  }, [measurements, metric, birthDate, gender])

  // Percentile label for last measurement
  const percentileLabel = useMemo(() => {
    if (!lastAge) return null
    if (metric === 'weight' && lastWeight) return getWeightPercentileLabel(lastWeight, lastAge, gender)
    if (metric === 'height' && lastHeight) return getHeightPercentileLabel(lastHeight, lastAge, gender)
    return null
  }, [metric, lastWeight, lastHeight, lastAge, gender])

  const unit = metric === 'weight' ? 'ק"ג' : 'ס"מ'

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex gap-3">
        {lastWeight != null && (
          <div className="flex-1 bg-cream-100 rounded-2xl p-3 text-center">
            <p className="font-rubik font-bold text-2xl text-brown-800">{lastWeight}</p>
            <p className="font-rubik text-brown-400 text-xs">ק"ג</p>
          </div>
        )}
        {lastHeight != null && (
          <div className="flex-1 bg-cream-100 rounded-2xl p-3 text-center">
            <p className="font-rubik font-bold text-2xl text-brown-800">{lastHeight}</p>
            <p className="font-rubik text-brown-400 text-xs">ס"מ</p>
          </div>
        )}
        {measurements.length === 0 && (
          <div className="flex-1 text-center py-4">
            <p className="font-rubik text-brown-400 text-sm">אין מדידות עדיין</p>
            <p className="font-rubik text-brown-300 text-xs mt-1">הוסף מדידה מדף הבית</p>
          </div>
        )}
      </div>

      {/* Percentile badge */}
      {percentileLabel && (
        <div
          className="rounded-2xl px-4 py-2 text-center"
          style={{ backgroundColor: `${tracker.color}20` }}
        >
          <p className="font-rubik text-sm font-semibold" style={{ color: tracker.color }}>
            {percentileLabel}
          </p>
        </div>
      )}

      {/* No birthdate warning */}
      {!birthDate && measurements.length > 0 && (
        <div className="bg-amber-50 rounded-2xl px-4 py-3 text-center">
          <p className="font-rubik text-amber-700 text-sm">
            💡 הוסף תאריך לידה בהגדרות הילד/ה כדי לראות גרף גדילה עם עקומות WHO
          </p>
        </div>
      )}

      {/* Metric tabs */}
      {measurements.length > 0 && (
        <div className="flex gap-2 bg-cream-200 rounded-2xl p-1">
          {[{ value: 'weight', label: '⚖️ משקל' }, { value: 'height', label: '📏 גובה' }].map(opt => (
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
      {chartData && chartData.length > 0 && measurements.some(m => metric === 'weight' ? m.weight : m.height) && (
        <>
          <p className="font-rubik text-xs text-brown-400 text-center">
            {birthDate ? `גרף גדילה לפי גיל בחודשים — עקומות WHO (P3, P50, P97)` : 'מדידות לאורך זמן'}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" />
              <XAxis
                dataKey="age"
                {...AXIS}
                label={{ value: 'גיל (חודשים)', position: 'insideBottom', offset: -2, fontFamily: 'Rubik', fontSize: 10, fill: '#A87048' }}
                tickFormatter={v => `${v}`}
                height={30}
              />
              <YAxis {...AXIS} width={36} orientation="left" domain={['auto', 'auto']} />
              <Tooltip
                {...CHART_TOOLTIP}
                formatter={(v, name) => {
                  if (v == null) return [null, name]
                  const labels = { p3: 'P3 (אחוזון 3)', p50: 'P50 (חציון)', p97: 'P97 (אחוזון 97)', baby: child?.name ?? 'הילד/ה' }
                  return [`${v} ${unit}`, labels[name] ?? name]
                }}
                labelFormatter={v => `גיל: ${v} חודשים`}
              />
              {/* WHO reference lines */}
              <Line dataKey="p3"  stroke="#D6C4B0" strokeWidth={1.5} strokeDasharray="4 2" dot={false} legendType="none" />
              <Line dataKey="p50" stroke="#A87048" strokeWidth={1.5} strokeDasharray="0"   dot={false} legendType="none" />
              <Line dataKey="p97" stroke="#D6C4B0" strokeWidth={1.5} strokeDasharray="4 2" dot={false} legendType="none" />
              {/* Baby measurements */}
              <Line
                dataKey="baby"
                stroke={tracker.color}
                strokeWidth={2.5}
                dot={{ fill: tracker.color, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                name="baby"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center text-xs font-rubik text-brown-400">
            <span><span className="inline-block w-5 h-0.5 bg-brown-300 mr-1 opacity-60" style={{verticalAlign:'middle',borderBottom:'1.5px dashed #D6C4B0'}} />P3 / P97</span>
            <span><span className="inline-block w-5 h-0.5 bg-brown-500 mr-1 opacity-70" style={{verticalAlign:'middle'}} />P50 (חציון)</span>
            <span style={{color: tracker.color}}>● {child?.name ?? 'הילד/ה'}</span>
          </div>
        </>
      )}

      {/* Dry events list */}
      {measurements.length > 0 && (
        <div>
          <p className="font-rubik font-semibold text-brown-600 text-xs uppercase tracking-wide mb-2">מדידות</p>
          <div className="space-y-2">
            {[...measurements].reverse().slice(0, 10).map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-cream-100 rounded-2xl px-4 py-2.5">
                <div className="flex gap-3">
                  {m.weight != null && (
                    <span className="font-rubik text-brown-800 text-sm font-medium">{m.weight} ק"ג</span>
                  )}
                  {m.height != null && (
                    <span className="font-rubik text-brown-800 text-sm font-medium">{m.height} ס"מ</span>
                  )}
                </div>
                <div className="text-left">
                  <p className="font-rubik text-brown-400 text-xs">
                    {format(m.date, 'd בMMM yyyy', { locale: he })}
                  </p>
                  {m.age != null && (
                    <p className="font-rubik text-brown-300 text-xs">
                      גיל: {Math.floor(m.age)} חו'
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
