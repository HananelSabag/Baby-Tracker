import { useState, useEffect, useMemo } from 'react'
import { isSameDay } from 'date-fns'
import { useEvents } from '../../hooks/useEvents'
import { Card } from '../ui/Card'
import { formatTime } from '../../lib/utils'
import { sleepStats } from '../../lib/sleepSessions'

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
  if (h > 0 && m > 0) return `${h}:${String(m).padStart(2, '0')} ${"שע'"}`
  if (h > 0) return `${h} ${"שע'"}`
  return `${m} ${"דק'"}`
}

export function SleepCard({ tracker, familyId, memberId, childId, viewDate, compact = false }) {
  const { events, addEvent } = useEvents(familyId, { trackerId: tracker.id, date: viewDate, childId })
  const [now, setNow] = useState(Date.now())
  const [saving, setSaving] = useState(false)

  // start/end are stamped with the current clock time — only meaningful today.
  const isViewingToday = !viewDate || isSameDay(viewDate, new Date())

  // Pairing lives in lib/sleepSessions so this card, the hero chip and the
  // reports page cannot drift apart. `live` is what stops a nap left open on a
  // past day from running until now and reporting an absurd total.
  const stats = useMemo(
    () => sleepStats(events, { now, live: isViewingToday }),
    [events, now, isViewingToday]
  )

  const { isSleeping, currentMs, totalMs, sessions } = stats
  const completedSessions = sessions
  const isLive = isSleeping && isViewingToday

  // Live timer tick while sleeping
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isLive])

  async function handleToggle() {
    if (saving || !isViewingToday) return
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
              <p className="font-rubik text-xs text-brown-400">{formatDurationShort(totalMs)} {"סה\"כ היום"}</p>
            )}
          </div>
          <button
            onClick={handleToggle}
            disabled={saving || !isViewingToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-rubik font-semibold text-sm transition-all active:scale-95 flex-shrink-0 disabled:opacity-40"
            style={{ backgroundColor: isSleeping ? tracker.color : `${tracker.color}22` }}
          >
            <span>{isSleeping ? '☀️' : '🌙'}</span>
            <span style={{ color: isSleeping ? 'white' : tracker.color }}>
              {saving ? '...' : isSleeping ? formatDuration(currentMs) : "הלך לישון"}
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
            {formatDurationShort(totalMs)} {"סה\"כ היום"}
          </span>
        )}
      </div>

      {/* Main toggle button — compact row when idle, expanded when sleeping.
          On a past day there is nothing to start/stop, so show a summary. */}
      {isViewingToday ? (
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
              <span className="font-rubik font-bold text-white text-lg">{"התעורר"}</span>
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
                {saving ? '...' : "הלך לישון"}
              </span>
            </>
          )}
        </button>
      ) : (
        <div
          className="w-full rounded-2xl py-3 flex items-center justify-center gap-2"
          style={{ backgroundColor: `${tracker.color}14` }}
        >
          <span className="font-rubik text-sm text-brown-400">
            {completedSessions.length > 0
              ? `${completedSessions.length} תנומות ביום זה`
              : 'אין תנומות רשומות ביום זה'}
          </span>
        </div>
      )}

      {/* Completed sessions list */}
      {completedSessions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {/* sleepStats returns { start: Date, end: Date, ms } — not the raw
              event rows this block used to receive. */}
          {completedSessions.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 bg-cream-100">
              <span className="font-rubik text-xs text-brown-400">
                {formatTime(s.start)} – {formatTime(s.end)}
              </span>
              <span className="font-rubik text-sm font-semibold text-brown-700">
                {formatDurationShort(s.ms)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
