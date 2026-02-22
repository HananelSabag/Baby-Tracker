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
import { Card } from '../components/ui/Card'

// Short Hebrew day label
function dayLabel(date) {
  return format(date, 'EEE', { locale: he })
}

export function ReportsPage() {
  const { identity } = useApp()
  const { trackers } = useTrackers(identity.familyId)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = last week

  // Week date range (Sunday–Saturday)
  const weekBase = addWeeks(new Date(), weekOffset)
  const weekStart = startOfWeek(weekBase, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekBase, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const weekLabel = `${format(weekStart, 'd בMMM', { locale: he })} — ${format(weekEnd, 'd בMMM', { locale: he })}`

  const { events, loading } = useEvents(identity.familyId, {
    startDate: weekStart,
    endDate: weekEnd,
    childId: identity.activeChildId,
  })

  const feedingTracker = trackers.find(t => t.tracker_type === TRACKER_TYPES.FEEDING)
  const diaperTracker = trackers.find(t => t.tracker_type === TRACKER_TYPES.DIAPER)
  const vitaminDTracker = trackers.find(t => t.tracker_type === TRACKER_TYPES.VITAMIN_D)
  const sleepTracker = trackers.find(t => t.tracker_type === TRACKER_TYPES.SLEEP)
  const doseTrackers = trackers.filter(t => t.tracker_type === TRACKER_TYPES.DOSE)

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
    return weekDays.map(day => {
      const count = events.filter(e =>
        e.tracker_id === diaperTracker.id && isSameDay(new Date(e.occurred_at), day)).length
      return { day: dayLabel(day), count }
    })
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

  // Summary stats
  const activeFeedingDays = feedingData.filter(d => d.ml > 0).length
  const totalFeedingMl = feedingData.reduce((s, d) => s + d.ml, 0)
  const avgFeedingMl = activeFeedingDays > 0 ? Math.round(totalFeedingMl / activeFeedingDays) : 0
  const totalFeedingCount = feedingData.reduce((s, d) => s + d.count, 0)
  const totalDiapers = diaperData.reduce((s, d) => s + d.count, 0)
  const hasAnyData = events.length > 0

  const chartTooltipStyle = {
    contentStyle: {
      fontFamily: 'Rubik',
      borderRadius: 12,
      border: 'none',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    },
  }
  const axisProps = { axisLine: false, tickLine: false, tick: { fontFamily: 'Rubik', fontSize: 11, fill: '#A87048' } }

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-4">{t('reports.title')}</h1>

      {/* Week navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-soft px-4 py-3 mb-4">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-brown-600 text-xl font-bold active:scale-95 transition-transform"
        >
          ‹
        </button>
        <p className="font-rubik font-semibold text-brown-800 text-sm text-center">{weekLabel}</p>
        <button
          onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
          disabled={weekOffset === 0}
          className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-brown-600 text-xl font-bold active:scale-95 transition-transform disabled:opacity-25"
        >
          ›
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : !hasAnyData ? (
        <p className="text-center text-brown-400 font-rubik py-12">{t('reports.noDataForWeek')}</p>
      ) : (
        <>
          {/* Stats row */}
          {(feedingTracker || diaperTracker) && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {feedingTracker && (
                <>
                  <Card>
                    <p className="text-xs text-brown-400 font-rubik">{t('reports.dailyAverage')}</p>
                    <p className="font-rubik font-bold text-2xl text-brown-800">{avgFeedingMl}</p>
                    <p className="text-xs text-brown-400 font-rubik">מ"ל</p>
                  </Card>
                  <Card>
                    <p className="text-xs text-brown-400 font-rubik">{t('reports.weekFeedings')}</p>
                    <p className="font-rubik font-bold text-2xl text-brown-800">{totalFeedingCount}</p>
                    <p className="text-xs text-brown-400 font-rubik">{t('reports.times')}</p>
                  </Card>
                </>
              )}
              {diaperTracker && (
                <Card>
                  <p className="text-xs text-brown-400 font-rubik">{t('reports.weekDiapers')}</p>
                  <p className="font-rubik font-bold text-2xl text-brown-800">{totalDiapers}</p>
                  <p className="text-xs text-brown-400 font-rubik">{t('reports.changes')}</p>
                </Card>
              )}
            </div>
          )}

          {/* Feeding chart */}
          {feedingTracker && feedingData.some(d => d.ml > 0) && (
            <Card className="mb-4">
              <p className="font-rubik font-semibold text-brown-800 mb-3">🍼 {t('reports.mlPerDay')}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={feedingData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                  <XAxis dataKey="day" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip {...chartTooltipStyle} formatter={v => [`${v} מ"ל`, 'כמות']} />
                  <Bar dataKey="ml" fill="#6B9E8C" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Vitamin D weekly compliance grid */}
          {vitaminDData && (
            <Card className="mb-4">
              <p className="font-rubik font-semibold text-brown-800 mb-3">☀️ {t('reports.vitaminDWeek')}</p>
              <div className="space-y-2">
                {/* Day labels header */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-rubik text-brown-300 w-10 text-right" />
                  {vitaminDData.days.map((d, i) => (
                    <div key={i} className="flex-1 text-center text-xs font-rubik text-brown-400">{d.label}</div>
                  ))}
                </div>
                {/* Dose rows */}
                {Array.from({ length: vitaminDData.doseCount }, (_, di) => (
                  <div key={di} className="flex items-center gap-1">
                    <span className="text-xs font-rubik text-brown-500 w-10 text-right truncate">{vitaminDData.doseLabels[di]}</span>
                    {vitaminDData.days.map((d, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${d.doses[di] ? 'bg-amber-400 text-white' : 'bg-cream-200 text-brown-300'}`}
                      >
                        {d.doses[di] ? '✓' : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Diaper chart */}
          {diaperTracker && diaperData.some(d => d.count > 0) && (
            <Card className="mb-4">
              <p className="font-rubik font-semibold text-brown-800 mb-3">👶 {t('reports.diapersPerDay')}</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={diaperData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                  <XAxis dataKey="day" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} formatter={v => [v, 'החלפות']} />
                  <Bar dataKey="count" fill="#9B8EC4" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Sleep chart */}
          {sleepTracker && sleepData.some(d => d.hours > 0) && (
            <Card className="mb-4">
              <p className="font-rubik font-semibold text-brown-800 mb-3">🌙 {t('reports.sleepPerDay')}</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={sleepData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                  <XAxis dataKey="day" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} formatter={v => [`${v} שע'`, 'שינה']} />
                  <Bar dataKey="hours" fill="#7BA7E8" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Dose tracker charts */}
          {doseTrackers.map(tracker => {
            const doseData = weekDays.map(day => ({
              day: dayLabel(day),
              count: events.filter(e => e.tracker_id === tracker.id && isSameDay(new Date(e.occurred_at), day)).length,
            }))
            if (doseData.every(d => d.count === 0)) return null
            return (
              <Card key={tracker.id} className="mb-4">
                <p className="font-rubik font-semibold text-brown-800 mb-3">{tracker.icon} {tracker.name}</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={doseData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
                    <XAxis dataKey="day" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip {...chartTooltipStyle} formatter={v => [v, 'מינונים']} />
                    <Bar dataKey="count" fill={tracker.color} radius={[8, 8, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
