import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings2, Pencil, Trash2, Plus, LayoutGrid, List, ChevronLeft } from 'lucide-react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { TRACKER_COLORS, TRACKER_ICONS, TRACKER_ARCHETYPES } from '../lib/constants'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { cn } from '../lib/utils'

// Wizard steps
const WIZARD_STEPS = { ARCHETYPE: 'archetype', IDENTITY: 'identity', DOSE_CONFIG: 'dose_config', DISPLAY_MODE: 'display_mode', MEASURE_CONFIG: 'measure_config' }
const DOSE_EMOJIS = ['☀️', '🌙', '🌅', '🌤', '⭐', '💫']
const MEASURE_UNITS = ['מ"ל', 'גרם', '°C', 'ס"מ', 'ק"ג', 'אחר']

// ─── Main page ────────────────────────────────────────────────────────────────
export function ControlCenterPage() {
  const { identity } = useApp()
  const [searchParams] = useSearchParams()
  const openAdd = searchParams.get('action') === 'add'

  return (
    <div className="pb-24">
      <TrackersTab familyId={identity.familyId} openAdd={openAdd} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — TRACKERS
// ═══════════════════════════════════════════════════════════════════════════════

function TrackersTab({ familyId, openAdd }) {
  const { toasts, showToast, dismissToast } = useToast()
  const { trackers, addTracker, updateTracker, deleteTracker } = useTrackers(familyId)
  const [addSheetOpen, setAddSheetOpen] = useState(false)

  useEffect(() => {
    if (openAdd) setAddSheetOpen(true)
  }, [openAdd])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)       // DoseConfigSheet
  const [editTrackerTarget, setEditTrackerTarget] = useState(null) // EditTrackerSheet

  const sorted = [...trackers].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="px-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header + add button — always at top, never fixed */}
      <div className="flex items-center justify-between pt-6 mb-4">
        <h1 className="font-rubik font-bold text-2xl text-brown-800 leading-tight">המעקבים שלי</h1>
        <Button onClick={() => setAddSheetOpen(true)} className="shadow-soft text-sm px-4 py-2 flex items-center gap-1.5">
          <Plus size={15} />
          {t('settings.addTracker')}
        </Button>
      </div>

      <div className="space-y-2 mb-28">
        {sorted.map(tr => {
          const isDefault = tr.is_builtin
          const isDose = tr.tracker_type === 'vitamin_d' || tr.tracker_type === 'dose'

          return (
            <div
              key={tr.id}
              className="bg-white rounded-2xl overflow-hidden border border-cream-200"
              style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.95)' }}
            >
              {/* Tracker color accent strip */}
              <div className="h-1 w-full" style={{ backgroundColor: tr.color }} />

              {/* Main row */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: `${tr.color}20`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7)` }}
                >
                  {tr.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-rubik font-semibold text-brown-800">{tr.name}</p>
                    <span className={cn(
                      'text-[11px] font-rubik px-2 py-0.5 rounded-lg flex-shrink-0',
                      isDefault ? 'bg-cream-100 text-brown-400' : 'bg-amber-50 text-amber-700'
                    )}>
                      {isDefault ? 'ברירת מחדל' : 'מותאם אישית'}
                    </span>
                  </div>
                  {isDefault && (
                    <p className="text-xs font-rubik text-brown-300 mt-0.5">ניתן לערוך שם, אייקון וצבע</p>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="px-3 pb-3 pt-1 flex items-center gap-2 border-t border-cream-100 flex-wrap">
                {isDose && (
                  <button
                    onClick={() => setEditTarget(tr)}
                    className="flex items-center gap-1.5 text-xs font-rubik font-semibold text-brown-600 bg-cream-100 px-3 py-2 rounded-xl cursor-pointer active:scale-95 transition-all duration-150 min-h-[36px]"
                    style={{ boxShadow: '0 1px 4px rgba(61,43,31,0.06)' }}
                  >
                    <Settings2 size={13} />
                    {t('settings.dosesButton')}
                  </button>
                )}
                <button
                  onClick={() => setEditTrackerTarget(tr)}
                  className="flex items-center gap-1.5 text-xs font-rubik font-semibold text-brown-600 bg-cream-100 px-3 py-2 rounded-xl cursor-pointer active:scale-95 transition-all duration-150 min-h-[36px]"
                  style={{ boxShadow: '0 1px 4px rgba(61,43,31,0.06)' }}
                >
                  <Pencil size={13} />
                  {t('common.edit')}
                </button>
                {!isDefault ? (
                  <button
                    onClick={() => setDeleteTarget(tr.id)}
                    className="flex items-center gap-1.5 text-xs font-rubik font-semibold text-red-400 bg-red-50 px-3 py-2 rounded-xl cursor-pointer active:scale-95 transition-all duration-150 min-h-[36px]"
                    style={{ boxShadow: '0 1px 4px rgba(239,68,68,0.06)' }}
                  >
                    <Trash2 size={13} />
                    {t('common.delete')}
                  </button>
                ) : (
                  <span className="text-xs font-rubik text-brown-300 mr-auto">לא ניתן למחיקה</span>
                )}
              </div>
            </div>
          )
        })}

        {sorted.length === 0 && (
          <button
            onClick={() => setAddSheetOpen(true)}
            className="w-full py-10 rounded-3xl border-2 border-dashed border-cream-300 text-brown-400 font-rubik text-sm cursor-pointer active:scale-95 transition-transform flex flex-col items-center gap-3"
          >
            <div
              className="w-14 h-14 rounded-2xl bg-cream-100 flex items-center justify-center border border-cream-200"
              style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.06)' }}
            >
              <Plus size={22} className="text-brown-400" />
            </div>
            {t('settings.addTracker')}
          </button>
        )}
      </div>

      <AddTrackerWizard
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={async data => {
          await addTracker(data)
          setAddSheetOpen(false)
          showToast({ message: `"${data.name}" נוסף בהצלחה`, emoji: '✅' })
        }}
      />

      {editTarget && (
        <DoseConfigSheet
          tracker={editTarget}
          isOpen={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          onSave={async config => {
            await updateTracker(editTarget.id, { config })
            setEditTarget(null)
            showToast({ message: t('settings.dosesSaved'), emoji: '💊' })
          }}
        />
      )}

      {editTrackerTarget && (
        <EditTrackerSheet
          tracker={editTrackerTarget}
          isOpen={Boolean(editTrackerTarget)}
          onClose={() => setEditTrackerTarget(null)}
          onSave={async updates => {
            await updateTracker(editTrackerTarget.id, updates)
            setEditTrackerTarget(null)
            showToast({ message: t('settings.trackerUpdated', { name: updates.name || editTrackerTarget.name }), emoji: '✅' })
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

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKER SUB-COMPONENTS (wizard, sheets)
// ═══════════════════════════════════════════════════════════════════════════════

function DoseConfigSheet({ tracker, isOpen, onClose, onSave }) {
  const existingConfig = tracker.config ?? {}
  const [doseCount, setDoseCount] = useState(existingConfig.daily_doses ?? 2)
  const [labels, setLabels] = useState(
    existingConfig.dose_labels ?? ['בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם']
  )
  const [saving, setSaving] = useState(false)
  const MAX_DOSES = 6

  function updateLabel(i, val) {
    setLabels(prev => prev.map((l, idx) => idx === i ? val : l))
  }

  async function handleSave() {
    setSaving(true)
    await onSave({
      ...existingConfig,
      daily_doses: doseCount,
      dose_labels: labels.slice(0, doseCount),
    })
    setSaving(false)
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('settings.doseConfigTitle', { name: tracker.name })}>
      <div className="space-y-5">
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

        <div>
          <p className="text-sm font-medium text-brown-600 mb-3">{t('settings.doseName')}</p>
          <div className="space-y-2">
            {Array.from({ length: doseCount }, (_, i) => (
              <div key={i} className="flex items-center gap-3 bg-cream-200 rounded-2xl px-4 py-3">
                <span className="text-xl">{DOSE_EMOJIS[i]}</span>
                <input
                  type="text"
                  value={labels[i] ?? ''}
                  onChange={e => updateLabel(i, e.target.value)}
                  placeholder={t('settings.dosePlaceholder', { number: i + 1 })}
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

function AddTrackerWizard({ isOpen, onClose, onAdd }) {
  const [step, setStep]             = useState(WIZARD_STEPS.ARCHETYPE)
  const [archetype, setArchetype]   = useState(null)
  const [name, setName]             = useState('')
  const [icon, setIcon]             = useState(TRACKER_ICONS[0])
  const [color, setColor]           = useState(TRACKER_COLORS[3])
  const [doseCount, setDoseCount]   = useState(2)
  const [doseLabels, setDoseLabels] = useState(['בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם'])
  const [displayMode, setDisplayMode]         = useState('buttons')
  const [measureLabel, setMeasureLabel]       = useState('')
  const [measureUnit, setMeasureUnit]         = useState('')
  const [measureUnitCustom, setMeasureUnitCustom] = useState('')
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState(null)

  const totalSteps = archetype?.id === 'dose' ? 3 : archetype?.id === 'measure' ? 2 : 1
  const currentStepIndex =
    step === WIZARD_STEPS.IDENTITY      ? 0 :
    step === WIZARD_STEPS.DOSE_CONFIG   ? 1 :
    step === WIZARD_STEPS.MEASURE_CONFIG? 1 :
    step === WIZARD_STEPS.DISPLAY_MODE  ? 2 : null

  const effectiveUnit = measureUnit === 'אחר' ? measureUnitCustom.trim() : measureUnit

  function reset() {
    setStep(WIZARD_STEPS.ARCHETYPE)
    setArchetype(null)
    setName('')
    setIcon(TRACKER_ICONS[0])
    setColor(TRACKER_COLORS[3])
    setDoseCount(2)
    setDoseLabels(['בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם'])
    setDisplayMode('buttons')
    setMeasureLabel('')
    setMeasureUnit('')
    setMeasureUnitCustom('')
    setSaveError(null)
  }

  function handleClose() { reset(); onClose() }

  function handleArchetypeSelect(a) {
    setArchetype(a)
    setStep(WIZARD_STEPS.IDENTITY)
  }

  function handleIdentityNext() {
    if (!name.trim()) return
    setSaveError(null)
    if (archetype.id === 'dose')         setStep(WIZARD_STEPS.DOSE_CONFIG)
    else if (archetype.id === 'measure') setStep(WIZARD_STEPS.MEASURE_CONFIG)
    else handleSave()
  }

  function handleDoseNext() {
    setStep(WIZARD_STEPS.DISPLAY_MODE)
  }

  async function handleSave(chosenDisplayMode) {
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const isDose    = archetype.id === 'dose'
      const isMeasure = archetype.id === 'measure'
      const effectiveDisplayMode = chosenDisplayMode ?? displayMode
      const doseConfig = {
        daily_doses: doseCount,
        dose_labels: doseLabels.slice(0, doseCount),
        ...(effectiveDisplayMode === 'simple' ? { display_mode: 'simple' } : {}),
      }
      const fieldLabel = (measureLabel.trim() || name.trim()) + (effectiveUnit ? ` (${effectiveUnit})` : '')
      const payload = {
        name: name.trim(),
        icon,
        color,
        tracker_type: archetype.tracker_type,
        field_schema: isMeasure
          ? [{ key: 'value', type: 'number', label: fieldLabel }]
          : [],
        config: isDose ? doseConfig : {},
      }
      await onAdd(payload)
      reset()
    } catch {
      setSaveError('שמירה נכשלה — בדוק חיבור לאינטרנט ונסה שוב')
    } finally {
      setSaving(false)
    }
  }

  const stepTitle = {
    [WIZARD_STEPS.ARCHETYPE]:     t('settings.addTracker'),
    [WIZARD_STEPS.IDENTITY]:      t('settings.wizardIdentity'),
    [WIZARD_STEPS.DOSE_CONFIG]:   t('settings.wizardDoseConfig'),
    [WIZARD_STEPS.DISPLAY_MODE]:  t('settings.displayMode'),
    [WIZARD_STEPS.MEASURE_CONFIG]: t('settings.wizardMeasure'),
  }[step]

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title={stepTitle}>
      <div className="space-y-4">

        {/* Step progress dots */}
        {currentStepIndex !== null && totalSteps > 1 && (
          <div className="flex justify-center gap-1.5 -mt-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === currentStepIndex ? 20 : 6,
                  height: 6,
                  backgroundColor: i === currentStepIndex ? color : '#D6C4B0',
                }}
              />
            ))}
          </div>
        )}

        {/* ── ARCHETYPE selection ── */}
        {step === WIZARD_STEPS.ARCHETYPE && (
          <div className="space-y-2.5">
            {TRACKER_ARCHETYPES.map(a => (
              <button
                key={a.id}
                onClick={() => handleArchetypeSelect(a)}
                className="w-full flex items-center gap-4 py-4 px-4 rounded-3xl bg-white border border-cream-200 active:scale-[0.98] transition-all cursor-pointer"
                style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.95)' }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#F5EDE0', boxShadow: 'inset 0 1px 4px rgba(61,43,31,0.06)' }}
                >
                  <span className="text-3xl">{a.icon}</span>
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="font-rubik font-bold text-brown-800 text-base">{a.label}</p>
                  <p className="font-rubik text-brown-400 text-xs leading-tight mt-0.5">{a.description}</p>
                </div>
                <ChevronLeft size={16} className="text-brown-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* ── IDENTITY: name / icon / color ── */}
        {step === WIZARD_STEPS.IDENTITY && (
          <>
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerName')}</p>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`${archetype.icon} שם המעקב`}
                className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-base"
                autoFocus
                maxLength={30}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerIcon')}</p>
              <div className="flex flex-wrap gap-2">
                {TRACKER_ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={cn('w-11 h-11 rounded-2xl text-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer border',
                      icon === ic ? 'border-brown-400 scale-110' : 'bg-cream-200 border-transparent')}
                    style={icon === ic ? { backgroundColor: `${color}25` } : {}}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerColor')}</p>
              <div className="flex flex-wrap gap-2">
                {TRACKER_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn('w-9 h-9 rounded-full transition-all active:scale-95 cursor-pointer', color === c ? 'scale-125 ring-2 ring-brown-700 ring-offset-2' : '')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div
              className="rounded-2xl overflow-hidden border border-cream-200"
              style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.95)' }}
            >
              <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                  {icon}
                </div>
                <span className="font-rubik font-semibold text-brown-800 flex-1">{name || 'תצוגה מקדימה'}</span>
                <span className="text-xs font-rubik text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">חדש</span>
              </div>
            </div>

            {saveError && (
              <p className="text-xs font-rubik text-red-600 bg-red-50 rounded-2xl px-3 py-2 border border-red-100">{saveError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(WIZARD_STEPS.ARCHETYPE)}>{t('common.back')}</Button>
              <Button className="flex-1" onClick={handleIdentityNext} disabled={!name.trim() || saving}>
                {(archetype.id === 'dose' || archetype.id === 'measure')
                  ? t('settings.nextButton')
                  : saving ? t('app.loading') : t('common.save')}
              </Button>
            </div>
          </>
        )}

        {/* ── DOSE_CONFIG ── */}
        {step === WIZARD_STEPS.DOSE_CONFIG && (
          <>
            <p className="text-sm font-medium text-brown-600">{t('settings.howManyDoses')}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setDoseCount(n)}
                  className={cn('flex-1 py-3 rounded-2xl font-rubik font-bold text-lg transition-all active:scale-95 cursor-pointer border',
                    doseCount === n ? 'text-white border-transparent shadow-soft' : 'bg-cream-200 text-brown-600 border-transparent')}
                  style={doseCount === n ? { backgroundColor: color } : {}}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-sm font-medium text-brown-600">{t('settings.doseName')}</p>
            <div className="space-y-2">
              {Array.from({ length: doseCount }, (_, i) => (
                <div key={i} className="flex items-center gap-3 bg-cream-200 rounded-2xl px-4 py-3">
                  <span className="text-xl">{DOSE_EMOJIS[i]}</span>
                  <input
                    type="text"
                    value={doseLabels[i] ?? ''}
                    onChange={e => setDoseLabels(prev => prev.map((l, idx) => idx === i ? e.target.value : l))}
                    placeholder={t('settings.dosePlaceholder', { number: i + 1 })}
                    className="flex-1 bg-transparent font-rubik text-brown-800 outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(WIZARD_STEPS.IDENTITY)}>{t('common.back')}</Button>
              <Button className="flex-1" onClick={handleDoseNext}>{t('settings.nextButton')}</Button>
            </div>
          </>
        )}

        {/* ── DISPLAY_MODE ── */}
        {step === WIZARD_STEPS.DISPLAY_MODE && (
          <>
            <p className="text-sm text-brown-400 font-rubik text-center mb-2">{t('settings.displayModeQuestion', { name })}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { mode: 'buttons', Icon: LayoutGrid, label: t('settings.displayModeButtons'), desc: t('settings.displayModeButtonsDesc') },
                { mode: 'simple',  Icon: List,       label: t('settings.displayModeSimple'),  desc: t('settings.displayModeSimpleDesc') },
              ].map(({ mode, Icon, label, desc }) => (
                <button
                  key={mode}
                  onClick={() => handleSave(mode)}
                  disabled={saving}
                  className="flex flex-col items-center gap-3 py-6 px-3 rounded-3xl border-2 border-cream-200 bg-white transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.06)' }}
                >
                  <Icon size={32} className="text-brown-500" />
                  <span className="font-rubik font-bold text-brown-800 text-sm">{label}</span>
                  <span className="font-rubik text-brown-400 text-xs text-center leading-tight">{desc}</span>
                </button>
              ))}
            </div>
            {saveError && (
              <p className="text-xs font-rubik text-red-600 bg-red-50 rounded-2xl px-3 py-2 border border-red-100">{saveError}</p>
            )}
            <Button variant="secondary" className="w-full mt-1" onClick={() => setStep(WIZARD_STEPS.DOSE_CONFIG)}>
              {t('common.back')}
            </Button>
          </>
        )}

        {/* ── MEASURE_CONFIG ── */}
        {step === WIZARD_STEPS.MEASURE_CONFIG && (
          <>
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">מה תמדוד?</p>
              <input
                type="text"
                value={measureLabel}
                onChange={e => setMeasureLabel(e.target.value)}
                placeholder="לדוגמה: חום גוף, כמות חלב, לחץ דם"
                className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-base"
                autoFocus
                maxLength={30}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">יחידת מידה</p>
              <div className="flex flex-wrap gap-2">
                {MEASURE_UNITS.map(u => (
                  <button
                    key={u}
                    onClick={() => setMeasureUnit(prev => prev === u ? '' : u)}
                    className={cn(
                      'px-4 py-2 rounded-2xl font-rubik text-sm font-medium transition-all active:scale-95 cursor-pointer',
                      measureUnit === u
                        ? 'text-white shadow-soft'
                        : 'bg-cream-200 text-brown-700'
                    )}
                    style={measureUnit === u ? { backgroundColor: color } : {}}
                  >
                    {u}
                  </button>
                ))}
              </div>
              {measureUnit === 'אחר' && (
                <input
                  type="text"
                  value={measureUnitCustom}
                  onChange={e => setMeasureUnitCustom(e.target.value)}
                  placeholder="הכנס יחידה..."
                  className="w-full mt-2 bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-base"
                  maxLength={15}
                  autoFocus
                />
              )}
            </div>

            {/* Field preview */}
            {measureLabel.trim() && (
              <div className="rounded-2xl overflow-hidden border border-cream-200" style={{ background: '#FAFAF8' }}>
                <div className="h-1" style={{ backgroundColor: color }} />
                <div className="px-4 py-3">
                  <p className="text-xs text-brown-400 font-rubik mb-2">כך ייראה השדה:</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <span className="font-rubik text-brown-700 text-sm font-medium">
                      {measureLabel.trim()}{effectiveUnit ? ` (${effectiveUnit})` : ''}
                    </span>
                    <div
                      className="mr-auto h-9 w-20 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${color}18` }}
                    >
                      <span className="font-rubik text-brown-300 text-sm">123</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {saveError && (
              <p className="text-xs font-rubik text-red-600 bg-red-50 rounded-2xl px-3 py-2 border border-red-100">{saveError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(WIZARD_STEPS.IDENTITY)}>{t('common.back')}</Button>
              <Button
                className="flex-1"
                onClick={() => handleSave()}
                disabled={saving || !measureLabel.trim()}
              >
                {saving ? t('app.loading') : t('common.save')}
              </Button>
            </div>
          </>
        )}

      </div>
    </BottomSheet>
  )
}
