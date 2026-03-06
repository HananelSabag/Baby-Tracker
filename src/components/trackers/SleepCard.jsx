import { useState, useEffect, useMemo } from 'react'
import { t } from '../../lib/strings'
import { useEvents } from '../../hooks/useEvents'
import { Card } from '../ui/Card'
import { formatTime } from '../../lib/utils'

function formatDuration(ms) {
  if (ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDurationShort(ms) {
  if (ms < 0) ms = 0
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}:${String(m).padStart(2, '0')} ${t('sleep.hoursAbbr')}`
  if (h > 0) return `${h} ${t('sleep.hoursAbbr')}`
  return `${m} ${t('sleep.minAbbr')}`
}

export function SleepCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
  const { events, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [now, setNow] = useState(Date.now())
  const [saving, setSaving] = useState(false)

  // Sort chronologically to build sessions
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)),
    [events]
  )

  // Pair start/end events into sessions
  const sessions = useMemo(() => {
    const result = []
    for (let i = 0; i < sortedEvents.length; i++) {
      if (sortedEvents[i].data?.type === 'start') {
        const next = sortedEvents[i + 1]
        const end = next?.data?.type === 'end' ? next : null
        result.push({ start: sortedEvents[i], end })
        if (end) i++
      }
    }
    return result
  }, [sortedEvents])

  const isSleeping = sessions.length > 0 && sessions[sessions.length - 1].end === null

  // Live timer tick while sleeping
  useEffect(() => {
    if (!isSleeping) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isSleeping])

  const currentMs = isSleeping
    ? now - new Date(sessions[sessions.length - 1].start.occurred_at).getTime()
    : 0

  const totalMs = sessions.reduce((sum, s) => {
    if (s.end) return sum + (new Date(s.end.occurred_at) - new Date(s.start.occurred_at))
    return sum + currentMs
  }, 0)

  const completedSessions = sessions.filter(s => s.end)

  async function handleToggle() {
    if (saving) return
    setSaving(true)
    try {
      await addEvent({
        trackerId: tracker.id,
        memberId,
        childId,
        data: { type: isSleeping ? 'end' : 'start' },
        occurredAt: new Date().toISOString(),
      })
    } finally {
      setSaving(false)
    }
  }

  if (compact) {
    return (
      <Card compact>
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">{tracker.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-rubik font-semibold text-brown-800 text-sm">{tracker.name}</p>
            {totalMs > 0 && !isSleeping && (
              <p className="font-rubik text-xs text-brown-400">{formatDurationShort(totalMs)} {t('sleep.totalToday')}</p>
            )}
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-rubik font-semibold text-sm transition-all active:scale-95 flex-shrink-0"
            style={{ backgroundColor: isSleeping ? tracker.color : `${tracker.color}22` }}
          >
            <span>{isSleeping ? '☀️' : '🌙'}</span>
            <span style={{ color: isSleeping ? 'white' : tracker.color }}>
              {saving ? '...' : isSleeping ? formatDuration(currentMs) : t('sleep.asleep')}
            </span>
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tracker.icon}</span>
          <span className="font-rubik font-semibold text-brown-800">{tracker.name}</span>
        </div>
        {totalMs > 0 && (
          <span
            className="text-xs font-rubik font-medium px-3 py-1 rounded-full"
            style={{ backgroundColor: `${tracker.color}20`, color: tracker.color }}
          >
            {formatDurationShort(totalMs)} {t('sleep.totalToday')}
          </span>
        )}
      </div>

      {/* Main toggle button — compact row when idle, expanded when sleeping */}
      <button
        onClick={handleToggle}
        disabled={saving}
        className={isSleeping
          ? 'w-full rounded-2xl py-4 flex flex-col items-center gap-1 transition-all active:scale-[0.98]'
          : 'w-full rounded-2xl py-3 flex items-center justify-center gap-3 transition-all active:scale-[0.98]'
        }
        style={{ backgroundColor: isSleeping ? tracker.color : `${tracker.color}22` }}
      >
        {isSleeping ? (
          <>
            <span className="text-3xl">☀️</span>
            <span className="font-rubik font-bold text-white text-lg">{t('sleep.wakeUp')}</span>
            <span className="font-rubik text-white/80 text-2xl font-mono tracking-wider">
              {saving ? '...' : formatDuration(currentMs)}
            </span>
          </>
        ) : (
          <>
            <span className="text-xl">🌙</span>
            <span
              className="font-rubik font-bold text-base"
              style={{ color: tracker.color }}
            >
              {saving ? '...' : t('sleep.asleep')}
            </span>
          </>
        )}
      </button>

      {/* Completed sessions list */}
      {completedSessions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {completedSessions.map((s, i) => {
            const dur = new Date(s.end.occurred_at) - new Date(s.start.occurred_at)
            return (
              <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 bg-cream-100">
                <span className="font-rubik text-xs text-brown-400">
                  {formatTime(s.start.occurred_at)} – {formatTime(s.end.occurred_at)}
                </span>
                <span className="font-rubik text-sm font-semibold text-brown-700">
                  {formatDurationShort(dur)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
