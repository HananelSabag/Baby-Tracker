import { useState } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { TRACKER_COLORS, TRACKER_ICONS, FIELD_TYPES } from '../lib/constants'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { cn } from '../lib/utils'

export function SettingsPage() {
  const { identity } = useApp()
  const { trackers, addTracker, deleteTracker } = useTrackers(identity.familyId)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const builtins = trackers.filter(t => t.is_builtin)
  const customs = trackers.filter(t => !t.is_builtin)

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-6">{t('settings.title')}</h1>

      {/* Family info */}
      <Card className="mb-4">
        <p className="text-xs text-brown-400 font-rubik mb-1">{t('settings.myName')}</p>
        <p className="font-rubik font-bold text-brown-800 text-lg">{identity.memberName}</p>
      </Card>

      {/* Built-in trackers */}
      <div className="mb-4">
        <p className="font-rubik font-semibold text-brown-600 text-sm mb-2">{t('settings.builtinTrackers')}</p>
        <div className="space-y-2">
          {builtins.map(tr => (
            <div key={tr.id} className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">{tr.icon}</span>
              <span className="font-rubik font-medium text-brown-800 flex-1">{tr.name}</span>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tr.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Custom trackers */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-rubik font-semibold text-brown-600 text-sm">{t('settings.customTrackers')}</p>
          <button
            onClick={() => setAddSheetOpen(true)}
            className="text-sm font-rubik font-medium text-brown-600 bg-cream-200 px-3 py-1 rounded-full active:scale-95 transition-transform"
          >
            + {t('settings.addTracker')}
          </button>
        </div>
        {customs.length === 0 ? (
          <div className="text-center py-6 text-brown-400 font-rubik text-sm bg-cream-50 rounded-2xl">
            עדיין אין מעקבים מותאמים אישית
          </div>
        ) : (
          <div className="space-y-2">
            {customs.map(tr => (
              <div key={tr.id} className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">{tr.icon}</span>
                <span className="font-rubik font-medium text-brown-800 flex-1">{tr.name}</span>
                <div className="w-4 h-4 rounded-full ml-2" style={{ backgroundColor: tr.color }} />
                <button
                  onClick={() => setDeleteTarget(tr.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-brown-300 hover:text-red-400 transition-colors"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddTrackerSheet
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onAdd={async (data) => { await addTracker(data); setAddSheetOpen(false) }}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        message={t('settings.deleteTrackerConfirm')}
        onConfirm={async () => { await deleteTracker(deleteTarget); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function AddTrackerSheet({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(TRACKER_ICONS[0])
  const [color, setColor] = useState(TRACKER_COLORS[0])
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)

  function addField() {
    setFields(prev => [...prev, { key: `field_${Date.now()}`, type: 'number', label: '' }])
  }

  function updateField(idx, updates) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f))
  }

  function removeField(idx) {
    setFields(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onAdd({ name: name.trim(), icon, color, field_schema: fields })
      setName(''); setIcon(TRACKER_ICONS[0]); setColor(TRACKER_COLORS[0]); setFields([])
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('settings.addTracker')}>
      <div className="space-y-4">
        {/* Name */}
        <div>
          <p className="text-sm font-medium text-brown-600 mb-2">{t('settings.trackerName')}</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('settings.trackerName')}
            className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none"
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
                className={cn('w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all', icon === ic ? 'bg-brown-600 shadow-soft scale-110' : 'bg-cream-200')}
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
                className={cn('w-8 h-8 rounded-full transition-all', color === c ? 'scale-125 ring-2 ring-brown-600 ring-offset-2' : '')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-brown-600">שדות</p>
            <button onClick={addField} className="text-xs font-rubik text-brown-600 bg-cream-200 px-3 py-1 rounded-full">+ הוסף שדה</button>
          </div>
          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div key={field.key} className="bg-cream-200 rounded-2xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => updateField(idx, { label: e.target.value })}
                    placeholder={t('settings.fieldLabel')}
                    className="flex-1 bg-white rounded-xl px-3 py-2 font-rubik text-sm text-brown-800 outline-none"
                  />
                  <button onClick={() => removeField(idx)} className="text-brown-300 hover:text-red-400">×</button>
                </div>
                <select
                  value={field.type}
                  onChange={e => updateField(idx, { type: e.target.value })}
                  className="w-full bg-white rounded-xl px-3 py-2 font-rubik text-sm text-brown-800 outline-none"
                >
                  {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button className="flex-1" onClick={handleSave} disabled={!name.trim() || saving}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
