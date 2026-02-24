import { useState, useRef, useEffect } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { TRACKER_COLORS, TRACKER_ICONS, FIELD_TYPES, TRACKER_ARCHETYPES } from '../lib/constants'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { cn } from '../lib/utils'

// Wizard steps for creating a new tracker
const WIZARD_STEPS = { ARCHETYPE: 'archetype', IDENTITY: 'identity', DOSE_CONFIG: 'dose_config', DISPLAY_MODE: 'display_mode', FIELDS: 'fields' }

export function SettingsPage() {
  const { identity } = useApp()
  const { toasts, showToast, dismissToast } = useToast()
  const { trackers, addTracker, updateTracker, deleteTracker } = useTrackers(identity.familyId)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null) // dose config
  const [editTrackerTarget, setEditTrackerTarget] = useState(null) // name/icon/color edit

  // ── Reorder state ──────────────────────────────────────────────────────────
  const [localTrackers, setLocalTrackers] = useState([])
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const touchRef = useRef({ active: false, id: null })

  useEffect(() => {
    // Don't overwrite local order while a drag is in progress
    if (dragId) return
    setLocalTrackers([...trackers].sort((a, b) => a.display_order - b.display_order))
  }, [trackers, dragId])

  function moveItem(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return
    setLocalTrackers(prev => {
      const arr = [...prev]
      const fromIdx = arr.findIndex(t => t.id === fromId)
      const toIdx = arr.findIndex(t => t.id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      // Persist new display_order to DB (fire and forget)
      arr.forEach((tr, i) => {
        if (tr.display_order !== i) updateTracker(tr.id, { display_order: i })
      })
      return arr
    })
  }

  // HTML5 drag (desktop)
  function onDragStart(e, id) { setDragId(id); e.dataTransfer.effectAllowed = 'move' }
  function onDragOver(e, id) { e.preventDefault(); if (id !== dragId) setOverId(id) }
  function onDrop(id) { moveItem(dragId, id); setDragId(null); setOverId(null) }
  function onDragEnd() { setDragId(null); setOverId(null) }

  // Touch drag (mobile)
  function onHandleTouchStart(e, id) {
    e.preventDefault()
    touchRef.current = { active: true, id }
    setDragId(id)
  }
  function onListTouchMove(e) {
    if (!touchRef.current.active) return
    e.preventDefault()
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const row = el?.closest('[data-tid]')
    const tid = row?.getAttribute('data-tid')
    if (tid && tid !== touchRef.current.id) setOverId(tid)
  }
  function onListTouchEnd() {
    if (touchRef.current.active) {
      moveItem(touchRef.current.id, overId)
      touchRef.current = { active: false, id: null }
      setDragId(null)
      setOverId(null)
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  function toggleTrackerActive(tracker) {
    updateTracker(tracker.id, { is_active: tracker.is_active === false ? true : false })
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="mb-5">
        <h1 className="font-rubik font-bold text-2xl text-brown-800 leading-tight">מרכז שליטה</h1>
        <p className="font-rubik text-brown-400 text-sm mt-1">
          הפעל / כבה מעקבים, ערוך, מחק ושנה סדר תצוגה במסך הבית
        </p>
      </div>

      {/* Unified tracker list — draggable to reorder */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-rubik font-semibold text-brown-500 text-xs uppercase tracking-wide">המעקבים שלי</p>
            <p className="font-rubik text-brown-400 text-xs mt-0.5">☰ גרור לשינוי סדר</p>
          </div>
          <button
            onClick={() => setAddSheetOpen(true)}
            className="text-sm font-rubik font-semibold text-white bg-amber-600 px-4 py-1.5 rounded-full active:scale-95 transition-transform shadow-soft"
          >
            + {t('settings.addTracker')}
          </button>
        </div>

        <div
          className="space-y-2"
          onTouchMove={onListTouchMove}
          onTouchEnd={onListTouchEnd}
        >
          {localTrackers.map(tr => {
            const isDose = tr.tracker_type === 'vitamin_d' || tr.tracker_type === 'dose'
            const hasActions = isDose || !tr.is_builtin
            return (
              <div
                key={tr.id}
                data-tid={tr.id}
                draggable
                onDragStart={e => onDragStart(e, tr.id)}
                onDragOver={e => onDragOver(e, tr.id)}
                onDrop={() => onDrop(tr.id)}
                onDragEnd={onDragEnd}
                className={cn(
                  'bg-white rounded-2xl shadow-soft overflow-hidden transition-all select-none',
                  tr.is_active === false ? 'opacity-50' : '',
                  dragId === tr.id ? 'opacity-40 scale-[0.98]' : '',
                  overId === tr.id && dragId !== tr.id ? 'ring-2 ring-brown-400 ring-offset-1' : ''
                )}
              >
                {/* Color accent strip */}
                <div className="h-1 w-full" style={{ backgroundColor: tr.color }} />

                {/* Main row */}
                <div className="px-3 py-3 flex items-center gap-3">
                  {/* Drag handle */}
                  <div
                    className="text-brown-300 hover:text-brown-500 flex-shrink-0 px-1 text-base cursor-grab active:cursor-grabbing touch-none"
                    onTouchStart={e => onHandleTouchStart(e, tr.id)}
                    title="גרור לשינוי סדר"
                  >
                    ☰
                  </div>

                  <span className="text-2xl flex-shrink-0">{tr.icon}</span>

                  <div className="flex-1 min-w-0">
                    <p className="font-rubik font-medium text-brown-800 truncate">{tr.name}</p>
                    {tr.is_builtin && (
                      <span className="text-xs font-rubik text-brown-400">מובנה</span>
                    )}
                  </div>

                  {/* Active toggle — bigger */}
                  <button
                    onClick={() => toggleTrackerActive(tr)}
                    className="relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0"
                    style={{ backgroundColor: tr.is_active === false ? '#D6C4B0' : '#22C55E' }}
                    title={tr.is_active === false ? t('settings.showTracker') : t('settings.hideTracker')}
                  >
                    <span className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200"
                      style={{ transform: tr.is_active === false ? 'translateX(2px)' : 'translateX(28px)' }} />
                  </button>
                </div>

                {/* Actions row — only when needed */}
                {hasActions && (
                  <div className="px-3 pb-3 flex items-center gap-2 border-t border-cream-100 pt-2">
                    {isDose && (
                      <button
                        onClick={() => setEditTarget(tr)}
                        className="flex items-center gap-1 text-xs font-rubik text-brown-500 bg-cream-100 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                      >
                        ⚙️ מינונים
                      </button>
                    )}
                    {!tr.is_builtin && (
                      <>
                        <button
                          onClick={() => setEditTrackerTarget(tr)}
                          className="flex items-center gap-1 text-xs font-rubik text-brown-500 bg-cream-100 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                        >
                          ✏️ ערוך
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tr.id)}
                          className="flex items-center gap-1 text-xs font-rubik text-red-400 bg-red-50 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                        >
                          🗑 מחק
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Empty state */}
          {localTrackers.length === 0 && (
            <button
              onClick={() => setAddSheetOpen(true)}
              className="w-full py-8 rounded-3xl border-2 border-dashed border-cream-300 text-brown-400 font-rubik text-sm active:scale-95 transition-transform"
            >
              <div className="text-3xl mb-1">➕</div>
              הוסף מעקב מותאם אישית
            </button>
          )}
        </div>
      </div>

      {/* Add tracker wizard */}
      <AddTrackerWizard
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={async data => { await addTracker(data); setAddSheetOpen(false) }}
      />

      {/* Edit dose config sheet */}
      {editTarget && (
        <DoseConfigSheet
          tracker={editTarget}
          isOpen={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          onSave={async config => {
            await updateTracker(editTarget.id, { config })
            setEditTarget(null)
            showToast({ message: 'המינונים נשמרו', emoji: '💊' })
          }}
        />
      )}

      {/* Edit tracker identity sheet */}
      {editTrackerTarget && (
        <EditTrackerSheet
          tracker={editTrackerTarget}
          isOpen={Boolean(editTrackerTarget)}
          onClose={() => setEditTrackerTarget(null)}
          onSave={async updates => {
            await updateTracker(editTrackerTarget.id, updates)
            setEditTrackerTarget(null)
            showToast({ message: `${updates.name || editTrackerTarget.name} עודכן`, emoji: '✅' })
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        message={t('settings.deleteTrackerConfirm')}
        onConfirm={async () => { await deleteTracker(deleteTarget); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  )
}

// ─── Dose Configuration Sheet ───────────────────────────────────────────────

function DoseConfigSheet({ tracker, isOpen, onClose, onSave }) {
  const existingConfig = tracker.config ?? {}
  const [doseCount, setDoseCount] = useState(existingConfig.daily_doses ?? 2)
  const [labels, setLabels] = useState(
    existingConfig.dose_labels ?? ['בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם']
  )
  const [saving, setSaving] = useState(false)

  const DOSE_EMOJIS = ['☀️', '🌙', '🌅', '🌤', '⭐', '💫']
  const MAX_DOSES = 6

  function updateLabel(i, val) {
    setLabels(prev => prev.map((l, idx) => idx === i ? val : l))
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ daily_doses: doseCount, dose_labels: labels.slice(0, doseCount) })
    setSaving(false)
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`הגדרת מינונים — ${tracker.name}`}>
      <div className="space-y-5">
        {/* How many doses per day */}
        <div>
          <p className="text-sm font-medium text-brown-600 mb-3">{t('settings.dosesPerDay')}</p>
          <div className="flex gap-2">
            {Array.from({ length: MAX_DOSES }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setDoseCount(n)}
                className={cn(
                  'flex-1 py-3 rounded-2xl font-rubik font-bold text-lg transition-all active:scale-95',
                  doseCount === n ? 'text-white shadow-soft' : 'bg-cream-200 text-brown-600'
                )}
                style={doseCount === n ? { backgroundColor: tracker.color } : {}}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Dose labels */}
        <div>
          <p className="text-sm font-medium text-brown-600 mb-3">שם כל מינון</p>
          <div className="space-y-2">
            {Array.from({ length: doseCount }, (_, i) => (
              <div key={i} className="flex items-center gap-3 bg-cream-200 rounded-2xl px-4 py-3">
                <span className="text-xl">{DOSE_EMOJIS[i]}</span>
                <input
                  type="text"
                  value={labels[i] ?? ''}
                  onChange={e => updateLabel(i, e.target.value)}
                  placeholder={`מינון ${i + 1}`}
                  className="flex-1 bg-transparent font-rubik text-brown-800 outline-none text-base"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? t('app.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ─── Add Tracker Wizard ──────────────────────────────────────────────────────

function AddTrackerWizard({ isOpen, onClose, onAdd }) {
  const [step, setStep] = useState(WIZARD_STEPS.ARCHETYPE)
  const [archetype, setArchetype] = useState(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(TRACKER_ICONS[0])
  const [color, setColor] = useState(TRACKER_COLORS[3])
  const [doseCount, setDoseCount] = useState(2)
  const [doseLabels, setDoseLabels] = useState(['בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם'])
  const [displayMode, setDisplayMode] = useState('buttons') // 'buttons' | 'simple'
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)

  const DOSE_EMOJIS = ['☀️', '🌙', '🌅', '🌤', '⭐', '💫']

  function reset() {
    setStep(WIZARD_STEPS.ARCHETYPE)
    setArchetype(null)
    setName('')
    setIcon(TRACKER_ICONS[0])
    setColor(TRACKER_COLORS[3])
    setDoseCount(2)
    setDoseLabels(['בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם'])
    setDisplayMode('buttons')
    setFields([])
  }

  function handleClose() { reset(); onClose() }

  function handleArchetypeSelect(a) {
    setArchetype(a)
    if (a.preset_fields) setFields(a.preset_fields)
    setStep(WIZARD_STEPS.IDENTITY)
  }

  function handleIdentityNext() {
    if (!name.trim()) return
    if (archetype.id === 'dose') {
      setStep(WIZARD_STEPS.DOSE_CONFIG)
    } else if (archetype.id === 'freetext') {
      setStep(WIZARD_STEPS.FIELDS)
    } else {
      handleSave()
    }
  }

  function handleDoseNext() {
    setStep(WIZARD_STEPS.DISPLAY_MODE)
  }

  async function handleSave(chosenDisplayMode) {
    if (!name.trim()) return
    setSaving(true)
    try {
      const isDose = archetype.id === 'dose'
      const effectiveDisplayMode = chosenDisplayMode ?? displayMode
      const doseConfig = {
        daily_doses: doseCount,
        dose_labels: doseLabels.slice(0, doseCount),
        ...(effectiveDisplayMode === 'simple' ? { display_mode: 'simple' } : {}),
      }
      const payload = {
        name: name.trim(),
        icon,
        color,
        tracker_type: archetype.tracker_type,
        field_schema: isDose ? [] : (archetype.preset_fields?.length ? archetype.preset_fields : fields),
        config: isDose ? doseConfig : {},
      }
      await onAdd(payload)
      reset()
    } finally {
      setSaving(false)
    }
  }

  function addField() {
    setFields(prev => [...prev, { key: `f_${Date.now()}`, type: 'number', label: '' }])
  }

  function updateField(idx, updates) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f))
  }

  function removeField(idx) {
    setFields(prev => prev.filter((_, i) => i !== idx))
  }

  const stepTitle = {
    [WIZARD_STEPS.ARCHETYPE]: t('settings.addTracker'),
    [WIZARD_STEPS.IDENTITY]: 'שם ועיצוב',
    [WIZARD_STEPS.DOSE_CONFIG]: 'הגדרת מינונים',
    [WIZARD_STEPS.DISPLAY_MODE]: t('settings.displayMode'),
    [WIZARD_STEPS.FIELDS]: 'שדות מותאמים',
  }[step]

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title={stepTitle}>
      <div className="space-y-4">

        {/* Step 1: Choose archetype */}
        {step === WIZARD_STEPS.ARCHETYPE && (
          <div className="grid grid-cols-2 gap-3">
            {TRACKER_ARCHETYPES.map(a => (
              <button
                key={a.id}
                onClick={() => handleArchetypeSelect(a)}
                className="flex flex-col items-center gap-2 py-5 px-3 rounded-3xl bg-white shadow-card active:scale-95 transition-all text-center"
              >
                <span className="text-4xl">{a.icon}</span>
                <span className="font-rubik font-bold text-brown-800 text-base">{a.label}</span>
                <span className="font-rubik text-brown-400 text-xs leading-tight">{a.description}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Name, icon, color */}
        {step === WIZARD_STEPS.IDENTITY && (
          <>
            {/* Name */}
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerName')}</p>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`${archetype.icon} שם המעקב`}
                className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-base"
                autoFocus
              />
            </div>

            {/* Icon */}
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerIcon')}</p>
              <div className="flex flex-wrap gap-2">
                {TRACKER_ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn('w-11 h-11 rounded-2xl text-2xl flex items-center justify-center transition-all active:scale-95', icon === ic ? 'bg-brown-600 shadow-soft scale-110' : 'bg-cream-200')}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerColor')}</p>
              <div className="flex flex-wrap gap-2">
                {TRACKER_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn('w-9 h-9 rounded-full transition-all active:scale-95', color === c ? 'scale-125 ring-2 ring-brown-700 ring-offset-2' : '')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 bg-white rounded-2xl shadow-soft px-4 py-3 mt-1">
              <span className="text-2xl">{icon}</span>
              <span className="font-rubik font-semibold text-brown-800 flex-1">{name || 'תצוגה מקדימה'}</span>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(WIZARD_STEPS.ARCHETYPE)}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleIdentityNext} disabled={!name.trim() || saving}>
                {(archetype.id === 'dose' || archetype.id === 'freetext') ? 'הבא ←' : saving ? t('app.loading') : t('common.save')}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Dose configuration */}
        {step === WIZARD_STEPS.DOSE_CONFIG && (
          <>
            <p className="text-sm font-medium text-brown-600">כמה מינונים ביום?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setDoseCount(n)}
                  className={cn('flex-1 py-3 rounded-2xl font-rubik font-bold text-lg transition-all active:scale-95', doseCount === n ? 'text-white shadow-soft' : 'bg-cream-200 text-brown-600')}
                  style={doseCount === n ? { backgroundColor: color } : {}}
                >
                  {n}
                </button>
              ))}
            </div>

            <p className="text-sm font-medium text-brown-600">שם כל מינון</p>
            <div className="space-y-2">
              {Array.from({ length: doseCount }, (_, i) => (
                <div key={i} className="flex items-center gap-3 bg-cream-200 rounded-2xl px-4 py-3">
                  <span className="text-xl">{DOSE_EMOJIS[i]}</span>
                  <input
                    type="text"
                    value={doseLabels[i] ?? ''}
                    onChange={e => setDoseLabels(prev => prev.map((l, idx) => idx === i ? e.target.value : l))}
                    placeholder={`מינון ${i + 1}`}
                    className="flex-1 bg-transparent font-rubik text-brown-800 outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(WIZARD_STEPS.IDENTITY)}>{t('common.back')}</Button>
              <Button className="flex-1" onClick={handleDoseNext}>
                הבא ←
              </Button>
            </div>
          </>
        )}

        {/* Step 4: Display mode choice */}
        {step === WIZARD_STEPS.DISPLAY_MODE && (
          <>
            <p className="text-sm text-brown-400 font-rubik text-center mb-2">איך להציג את {name} בדף הבית?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSave('buttons')}
                className="flex flex-col items-center gap-3 py-6 px-3 rounded-3xl border-2 border-cream-300 bg-white transition-all active:scale-95 hover:border-brown-400"
              >
                <span className="text-3xl">🟦🟦</span>
                <span className="font-rubik font-bold text-brown-800 text-sm">{t('settings.displayModeButtons')}</span>
                <span className="font-rubik text-brown-400 text-xs text-center leading-tight">{t('settings.displayModeButtonsDesc')}</span>
              </button>
              <button
                onClick={() => handleSave('simple')}
                className="flex flex-col items-center gap-3 py-6 px-3 rounded-3xl border-2 border-cream-300 bg-white transition-all active:scale-95 hover:border-brown-400"
              >
                <span className="text-3xl">➕</span>
                <span className="font-rubik font-bold text-brown-800 text-sm">{t('settings.displayModeSimple')}</span>
                <span className="font-rubik text-brown-400 text-xs text-center leading-tight">{t('settings.displayModeSimpleDesc')}</span>
              </button>
            </div>
            <Button variant="secondary" className="w-full mt-1" onClick={() => setStep(WIZARD_STEPS.DOSE_CONFIG)}>
              {t('common.back')}
            </Button>
          </>
        )}

        {/* Step 5: Free-text fields */}
        {step === WIZARD_STEPS.FIELDS && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-brown-600">שדות</p>
              <button onClick={addField} className="text-sm font-rubik font-semibold text-brown-600 bg-cream-200 px-3 py-1.5 rounded-full">+ הוסף שדה</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {fields.map((field, idx) => (
                <div key={field.key} className="bg-cream-200 rounded-2xl p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={field.label}
                      onChange={e => updateField(idx, { label: e.target.value })}
                      placeholder={t('settings.fieldLabel')}
                      className="flex-1 bg-white rounded-xl px-3 py-2 font-rubik text-sm text-brown-800 outline-none"
                    />
                    <button onClick={() => removeField(idx)} className="text-brown-300 hover:text-red-400 text-xl font-bold">×</button>
                  </div>
                  <select
                    value={field.type}
                    onChange={e => updateField(idx, { type: e.target.value, options: e.target.value === 'choice' ? (field.options ?? []) : undefined })}
                    className="w-full bg-white rounded-xl px-3 py-2 font-rubik text-sm text-brown-700 outline-none"
                  >
                    {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                  </select>
                  {field.type === 'choice' && (
                    <div>
                      <p className="text-xs text-brown-400 mb-1">אפשרויות (אחת בכל שורה)</p>
                      <textarea
                        rows={3}
                        value={(field.options ?? []).join('\n')}
                        onChange={e => updateField(idx, { options: e.target.value.split('\n').map(o => o.trim()).filter(Boolean) })}
                        placeholder={'אפשרות 1\nאפשרות 2\nאפשרות 3'}
                        className="w-full bg-white rounded-xl px-3 py-2 font-rubik text-sm text-brown-800 outline-none resize-none"
                      />
                    </div>
                  )}
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-center text-brown-400 text-sm font-rubik py-3">הוסף לפחות שדה אחד</p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(WIZARD_STEPS.IDENTITY)}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? t('app.loading') : t('common.save')}
              </Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

// ─── Edit Tracker Sheet (name / icon / color only) ────────────────────────────

function EditTrackerSheet({ tracker, isOpen, onClose, onSave }) {
  const [name, setName] = useState(tracker.name)
  const [icon, setIcon] = useState(tracker.icon)
  const [color, setColor] = useState(tracker.color)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), icon, color })
    setSaving(false)
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('settings.editTracker')}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerName')}</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-base"
            autoFocus
          />
        </div>
        <div>
          <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerIcon')}</p>
          <div className="flex flex-wrap gap-2">
            {TRACKER_ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                className={cn('w-11 h-11 rounded-2xl text-2xl flex items-center justify-center transition-all active:scale-95', icon === ic ? 'bg-brown-600 shadow-soft scale-110' : 'bg-cream-200')}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerColor')}</p>
          <div className="flex flex-wrap gap-2">
            {TRACKER_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={cn('w-9 h-9 rounded-full transition-all active:scale-95', color === c ? 'scale-125 ring-2 ring-brown-700 ring-offset-2' : '')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? t('app.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
