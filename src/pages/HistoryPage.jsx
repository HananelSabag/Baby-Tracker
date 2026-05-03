import { useState, useMemo, useRef, useEffect } from 'react'
import { format, subDays, startOfDay, endOfDay, isSameDay, differenceInCalendarDays } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  Search, ChevronDown, ChevronUp, X,
  CalendarDays, SlidersHorizontal, Trash2, Filter,
} from 'lucide-react'
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
import { GrowthEditForm } from '../components/forms/GrowthEditForm'
import { TRACKER_TYPES, ROLES } from '../lib/constants'

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

  async function handleGrowthEditSave(data, fullDate) {
    setEditSaving(true)
    try {
      await updateEvent(editTarget.id, { data, occurred_at: fullDate.toISOString() })
      setEditTarget(null)
    } finally {
      setEditSaving(false)
    }
  }

  function renderEditForm() {
    if (!editTarget) return null
    const type = editTarget.tracker?.tracker_type
    const initialTime = format(new Date(editTarget.occurred_at), 'HH:mm')

    if (type === TRACKER_TYPES.GROWTH) {
      const initialDate = format(new Date(editTarget.occurred_at), 'yyyy-MM-dd')
      return <GrowthEditForm initialData={editTarget.data} initialDate={initialDate} onSave={handleGrowthEditSave} onCancel={() => setEditTarget(null)} loading={editSaving} />
    }
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
    <div className="px-4 pt-8 pb-8">

      {/* ── Page header ── */}
      <div className="mb-5">
        <h1 className="font-rubik font-black text-3xl text-brown-800 leading-tight">{t('history.title')}</h1>
        {filtered.length > 0 && (
          <p className="font-rubik text-brown-400 text-sm mt-0.5">
            {filtered.length} אירועים{daysBack > 1 ? ` · ${daysBack} ימים אחרונים` : ''}
          </p>
        )}
      </div>

      {/* ── Filter toggle bar ── */}
      <button
        onClick={() => setFilterOpen(prev => !prev)}
        className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 mb-2 cursor-pointer active:scale-[0.99] transition-all duration-150 border border-cream-200"
        style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        <Search size={16} className="text-brown-400 flex-shrink-0" />
        <span className="font-rubik font-semibold text-brown-700 text-sm flex-1 text-right truncate">
          {activeFilterLabel}
        </span>
        {hasActiveFilter && (
          <button
            onClick={e => { e.stopPropagation(); clearFilters() }}
            className="flex items-center gap-1 text-xs bg-cream-200 text-brown-500 rounded-lg px-2 py-1 font-rubik font-bold flex-shrink-0 cursor-pointer hover:bg-red-50 hover:text-red-400 transition-colors duration-150"
          >
            <X size={10} />
            נקה
          </button>
        )}
        {filterOpen
          ? <ChevronUp size={16} className="text-brown-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-brown-400 flex-shrink-0" />
        }
      </button>

      {/* ── Collapsible filter panel ── */}
      {filterOpen && (
        <div
          className="bg-white rounded-2xl px-4 py-4 mb-4 space-y-4 border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          {/* Date picker */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <CalendarDays size={12} className="text-brown-400" />
              <p className="text-xs font-rubik font-bold text-brown-400 uppercase tracking-widest">קפוץ לתאריך</p>
            </div>
            <input
              type="date"
              value={jumpDate}
              max={todayStr}
              onChange={e => handleJumpDate(e.target.value)}
              className="w-full bg-cream-50 rounded-2xl px-4 py-3 text-brown-800 font-rubik outline-none text-sm border border-cream-200 focus:border-amber-300 transition-colors duration-150"
            />
          </div>

          {/* Tracker chips */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Filter size={12} className="text-brown-400" />
              <p className="text-xs font-rubik font-bold text-brown-400 uppercase tracking-widest">סנן לפי מעקב</p>
            </div>
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

      {/* ── Content ── */}
      {loading && displayedGroups.size === 0 ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : displayedGroups.size === 0 ? (
        <EmptyState
          jumpDate={jumpDate}
          hasActiveFilter={hasActiveFilter}
          onClear={clearFilters}
        />
      ) : (
        <div className="space-y-2 pb-4">
          {[...displayedGroups.entries()].map(([dateKey, dayEvents]) => {
            const dateObj = new Date(dateKey + 'T12:00:00')
            const isToday = dateKey === todayStr
            const isYesterday = isSameDay(dateObj, subDays(now, 1))
            const dayLabel = formatDateLabel(dateObj)
            const dayName = format(dateObj, 'EEEE', { locale: he })
            const dayNum = format(dateObj, 'd')
            const monthName = format(dateObj, 'MMMM', { locale: he })

            return (
              <div key={dateKey} id={`day-${dateKey}`} className="pt-4 first:pt-0">

                {/* ── Day header — dramatic gradient ── */}
                <div
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl mb-3"
                  style={
                    isToday
                      ? {
                          background: 'linear-gradient(135deg, #3D2B1F 0%, #8B5E3C 100%)',
                          boxShadow: '0 6px 20px rgba(61,43,31,0.22), inset 0 1px 0 rgba(255,255,255,0.10)',
                        }
                      : isYesterday
                        ? {
                            background: 'linear-gradient(135deg, #F5E6D3 0%, #E8C9A8 100%)',
                            border: '1px solid #D6C4B0',
                            boxShadow: '0 2px 8px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.6)',
                          }
                        : {
                            background: '#FFFAF5',
                            border: '1px solid #EDD9C0',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                          }
                  }
                >
                  <div className="flex items-center gap-3">
                    {/* Big date number */}
                    <div className={isToday ? 'text-white' : 'text-brown-700'}>
                      <span className="font-rubik font-black text-3xl leading-none block">{dayNum}</span>
                      <span className="font-rubik font-semibold text-[10px] uppercase tracking-wider block opacity-70 -mt-0.5">{monthName}</span>
                    </div>
                    {/* Label + day name */}
                    <div>
                      <span className={`font-rubik font-bold text-sm leading-tight block ${isToday ? 'text-white' : 'text-brown-800'}`}>
                        {dayLabel}
                      </span>
                      <span className={`font-rubik text-xs leading-tight block mt-0.5 ${isToday ? 'text-white/65' : 'text-brown-400'}`}>
                        {dayName}
                      </span>
                    </div>
                  </div>
                  {/* Event count badge */}
                  <div
                    className={`font-rubik font-black text-sm px-3 py-1.5 rounded-xl min-w-[32px] text-center ${
                      isToday ? 'bg-white/20 text-white' : 'bg-white/70 text-brown-700'
                    }`}
                  >
                    {dayEvents.length}
                  </div>
                </div>

                {/* ── Event cards — bento 2-col grid ── */}
                <div className="grid grid-cols-2 gap-2.5">
                  {dayEvents.map(event => {
                    const summary = formatEventSummary(event)
                    const color = event.tracker?.color ?? '#D6C4B0'
                    return (
                      <div
                        key={event.id}
                        onClick={() => setEditTarget(event)}
                        className="bg-white rounded-2xl flex flex-col cursor-pointer active:scale-[0.97] transition-all duration-150 select-none overflow-hidden"
                        style={{
                          border: '1px solid #EDD9C0',
                          borderLeft: `3.5px solid ${color}`,
                          boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
                        }}
                      >
                        {/* Tracker header row */}
                        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                            style={{ backgroundColor: `${color}22` }}
                          >
                            {event.tracker?.icon}
                          </div>
                          <span className="font-rubik text-brown-500 text-xs font-semibold truncate leading-none">
                            {event.tracker?.name}
                          </span>
                        </div>

                        {/* Time — hero */}
                        <p className="font-rubik font-black text-2xl text-brown-800 leading-none px-3 pb-1">
                          {formatTime(event.occurred_at)}
                        </p>

                        {/* Summary — in tracker color */}
                        {summary ? (
                          <p
                            className="font-rubik text-sm font-bold px-3 pb-2 leading-snug"
                            style={{ color }}
                          >
                            {summary}
                          </p>
                        ) : <div className="pb-1" />}

                        {/* Member badge — pinned bottom */}
                        {event.member && (
                          <div className="flex items-center justify-end gap-1.5 px-3 pb-2.5 mt-auto pt-1">
                            <span className="font-rubik text-brown-400 text-[10px] leading-none truncate max-w-[60px]">
                              {event.member.display_name}
                            </span>
                            <div
                              className="w-5 h-5 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0"
                              style={{ boxShadow: '0 0 0 1.5px #E8C9A8' }}
                            >
                              {event.member.avatar_url
                                ? <img src={event.member.avatar_url} alt={event.member.display_name} className="w-full h-full object-cover" />
                                : <span className="text-[9px] leading-none">
                                    {ROLES.find(r => r.value === event.member.role)?.emoji ?? '👤'}
                                  </span>
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* ── Load more / end indicator ── */}
          {!jumpDate && (
            <div className="pt-4 pb-2">
              {loadingMore ? (
                <div className="flex justify-center py-4"><Spinner size="md" /></div>
              ) : canLoadMore && !hasReachedStart ? (
                <button
                  onClick={loadMore}
                  className="w-full py-3.5 rounded-2xl font-rubik font-bold text-brown-700 text-sm cursor-pointer active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 border border-cream-200 bg-white min-h-[48px]"
                  style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
                >
                  <ChevronDown size={16} className="text-brown-500" />
                  טען עוד ימים
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2 py-5">
                  <div
                    className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl border border-cream-200"
                    style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.07)' }}
                  >
                    🎉
                  </div>
                  <p className="text-brown-600 font-rubik font-bold text-sm">הגעת להתחלה</p>
                  <p className="text-brown-400 font-rubik text-xs">כל הנתונים נטענו</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}
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
        {editTarget && (
          <button
            onClick={() => { const id = editTarget.id; setEditTarget(null); setDeleteTarget(id) }}
            className="w-full mt-4 py-3 rounded-2xl text-red-500 font-rubik font-bold text-sm cursor-pointer active:bg-red-50 transition-colors duration-150 flex items-center justify-center gap-2 border border-red-100 bg-white"
            style={{ boxShadow: '0 2px 8px rgba(239,68,68,0.08)' }}
          >
            <Trash2 size={15} />
            מחק אירוע
          </button>
        )}
      </BottomSheet>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ jumpDate, hasActiveFilter, onClear }) {
  return (
    <div className="flex flex-col items-center py-16 px-4">
      <div
        className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center mb-5 text-4xl border border-cream-200"
        style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        📭
      </div>
      <p className="font-rubik font-bold text-brown-700 text-base mb-1">
        {jumpDate ? 'אין אירועים בתאריך זה' : t('history.noEvents')}
      </p>
      <p className="font-rubik text-brown-400 text-sm text-center leading-relaxed">
        {jumpDate ? 'בחר תאריך אחר' : 'הוסף דיווח ראשון ממסך הבית'}
      </p>
      {hasActiveFilter && (
        <button
          onClick={onClear}
          className="mt-5 text-sm text-amber-700 font-rubik font-bold bg-amber-50 border border-amber-200 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform"
          style={{ boxShadow: '0 2px 8px rgba(180,93,20,0.12)' }}
        >
          הצג הכל
        </button>
      )}
    </div>
  )
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-rubik font-bold transition-all duration-200 active:scale-95 cursor-pointer border min-h-[36px]"
      style={
        active && color
          ? {
              backgroundColor: color,
              color: 'white',
              borderColor: `${color}40`,
              boxShadow: `0 4px 12px ${color}40, inset 0 1px 0 rgba(255,255,255,0.20)`,
            }
          : active
            ? {
                backgroundColor: '#8B5E3C',
                color: 'white',
                borderColor: 'rgba(61,43,31,0.2)',
                boxShadow: '0 4px 12px rgba(61,43,31,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
              }
            : {
                backgroundColor: '#FFFAF5',
                color: '#7A5035',
                borderColor: '#EDD9C0',
              }
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
        <p className="text-sm font-bold text-brown-600 mb-2 font-rubik">{t('feeding.time')}</p>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full bg-cream-50 rounded-2xl px-4 py-3 text-brown-800 font-rubik outline-none border border-cream-200 focus:border-amber-300 transition-colors duration-150"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button className="flex-1" onClick={() => onSave(time)} disabled={loading}>{t('common.save')}</Button>
      </div>
    </div>
  )
}
