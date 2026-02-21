import { useMemo } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useEvents } from '../hooks/useEvents'
import { TRACKER_TYPES } from '../lib/constants'
import { format, subDays, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'

export function ReportsPage() {
  const { identity } = useApp()
  const { trackers } = useTrackers(identity.familyId)
  const { events, loading } = useEvents(identity.familyId, { days: 14 })

  const feedingTracker = trackers.find(t => t.tracker_type === TRACKER_TYPES.FEEDING)

  const chartData = useMemo(() => {
    if (!feedingTracker) return []
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i)
      const dayStart = startOfDay(day)
      const dayEvents = events.filter(e => {
        if (e.tracker_id !== feedingTracker.id) return false
        const d = startOfDay(new Date(e.occurred_at))
        return d.getTime() === dayStart.getTime()
      })
      const totalMl = dayEvents.reduce((sum, e) => sum + (e.data?.amount_ml ?? 0), 0)
      return {
        day: format(day, 'EEE', { locale: he }),
        ml: totalMl,
        count: dayEvents.length,
      }
    })
  }, [events, feedingTracker])

  const avgMl = useMemo(() => {
    const days = chartData.filter(d => d.ml > 0)
    return days.length ? Math.round(days.reduce((s, d) => s + d.ml, 0) / days.length) : 0
  }, [chartData])

  const totalWeek = useMemo(() => chartData.reduce((s, d) => s + d.ml, 0), [chartData])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-4">{t('reports.title')}</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <p className="text-xs text-brown-400 font-rubik mb-1">{t('reports.dailyAverage')}</p>
          <p className="font-rubik font-bold text-2xl text-brown-800">{avgMl}</p>
          <p className="text-xs text-brown-400 font-rubik">מ"ל</p>
        </Card>
        <Card>
          <p className="text-xs text-brown-400 font-rubik mb-1">{t('reports.totalThisWeek')}</p>
          <p className="font-rubik font-bold text-2xl text-brown-800">{(totalWeek / 1000).toFixed(1)}</p>
          <p className="text-xs text-brown-400 font-rubik">ליטר</p>
        </Card>
      </div>

      {/* Feeding chart */}
      <Card>
        <p className="font-rubik font-semibold text-brown-800 mb-4">{t('reports.feedingTrend')}</p>
        {chartData.every(d => d.ml === 0) ? (
          <p className="text-center text-brown-400 font-rubik py-8">{t('reports.noData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E6D3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontFamily: 'Rubik', fontSize: 12, fill: '#A87048' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'Rubik', fontSize: 11, fill: '#A87048' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontFamily: 'Rubik', borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                formatter={(v) => [`${v} מ"ל`, 'כמות']}
              />
              <Bar dataKey="ml" fill="#6B9E8C" radius={[8, 8, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
