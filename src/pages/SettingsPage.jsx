import { useState, useRef } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useChildren, addChild } from '../hooks/useChildren'
import { TRACKER_COLORS, TRACKER_ICONS, FIELD_TYPES, TRACKER_ARCHETYPES, STORAGE_KEYS } from '../lib/constants'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

// Wizard steps for creating a new tracker
const WIZARD_STEPS = { ARCHETYPE: 'archetype', IDENTITY: 'identity', DOSE_CONFIG: 'dose_config', FIELDS: 'fields' }

export function SettingsPage() {
  const { identity } = useApp()
  const { trackers, addTracker, updateTracker, deleteTracker } = useTrackers(identity.familyId)
  const { children, updateChild } = useChildren(identity.familyId)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [addChildSheetOpen, setAddChildSheetOpen] = useState(false)
  const [editChildTarget, setEditChildTarget] = useState(null)
  const [notificationsOn, setNotificationsOn] = useState(
    () => localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) === null
      ? true
      : localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) === 'true'
  )

  const builtins = trackers.filter(tr => tr.is_builtin)
  const customs = trackers.filter(tr => !tr.is_builtin)

  function toggleNotifications() {
    const next = !notificationsOn
    setNotificationsOn(next)
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(next))
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-5">{t('settings.title')}</h1>

      {/* Children section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-rubik font-semibold text-brown-500 text-xs uppercase tracking-wide">{t('settings.childrenSection')}</p>
          <button
            onClick={() => setAddChildSheetOpen(true)}
            className="text-sm font-rubik font-semibold text-white bg-brown-600 px-4 py-1.5 rounded-full active:scale-95 transition-transform shadow-soft"
          >
            + {t('children.addChild')}
          </button>
        </div>
        {children.length === 0 ? (
          <button onClick={() => setAddChildSheetOpen(true)} className="w-full py-6 rounded-3xl border-2 border-dashed border-cream-300 text-brown-400 font-rubik text-sm active:scale-95 transition-transform">
            <div className="text-3xl mb-1">👶</div>
            {t('children.noChildren')}
          </button>
        ) : (
          <div className="space-y-2">
            {children.map(child => (
              <div key={child.id} className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0">
                  {child.avatar_url
                    ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                    : <span className="text-xl">👶</span>
                  }
                </div>
                <span className="font-rubik font-medium text-brown-800 flex-1">{child.name}</span>
                <button
                  onClick={() => setEditChildTarget(child)}
                  className="text-xs font-rubik text-brown-500 bg-cream-200 px-3 py-1.5 rounded-full"
                >
                  ✏️ ערוך
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications toggle */}
      <div className="mb-5 bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-rubik font-medium text-brown-800">{t('notifications.title')}</p>
          <p className="font-rubik text-brown-400 text-xs">{t('notifications.subtitle')}</p>
        </div>
        <button
          onClick={toggleNotifications}
          className="relative w-12 h-6 rounded-full transition-colors duration-200"
          style={{ backgroundColor: notificationsOn ? '#8B5E3C' : '#D6C4B0' }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
            style={{ transform: notificationsOn ? 'translateX(26px)' : 'translateX(2px)' }}
          />
        </button>
      </div>

      {/* Built-in trackers */}
      <div className="mb-5">
        <p className="font-rubik font-semibold text-brown-500 text-xs uppercase tracking-wide mb-2">{t('settings.builtinTrackers')}</p>
        <div className="space-y-2">
          {builtins.map(tr => (
            <div key={tr.id} className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{tr.icon}</span>
              <span className="font-rubik font-medium text-brown-800 flex-1">{tr.name}</span>
              {/* Dose config button for vitamin_d and dose types */}
              {(tr.tracker_type === 'vitamin_d' || tr.tracker_type === 'dose') && (
                <button
                  onClick={() => setEditTarget(tr)}
                  className="text-xs font-rubik text-brown-500 bg-cream-200 px-3 py-1.5 rounded-full"
                >
                  ⚙️ מינונים
                </button>
              )}
              <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: tr.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Custom trackers */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-rubik font-semibold text-brown-500 text-xs uppercase tracking-wide">{t('settings.customTrackers')}</p>
          <button
            onClick={() => setAddSheetOpen(true)}
            className="text-sm font-rubik font-semibold text-white bg-brown-600 px-4 py-1.5 rounded-full active:scale-95 transition-transform shadow-soft"
          >
            + {t('settings.addTracker')}
          </button>
        </div>
        {customs.length === 0 ? (
          <button
            onClick={() => setAddSheetOpen(true)}
            className="w-full py-8 rounded-3xl border-2 border-dashed border-cream-300 text-brown-400 font-rubik text-sm active:scale-95 transition-transform"
          >
            <div className="text-3xl mb-1">➕</div>
            הוסף מעקב מותאם אישית
          </button>
        ) : (
          <div className="space-y-2">
            {customs.map(tr => (
              <div key={tr.id} className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{tr.icon}</span>
                <span className="font-rubik font-medium text-brown-800 flex-1">{tr.name}</span>
                {(tr.tracker_type === 'dose') && (
                  <button
                    onClick={() => setEditTarget(tr)}
                    className="text-xs font-rubik text-brown-500 bg-cream-200 px-3 py-1.5 rounded-full"
                  >
                    ⚙️ מינונים
                  </button>
                )}
                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: tr.color }} />
                <button
                  onClick={() => setDeleteTarget(tr.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-brown-200 hover:text-red-400 transition-colors text-lg"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
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
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        message={t('settings.deleteTrackerConfirm')}
        onConfirm={async () => { await deleteTracker(deleteTarget); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Add child sheet */}
      <ChildFormSheet
        isOpen={addChildSheetOpen}
        onClose={() => setAddChildSheetOpen(false)}
        title={t('children.addChild')}
        onSave={async ({ name, avatarFile }) => {
          let uploadedUrl = null
          if (avatarFile) {
            const ext = avatarFile.name.split('.').pop()
            const path = `children/${Date.now()}.${ext}`
            const { error } = await supabase.storage.from('avatars').upload(path, avatarFile)
            if (!error) {
              const { data } = supabase.storage.from('avatars').getPublicUrl(path)
              uploadedUrl = data.publicUrl
            }
          }
          await addChild({ familyId: identity.familyId, name, avatarUrl: uploadedUrl })
          setAddChildSheetOpen(false)
        }}
      />

      {/* Edit child sheet */}
      {editChildTarget && (
        <ChildFormSheet
          isOpen={Boolean(editChildTarget)}
          onClose={() => setEditChildTarget(null)}
          title={t('children.editChild')}
          initialName={editChildTarget.name}
          initialAvatar={editChildTarget.avatar_url}
          onSave={async ({ name, avatarFile }) => {
            let uploadedUrl = editChildTarget.avatar_url
            if (avatarFile) {
              const ext = avatarFile.name.split('.').pop()
              const path = `children/${Date.now()}.${ext}`
              const { error } = await supabase.storage.from('avatars').upload(path, avatarFile)
              if (!error) {
                const { data } = supabase.storage.from('avatars').getPublicUrl(path)
                uploadedUrl = data.publicUrl
              }
            }
            await updateChild(editChildTarget.id, { name, avatar_url: uploadedUrl })
            setEditChildTarget(null)
          }}
        />
      )}
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

  const DOSE_EMOJIS = ['🌅', '☀️', '🌤', '🌙', '⭐', '💫']
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
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)

  const DOSE_EMOJIS = ['🌅', '☀️', '🌤', '🌙', '⭐', '💫']

  function reset() {
    setStep(WIZARD_STEPS.ARCHETYPE)
    setArchetype(null)
    setName('')
    setIcon(TRACKER_ICONS[0])
    setColor(TRACKER_COLORS[3])
    setDoseCount(2)
    setDoseLabels(['בוקר', 'ערב', 'צהריים', 'לילה', 'בוקר מאוחר', 'ערב מוקדם'])
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
    handleSave()
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const isDose = archetype.id === 'dose'
      const payload = {
        name: name.trim(),
        icon,
        color,
        tracker_type: archetype.tracker_type,
        field_schema: isDose ? [] : (archetype.preset_fields ?? fields),
        config: isDose ? { daily_doses: doseCount, dose_labels: doseLabels.slice(0, doseCount) } : {},
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
                {archetype.id === 'dose' ? 'הבא ←' : saving ? t('app.loading') : t('common.save')}
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
              <Button variant="secondary" className="flex-1" onClick={() => setStep(WIZARD_STEPS.IDENTITY)}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleDoseNext} disabled={saving}>
                {saving ? t('app.loading') : t('common.save')}
              </Button>
            </div>
          </>
        )}

        {/* Step 4: Free-text fields */}
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
                    onChange={e => updateField(idx, { type: e.target.value })}
                    className="w-full bg-white rounded-xl px-3 py-2 font-rubik text-sm text-brown-700 outline-none"
                  >
                    {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                  </select>
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

// ─── Child Form Sheet (add / edit child) ──────────────────────────────────────

function ChildFormSheet({ isOpen, onClose, title, initialName = '', initialAvatar = null, onSave }) {
  const [name, setName] = useState(initialName)
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar)
  const [avatarFile, setAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('children.nameRequired')); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), avatarFile })
    } catch {
      setError(t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center active:scale-95 transition-transform border-4 border-white shadow-soft"
          >
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-4xl">👶</span>
            }
          </button>
          <button onClick={() => fileRef.current?.click()} className="text-xs font-rubik text-brown-500 bg-cream-200 px-3 py-1.5 rounded-full">
            {t('children.addPhoto')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Name */}
        <div>
          <p className="text-sm font-medium text-brown-600 mb-2">{t('children.childName')}</p>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder={t('children.childNamePlaceholder')}
            className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 text-base outline-none"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-1 font-rubik">{error}</p>}
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
