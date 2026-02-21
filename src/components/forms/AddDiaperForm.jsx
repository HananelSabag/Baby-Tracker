import { useState } from 'react'
import { format } from 'date-fns'
import { t } from '../../lib/strings'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

const DIAPER_TYPES = [
  { key: 'wet', label: t('diaper.wet'), emoji: '💧' },
  { key: 'dirty', label: t('diaper.dirty'), emoji: '💩' },
  { key: 'both', label: t('diaper.both'), emoji: '💧💩' },
]

export function AddDiaperForm({ onSave, onCancel, loading, initialData, initialTime }) {
  const [type, setType] = useState(initialData?.type ?? null)
  const [time, setTime] = useState(initialTime ?? format(new Date(), 'HH:mm'))

  function handleSave() {
    if (!type) return
    const [h, m] = time.split(':').map(Number)
    const occurredAt = new Date()
    occurredAt.setHours(h, m, 0, 0)
    onSave({ type }, occurredAt)
  }

  return (
    <div className="space-y-4">
      {/* Type selection */}
      <div className="grid grid-cols-3 gap-2">
        {DIAPER_TYPES.map(dt => (
          <button
            key={dt.key}
            onClick={() => setType(dt.key)}
            className={cn(
              'flex flex-col items-center gap-1 py-4 rounded-2xl font-rubik transition-all active:scale-95',
              type === dt.key ? 'bg-tracker-diaper text-white shadow-soft' : 'bg-cream-200 text-brown-700'
            )}
          >
            <span className="text-2xl">{dt.emoji}</span>
            <span className="text-xs font-medium">{dt.label}</span>
          </button>
        ))}
      </div>

      {/* Time */}
      <div>
        <p className="text-sm font-medium text-brown-600 mb-2">{t('diaper.time')}</p>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full bg-cream-200 rounded-2xl px-4 py-3 text-brown-800 font-rubik outline-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>{t('diaper.cancel')}</Button>
        <Button
          className="flex-1"
          style={{ backgroundColor: '#9B8EC4' }}
          onClick={handleSave}
          disabled={!type || loading}
        >
          {t('diaper.save')}
        </Button>
      </div>
    </div>
  )
}
