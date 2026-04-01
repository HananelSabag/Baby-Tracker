import { useState } from 'react'
import { format } from 'date-fns'
import { t } from '../../lib/strings'
import { Button } from '../ui/Button'

export function AddCustomEventForm({ tracker, onSave, onCancel, loading, initialData, initialTime }) {
  const [fieldValues, setFieldValues] = useState(initialData ?? {})
  const [time, setTime] = useState(initialTime ?? format(new Date(), 'HH:mm'))

  const schema = tracker.field_schema ?? []

  function setField(key, value) {
    setFieldValues(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    const [h, m] = time.split(':').map(Number)
    const occurredAt = new Date()
    occurredAt.setHours(h, m, 0, 0)
    // Midnight guard: if the chosen time is in the future, the user meant yesterday
    if (occurredAt > new Date()) occurredAt.setDate(occurredAt.getDate() - 1)
    onSave(fieldValues, occurredAt)
  }

  return (
    <div className="space-y-4">
      {schema.map(field => (
        <div key={field.key}>
          <p className="text-sm font-medium text-brown-600 mb-2">{field.label}</p>

          {field.type === 'number' && (
            <input
              type="number"
              value={fieldValues[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              placeholder={field.label}
              className="w-full bg-cream-200 rounded-2xl px-4 py-3 text-brown-800 font-rubik outline-none"
            />
          )}

          {field.type === 'text' && (
            <textarea
              rows={2}
              value={fieldValues[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              placeholder={field.label}
              className="w-full bg-cream-200 rounded-2xl px-4 py-3 text-brown-800 font-rubik outline-none resize-none"
            />
          )}

          {field.type === 'choice' && (
            <div className="flex flex-wrap gap-2">
              {(field.options ?? []).map(opt => (
                <button
                  key={opt}
                  onClick={() => setField(field.key, opt)}
                  className={`px-4 py-2 rounded-2xl text-sm font-rubik font-medium transition-all active:scale-95 ${
                    fieldValues[field.key] === opt ? 'text-white shadow-soft' : 'bg-cream-200 text-brown-700'
                  }`}
                  style={fieldValues[field.key] === opt ? { backgroundColor: tracker.color } : {}}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {field.type === 'boolean' && (
            <div className="flex gap-3">
              {['כן', 'לא'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setField(field.key, opt === 'כן')}
                  className={`flex-1 py-3 rounded-2xl text-sm font-rubik font-medium transition-all active:scale-95 ${
                    fieldValues[field.key] === (opt === 'כן') ? 'text-white' : 'bg-cream-200 text-brown-700'
                  }`}
                  style={fieldValues[field.key] === (opt === 'כן') ? { backgroundColor: tracker.color } : {}}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {schema.length === 0 && (
        <p className="text-brown-400 text-sm text-center py-2">{t('tracker.addEvent')}</p>
      )}

      {/* Time */}
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
        <Button className="flex-1 text-white" style={{ backgroundColor: tracker.color }} onClick={handleSave} disabled={loading}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}
