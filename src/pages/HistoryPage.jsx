import { useState, useMemo, useRef, useEffect } from 'react'
import { format, subDays, startOfDay, endOfDay, isSameDay, differenceInCalendarDays } from 'date-fns'
import { he } from 'date-fns/locale'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useEvents } from '../hooks/useEvents'
import { formatTime, formatDateLabel } from '../lib/utils'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { AddFeedingForm } from '../components/forms/AddFeedingForm'
import { AddDiaperForm } from '../components/forms/AddDiaperForm'
import { AddCustomEventForm } from '../components/forms/AddCustomEventForm'
import { TRACKER_TYPES } from '../lib/constants'

const DAYS_PER_PAGE = 14
const MAX_DAYS = 90

export function HistoryPage() {
  const { identity } = useApp()
  const { trackers } = useTrackers(identity.familyId)
  const [filterTrackerId, setFilterTrackerId] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [jumpDate, setJumpDate] = useState('')
  const [daysBack, setDaysBack] = useState(DAYS_PER_PAGE)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasReachedStart, setHasReachedStart] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  const now = useRef(new Date()).current
  const prevEventsLengthRef = useRef(null)
  const todayStr = format(now, 'yyyy-MM-dd')

  const startDate = useMemo(
    () => startOfDay(subDays(now, daysBack - 1)),
    [daysBack]
  )
  const endDate = useMemo(() => endOfDay(now), [])

  const { events, loading, deleteEvent, updateEvent, refetch } = useEvents(
    identity.familyId,
    { startDate, endDate, childId: identity.activeChildId }
  )

  // Clear loadingMore; detect when load-more produced no new events
  useEffect(() => {
    if (prevEventsLengthRef.current !== null) {
      if (events.length === prevEventsLengthRef.current) setHasReachedStart(true)
      prevEventsLengthRef.current = null
    }
    setLoadingMore(false)
  }, [events])

  // Filter by tracker type client-side; always exclude events from hidden trackers
  const filtered = useMemo(() => {
    const visible = events.filter(e => e.tracker?.is_active !== false)
    return filterTrackerId ? visible.filter(e => e.tracker_id === filterTrackerId) : visible
  }, [events, filterTrackerId])

  // Group by local date key (yyyy-MM-dd), sorted newest first
  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach(event => {
      const key = format(new Date(event.occurred_at), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    })
    // Sort each day's events newest first
    map.forEach((dayEvents, key) => {
      map.set(key, [...dayEvents].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)))
    })
    // Sort days newest first
    return new Map([...map.entries()].sort((a, b) => b[0].localeCompare(a[0])))
  }, [filtered])

  // When jumpDate is set, show only that day (if loaded)
  const displayedGroups = useMemo(() => {
    if (!jumpDate) return grouped
    const single = new Map()
    if (grouped.has(jumpDate)) single.set(jumpDate, grouped.get(jumpDate))
    return single
  }, [grouped, jumpDate])

  const canLoadMore = daysBack < MAX_DAYS

  function loadMore() {
    prevEventsLengthRef.current = events.length
    setLoadingMore(true)
    setDaysBack(d => Math.min(d + DAYS_PER_PAGE, MAX_DAYS))
  }

  function handleJumpDate(dateStr) {
    setJumpDate(dateStr)
    setFilterOpen(false)
    if (!dateStr) return

    // If the target date is beyond the loaded range, extend it
    const target = new Date(dateStr + 'T12:00:00')
    const daysDiff = differenceInCalendarDays(now, target)
    if (daysDiff >= daysBack) {
      setLoadingMore(true)
      setDaysBack(Math.min(daysDiff + 1, MAX_DAYS))
    }

    // Scroll to the day header after render
    setTimeout(() => {
      const el = document.getElementById(`day-${dateStr}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 400)
  }

  function clearFilters() {
    setFilterTrackerId(null)
    setJumpDate('')
  }

  const hasActiveFilter = filterTrackerId || jumpDate

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteEvent(deleteTarget)
    setDeleteTarget(null)
    refetch()
  }

  async function handleEditSave(data, occurredAt) {
    setEditSaving(true)
    try {
      const original = new Date(editTarget.occurred_at)
      original.setHours(occurredAt.getHours(), occurredAt.getMinutes(), 0, 0)
      await updateEvent(editTarget.id, { data, occurred_at: original.toISOString() })
      setEditTarget(null)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleTimeOnlySave(timeStr) {
    setEditSaving(true)
    try {
      const [h, m] = timeStr.split(':').map(Number)
      const original = new Date(editTarget.occurred_at)
      original.setHours(h, m, 0, 0)
      await updateEvent(editTarget.id, { occurred_at: original.toISOString() })
      setEditTarget(null)
    } finally {
      setEditSaving(false)
    }
  }

  function renderEditForm() {
    if (!editTarget) return null
    const type = editTarget.tracker?.tracker_type
    const initialTime = format(new Date(editTarget.occurred_at), 'HH:mm')

    if (type === TRACKER_TYPES.FEEDING)
      return <AddFeedingForm initialData={editTarget.data} initialTime={initialTime} onSave={handleEditSave} onCancel={() => setEditTarget(null)} loading={editSaving} />
    if (type === TRACKER_TYPES.DIAPER)
      return <AddDiaperForm initialData={editTarget.data} initialTime={initialTime} onSave={handleEditSave} onCancel={() => setEditTarget(null)} loading={editSaving} />
    if (type === TRACKER_TYPES.VITAMIN_D || type === TRACKER_TYPES.DOSE)
      return <TimeOnlyForm initialTime={initialTime} onSave={handleTimeOnlySave} onCancel={() => setEditTarget(null)} loading={editSaving} />
    return <AddCustomEventForm tracker={editTarget.tracker} initialData={editTarget.data} initialTime={initialTime} onSave={handleEditSave} onCancel={() => setEditTarget(null)} loading={editSaving} />
  }

  function formatEventSummary(event) {
    const type = event.tracker?.tracker_type
    const data = event.data ?? {}
    if (type === 'feeding') return `${data.amount_ml} מ"ל`
    if (type === 'vitamin_d' || type === 'dose') return data.dose_label ?? data.dose ?? ''
    if (type === 'diaper') {
      const map = { wet: t('diaper.wet'), dirty: t('diaper.dirty'), both: t('diaper.both') }
      return map[data.type] ?? ''
    }
    if (type === 'sleep') return data.type === 'start' ? '💤 הלך לישון' : '☀️ התעורר'
    const schema = event.tracker?.field_schema ?? []
    if (schema.length === 0) return Object.values(data).filter(v => v !== null && v !== undefined && v !== '').join(', ')
    return schema
      .map(f => {
        const v = data[f.key]
        if (v === null || v === undefined || v === '') return null
        if (f.type === 'boolean') return v ? 'כן' : 'לא'
        return String(v)
      })
      .filter(Boolean)
      .join(', ')
  }

  // Active filter label for the filter row
  const activeFilterLabel = useMemo(() => {
    if (filterTrackerId) {
      const tr = trackers.find(t => t.id === filterTrackerId)
      return tr ? `${tr.icon} ${tr.name}` : 'מסנן פעיל'
    }
    if (jumpDate) {
      const d = new Date(jumpDate + 'T12:00:00')
      return format(d, 'EEEE, d בMMMM', { locale: he })
    }
    return 'כל האירועים'
  }, [filterTrackerId, jumpDate, trackers])

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-4">{t('history.title')}</h1>

      {/* Filter toggle row */}
      <button
        onClick={() => setFilterOpen(prev => !prev)}
        className="w-full flex items-center justify-between bg-white rounded-2xl shadow-soft px-4 py-3 mb-2 transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">🔍</span>
          <span className="font-rubik font-medium text-brown-700 text-sm truncate">{activeFilterLabel}</span>
          {hasActiveFilter && (
            <button
              onClick={e => { e.stopPropagation(); clearFilters() }}
              className="flex-shrink-0 text-xs bg-cream-200 text-brown-500 rounded-full px-2 py-0.5 font-rubik hover:bg-red-50 hover:text-red-400 transition-colors"
            >
              ✕ נקה
            </button>
          )}
        </div>
        <span className="text-brown-400 text-sm flex-shrink-0 mr-2">{filterOpen ? '▲' : '▼'}</span>
      </button>

      {/* Collapsible filter panel */}
      {filterOpen && (
        <div className="bg-white rounded-2xl shadow-soft px-4 py-4 mb-3 space-y-4">
          {/* Date picker */}
          <div>
            <p className="text-xs font-rubik font-semibold text-brown-500 mb-2">קפוץ לתאריך</p>
            <input
              type="date"
              value={jumpDate}
              max={todayStr}
              onChange={e => handleJumpDate(e.target.value)}
              className="w-full bg-cream-200 rounded-2xl px-4 py-2.5 text-brown-800 font-rubik outline-none text-sm"
            />
          </div>

          {/* Tracker chips */}
          <div>
            <p className="text-xs font-rubik font-semibold text-brown-500 mb-2">סנן לפי מעקב</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <FilterChip
                label={t('history.filterAll')}
                active={!filterTrackerId}
                onClick={() => { setFilterTrackerId(null); setFilterOpen(false) }}
              />
              {trackers.filter(tr => tr.is_active !== false).map(tr => (
                <FilterChip
                  key={tr.id}
                  label={`${tr.icon} ${tr.name}`}
                  active={filterTrackerId === tr.id}
                  color={tr.color}
                  onClick={() => {
                    setFilterTrackerId(filterTrackerId === tr.id ? null : tr.id)
                    setFilterOpen(false)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading && displayedGroups.size === 0 ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : displayedGroups.size === 0 ? (
        <div className="text-center py-16 text-brown-400 font-rubik">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">{jumpDate ? 'אין אירועים בתאריך זה' : t('history.noEvents')}</p>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-brown-600 underline font-rubik"
            >
              הצג הכל
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1 pb-2">
          {[...displayedGroups.entries()].map(([dateKey, dayEvents]) => {
            const dateObj = new Date(dateKey + 'T12:00:00')
            const isToday = dateKey === todayStr
            const isYesterday = isSameDay(dateObj, subDays(now, 1))
            const dayLabel = formatDateLabel(dateObj)

            return (
              <div key={dateKey} id={`day-${dateKey}`}>
                {/* Day header */}
                <div className="flex items-center gap-3 pt-4 pb-2">
                  <span
                    className="font-rubik font-bold text-xs px-3 py-1 rounded-full flex-shrink-0"
                    style={
                      isToday
                        ? { backgroundColor: '#5C3D2E', color: 'white' }
                        : isYesterday
                          ? { backgroundColor: '#D6C4B0', color: '#5C3D2E' }
                          : { backgroundColor: '#F0E6D9', color: '#8B7355' }
                    }
                  >
                    {dayLabel}
                  </span>
                  <div className="flex-1 h-px bg-cream-300" />
                  <span className="text-xs text-brown-400 font-rubik flex-shrink-0">
                    {dayEvents.length} אירועים
                  </span>
                </div>

                {/* Events for this day */}
                <div className="grid grid-cols-2 gap-2">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => setEditTarget(event)}
                      className="bg-white rounded-xl shadow-soft px-3 py-2.5 flex flex-col cursor-pointer active:scale-[0.97] transition-transform select-none"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(event.id) }}
                          className="rounded-md px-2 py-0.5 text-red-400 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-colors flex-shrink-0 text-xs font-rubik leading-none"
                          aria-label="מחק"
                        >מחק</button>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                          style={{ backgroundColor: `${event.tracker?.color ?? '#D6C4B0'}22` }}
                        >
                          {event.tracker?.icon}
                        </div>
                      </div>
                      <p className="font-rubik font-bold text-brown-800 text-sm leading-tight text-right">{event.tracker?.name}</p>
                      <p className="font-rubik text-brown-500 text-xs mt-0.5 leading-tight text-right">
                        {formatTime(event.occurred_at)}
                        {formatEventSummary(event) ? ` · ${formatEventSummary(event)}` : ''}
                      </p>
                      {event.member && (
                        <p className="font-rubik text-brown-300 text-xs mt-0.5 text-right truncate">{event.member.display_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Load more / end indicator */}
          {!jumpDate && (
            <div className="pt-5 pb-2 text-center">
              {loadingMore ? (
                <Spinner size="md" />
              ) : canLoadMore && !hasReachedStart ? (
                <button
                  onClick={loadMore}
                  className="w-full py-3 rounded-2xl bg-white shadow-soft text-brown-600 font-rubik font-medium text-sm active:scale-[0.99] transition-all"
                >
                  טען עוד ימים
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2">
                  <span className="text-2xl">🎉</span>
                  <p className="text-brown-400 font-rubik text-xs">הגעת להתחלה</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        message={t('history.deleteConfirm')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <BottomSheet
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`${t('common.edit')} ${editTarget?.tracker?.name ?? ''}`}
      >
        {renderEditForm()}
      </BottomSheet>
    </div>
  )
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-rubik font-medium transition-all active:scale-95"
      style={
        active && color
          ? { backgroundColor: color, color: 'white' }
          : active
            ? { backgroundColor: '#8B5E3C', color: 'white' }
            : { backgroundColor: '#F5EDE0', color: '#7A5035' }
      }
    >
      {label}
    </button>
  )
}

function TimeOnlyForm({ initialTime, onSave, onCancel, loading }) {
  const [time, setTime] = useState(initialTime)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-brown-600 mb-2">{t('feeding.time')}</p>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full bg-cream-200 rounded-2xl px-4 py-3 text-brown-800 font-rubik outline-none"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button className="flex-1" onClick={() => onSave(time)} disabled={loading}>{t('common.save')}</Button>
      </div>
    </div>
  )
}
