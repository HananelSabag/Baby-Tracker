import { useState } from 'react'
import { format } from 'date-fns'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useEvents } from '../hooks/useEvents'
import { groupEventsByDay, formatTime } from '../lib/utils'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { AddFeedingForm } from '../components/forms/AddFeedingForm'
import { AddDiaperForm } from '../components/forms/AddDiaperForm'
import { AddCustomEventForm } from '../components/forms/AddCustomEventForm'
import { TRACKER_TYPES } from '../lib/constants'

export function HistoryPage() {
  const { identity } = useApp()
  const { trackers } = useTrackers(identity.familyId)
  const { events, loading, deleteEvent, updateEvent } = useEvents(identity.familyId, { days: 30 })
  const [filterTrackerId, setFilterTrackerId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  const filtered = filterTrackerId ? events.filter(e => e.tracker_id === filterTrackerId) : events
  const grouped = groupEventsByDay(filtered)

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteEvent(deleteTarget)
    setDeleteTarget(null)
  }

  // Called by feeding / diaper / custom forms on save
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

  // Called by time-only form for vitamin_d / dose
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

    if (type === TRACKER_TYPES.FEEDING) {
      return (
        <AddFeedingForm
          initialData={editTarget.data}
          initialTime={initialTime}
          onSave={handleEditSave}
          onCancel={() => setEditTarget(null)}
          loading={editSaving}
        />
      )
    }
    if (type === TRACKER_TYPES.DIAPER) {
      return (
        <AddDiaperForm
          initialData={editTarget.data}
          initialTime={initialTime}
          onSave={handleEditSave}
          onCancel={() => setEditTarget(null)}
          loading={editSaving}
        />
      )
    }
    if (type === TRACKER_TYPES.VITAMIN_D || type === TRACKER_TYPES.DOSE) {
      return (
        <TimeOnlyForm
          initialTime={initialTime}
          onSave={handleTimeOnlySave}
          onCancel={() => setEditTarget(null)}
          loading={editSaving}
        />
      )
    }
    // custom
    return (
      <AddCustomEventForm
        tracker={editTarget.tracker}
        initialData={editTarget.data}
        initialTime={initialTime}
        onSave={handleEditSave}
        onCancel={() => setEditTarget(null)}
        loading={editSaving}
      />
    )
  }

  function formatEventSummary(event) {
    const type = event.tracker?.tracker_type
    const data = event.data ?? {}
    if (type === 'feeding') return `${data.amount_ml} מ"ל`
    if (type === 'vitamin_d') return data.dose === 'morning' ? t('vitaminD.morning') : t('vitaminD.evening')
    if (type === 'diaper') {
      const map = { wet: t('diaper.wet'), dirty: t('diaper.dirty'), both: t('diaper.both') }
      return map[data.type] ?? ''
    }
    return Object.values(data).filter(Boolean).join(', ')
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-4">{t('history.title')}</h1>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
        <FilterChip label={t('history.filterAll')} active={!filterTrackerId} onClick={() => setFilterTrackerId(null)} />
        {trackers.map(tr => (
          <FilterChip
            key={tr.id}
            label={`${tr.icon} ${tr.name}`}
            active={filterTrackerId === tr.id}
            color={tr.color}
            onClick={() => setFilterTrackerId(filterTrackerId === tr.id ? null : tr.id)}
          />
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-brown-400 font-rubik">{t('history.noEvents')}</div>
      ) : (
        <div className="space-y-6 pb-4">
          {Array.from(grouped.entries()).map(([dateLabel, dayEvents]) => (
            <div key={dateLabel}>
              <p className="font-rubik font-semibold text-brown-600 text-sm mb-2">{dateLabel}</p>
              <div className="space-y-2">
                {dayEvents.map(event => (
                  <div key={event.id} className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3">
                    <span className="text-xl">{event.tracker?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-rubik font-medium text-brown-800 text-sm">{event.tracker?.name}</p>
                      <p className="font-rubik text-brown-500 text-xs">
                        {formatTime(event.occurred_at)} · {formatEventSummary(event)}
                        {event.member && ` · ${event.member.display_name}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditTarget(event)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-brown-300 hover:text-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteTarget(event.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-brown-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
      style={active && color ? { backgroundColor: color, color: 'white' } : {}}
      data-active={active && !color ? 'true' : undefined}
    >
      <span className={active && !color ? 'text-brown-800 font-semibold' : 'text-brown-500'}>
        {label}
      </span>
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
