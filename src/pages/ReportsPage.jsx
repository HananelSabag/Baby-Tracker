import { useState, useMemo } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useEvents } from '../hooks/useEvents'
import { TRACKER_TYPES } from '../lib/constants'
import {
  format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, isSameDay,
} from 'date-fns'
import { he } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Spinner } from '../components/ui/Spinner'

// Short Hebrew day label
function dayLabel(date) {
  return format(date, 'EEE', { locale: he })
}

const CHART_TOOLTIP = {
  contentStyle: {
    fontFamily: 'Rubik',
    borderRadius: 12,
    border: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    fontSize: 13,
  },
}
const AXIS = {
  axisLine: false,
  tickLine: false,
  tick: { fontFamily: 'Rubik', fontSize: 11, fill: '#A87048' },
}

export function ReportsPage() {
  const { identity } = useApp()
  const { trackers } = useTrackers(identity.familyId)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekBase = addWeeks(new Date(), weekOffset)
  const weekStart = startOfWeek(weekBase, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekBase, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const weekLabel = `${format(weekStart, 'd בMMM', { locale: he })} — ${format(weekEnd, 'd בMMM', { locale: he })}`
  const weekContext = weekOffset === 0 ? 'שבוע זה' : weekOffset === -1 ? 'שבוע שעבר' : `לפני ${Math.abs(weekOffset)} שבועות`

  const { events, loading } = useEvents(identity.familyId, {
    startDate: weekStart,
    endDate: weekEnd,
    childId: identity.activeChildId,
  })

  const feedingTracker  = trackers.find(tr => tr.tracker_type === TRACKER_TYPES.FEEDING)
  const diaperTracker   = trackers.find(tr => tr.tracker_type === TRACKER_TYPES.DIAPER)
  const vitaminDTracker = trackers.find(tr => tr.tracker_type === TRACKER_TYPES.VITAMIN_D)
  const sleepTracker    = trackers.find(tr => tr.tracker_type === TRACKER_TYPES.SLEEP)
  const doseTrackers    = trackers.filter(tr => tr.tracker_type === TRACKER_TYPES.DOSE)

  // Feeding data per day
  const feedingData = useMemo(() => {
    if (!feedingTracker) return []
    return weekDays.map(day => {
      const dayEvents = events.filter(e =>
        e.tracker_id === feedingTracker.id && isSameDay(new Date(e.occurred_at), day))
      return {
        day: dayLabel(day),
        ml: dayEvents.reduce((s, e) => s + (e.data?.amount_ml ?? 0), 0),
        count: dayEvents.length,
      }
    })
  }, [events, feedingTracker?.id, weekDays.length])

  // Diaper data per day
  const diaperData = useMemo(() => {
    if (!diaperTracker) return []
    return weekDays.map(day => ({
      day: dayLabel(day),
      count: events.filter(e =>
        e.tracker_id === diaperTracker.id && isSameDay(new Date(e.occurred_at), day)).length,
    }))
  }, [events, diaperTracker?.id, weekDays.length])

  // Sleep data per day (total hours from completed start→end pairs)
  const sleepData = useMemo(() => {
    if (!sleepTracker) return []
    return weekDays.map(day => {
      const dayEvents = events
        .filter(e => e.tracker_id === sleepTracker.id && isSameDay(new Date(e.occurred_at), day))
        .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      let totalMs = 0
      for (let i = 0; i < dayEvents.length; i++) {
        if (dayEvents[i].data?.type === 'start') {
          const next = dayEvents[i + 1]
          if (next?.data?.type === 'end') {
            totalMs += new Date(next.occurred_at) - new Date(dayEvents[i].occurred_at)
            i++
          }
        }
      }
      return { day: dayLabel(day), hours: Math.round((totalMs / 3600000) * 10) / 10 }
    })
  }, [events, sleepTracker?.id, weekDays.length])

  // Vitamin D compliance grid
  const vitaminDData = useMemo(() => {
    if (!vitaminDTracker) return null
    const config = vitaminDTracker.config ?? {}
    const doseCount = config.daily_doses ?? 2
    const doseLabels = config.dose_labels ?? ['בוקר', 'ערב']
    return {
      doseCount,
      doseLabels,
      days: weekDays.map(day => {
        const dayEvents = events.filter(e =>
          e.tracker_id === vitaminDTracker.id && isSameDay(new Date(e.occurred_at), day))
        const givenKeys = new Set(dayEvents.map(e => String(e.data?.dose_index ?? e.data?.dose)))
        return {
          label: dayLabel(day),
          doses: Array.from({ length: doseCount }, (_, i) => givenKeys.has(String(i))),
        }
      }),
    }
  }, [events, vitaminDTracker?.id, weekDays.length])

  const totalFeedingMl    = feedingData.reduce((s, d) => s + d.ml, 0)
  const activeFeedingDays = feedingData.filter(d => d.ml > 0).length
  const avgFeedingMl      = activeFeedingDays > 0 ? Math.round(totalFeedingMl / activeFeedingDays) : 0
  const totalFeedingCount = feedingData.reduce((s, d) => s + d.count, 0)
  const totalDiapers      = diaperData.reduce((s, d) => s + d.count, 0)
  const totalSleepHours   = sleepData.reduce((s, d) => s + d.hours, 0)
  const hasAnyData        = events.length > 0

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
      ) : !hasAnyData ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📊</div>
          <p className="font-rubik font-semibold text-brown-600 mb-1">{t('reports.noDataForWeek')}</p>
          <p className="font-rubik text-brown-400 text-sm">נסה לנווט לשבוע אחר</p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* Summary stat cards — 2-col grid */}
          <div className="grid grid-cols-2 gap-3">
            {feedingTracker && (
              <StatCard
                icon={feedingTracker.icon}
                label={feedingTracker.name}
                color={feedingTracker.color}
                value={totalFeedingCount}
                unit="האכלות"
                sub={avgFeedingMl > 0 ? `${avgFeedingMl} מ"ל/יום` : null}
              />
            )}
            {diaperTracker && (
              <StatCard
                icon={diaperTracker.icon}
                label={diaperTracker.name}
                color={diaperTracker.color}
                value={totalDiapers}
                unit="החלפות"
              />
            )}
            {sleepTracker && totalSleepHours > 0 && (
              <StatCard
                icon={sleepTracker.icon}
                label={sleepTracker.name}
                color={sleepTracker.color}
                value={totalSleepHours}
                unit={`שע' שינה`}
              />
            )}
          </div>

          {/* Feeding chart */}
          {feedingTracker && feedingData.some(d => d.ml > 0) && (
            <SectionCard icon={feedingTracker.icon} title={t('reports.mlPerDay')} color={feedingTracker.color}>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={[...feedingData].reverse()} margin={{ top: 4, right: 0, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                  <XAxis dataKey="day" {...AXIS} />
                  <YAxis {...AXIS} width={44} orientation="right" />
                  <Tooltip {...CHART_TOOLTIP} formatter={v => [`${v} מ"ל`, '']} />
                  <Bar dataKey="ml" fill={feedingTracker.color} radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Vitamin D compliance grid */}
          {vitaminDData && vitaminDTracker && (
            <SectionCard icon={vitaminDTracker.icon} title={t('reports.vitaminDWeek')} color={vitaminDTracker.color}>
              <div className="space-y-2">
                <div className="flex gap-1">
                  <div className="w-10" />
                  {vitaminDData.days.map((d, i) => (
                    <div key={i} className="flex-1 text-center text-xs font-rubik text-brown-400">{d.label}</div>
                  ))}
                </div>
                {Array.from({ length: vitaminDData.doseCount }, (_, di) => (
                  <div key={di} className="flex items-center gap-1">
                    <span className="text-xs font-rubik text-brown-500 w-10 text-right truncate">{vitaminDData.doseLabels[di]}</span>
                    {vitaminDData.days.map((d, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${d.doses[di] ? 'text-white' : 'bg-cream-200'}`}
                        style={d.doses[di] ? { backgroundColor: vitaminDTracker.color } : {}}
                      >
                        {d.doses[di] ? '✓' : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Diaper chart */}
          {diaperTracker && diaperData.some(d => d.count > 0) && (
            <SectionCard icon={diaperTracker.icon} title={t('reports.diapersPerDay')} color={diaperTracker.color}>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={[...diaperData].reverse()} margin={{ top: 4, right: 0, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                  <XAxis dataKey="day" {...AXIS} />
                  <YAxis {...AXIS} width={25} orientation="right" allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP} formatter={v => [v, '']} />
                  <Bar dataKey="count" fill={diaperTracker.color} radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Sleep chart */}
          {sleepTracker && sleepData.some(d => d.hours > 0) && (
            <SectionCard icon={sleepTracker.icon} title={t('reports.sleepPerDay')} color={sleepTracker.color}>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={[...sleepData].reverse()} margin={{ top: 4, right: 0, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                  <XAxis dataKey="day" {...AXIS} />
                  <YAxis {...AXIS} width={25} orientation="right" allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP} formatter={v => [`${v} שע'`, '']} />
                  <Bar dataKey="hours" fill={sleepTracker.color} radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Dose tracker charts */}
          {doseTrackers.map(tracker => {
            const doseData = weekDays.map(day => ({
              day: dayLabel(day),
              count: events.filter(e =>
                e.tracker_id === tracker.id && isSameDay(new Date(e.occurred_at), day)).length,
            }))
            if (doseData.every(d => d.count === 0)) return null
            return (
              <SectionCard key={tracker.id} icon={tracker.icon} title={tracker.name} color={tracker.color}>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={[...doseData].reverse()} margin={{ top: 4, right: 0, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                    <XAxis dataKey="day" {...AXIS} />
                    <YAxis {...AXIS} width={25} orientation="right" allowDecimals={false} />
                    <Tooltip {...CHART_TOOLTIP} formatter={v => [v, '']} />
                    <Bar dataKey="count" fill={tracker.color} radius={[6, 6, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            )
          })}

        </div>
      )}
    </div>
  )
}

// ── Stat card with colored top band ─────────────────────────────────────────
function StatCard({ icon, label, color, value, unit, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="p-4 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-base">{icon}</span>
          <p className="font-rubik text-brown-500 text-xs">{label}</p>
        </div>
        <p className="font-rubik font-bold text-3xl text-brown-800 leading-none">{value}</p>
        <p className="font-rubik text-brown-400 text-xs">{unit}</p>
        {sub && (
          <p className="font-rubik text-xs text-brown-400 border-t border-cream-200 pt-1.5 mt-1">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Chart / grid section with tinted header ──────────────────────────────────
function SectionCard({ icon, title, color, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: `${color}18` }}>
        <span className="text-base">{icon}</span>
        <p className="font-rubik font-semibold text-brown-800 text-sm">{title}</p>
      </div>
      <div className="px-3 pt-2 pb-3">
        {children}
      </div>
    </div>
  )
}
