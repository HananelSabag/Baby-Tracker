import { useState } from 'react'
import { format } from 'date-fns'
import { t } from '../../lib/strings'
import { FEEDING_PRESETS } from '../../lib/constants'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

export function AddFeedingForm({ onSave, onCancel, loading }) {
  const [amount, setAmount] = useState(null)
  const [custom, setCustom] = useState('')
  const [time, setTime] = useState(format(new Date(), 'HH:mm'))
  const [error, setError] = useState('')

  const finalAmount = amount ?? (custom ? parseInt(custom, 10) : null)

  function handleSave() {
    if (!finalAmount || finalAmount <= 0) {
      setError(t('feeding.amountRequired'))
      return
    }
    const [h, m] = time.split(':').map(Number)
    const occurredAt = new Date()
    occurredAt.setHours(h, m, 0, 0)
    onSave({ amount_ml: finalAmount }, occurredAt)
  }

  return (
    <div className="space-y-4">
      {/* Preset buttons */}
      <div>
        <p className="text-sm font-medium text-brown-600 mb-2">{t('feeding.presets')}</p>
        <div className="grid grid-cols-3 gap-2">
          {FEEDING_PRESETS.map(ml => (
            <button
              key={ml}
              onClick={() => { setAmount(ml); setCustom(''); setError('') }}
              className={cn(
                'py-3 rounded-2xl text-sm font-semibold font-rubik transition-all active:scale-95',
                amount === ml && !custom
                  ? 'bg-tracker-feeding text-white shadow-soft'
                  : 'bg-cream-200 text-brown-700'
              )}
            >
              {ml} {t('feeding.ml')}
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount */}
      <div>
        <p className="text-sm font-medium text-brown-600 mb-2">{t('feeding.custom')}</p>
        <div className="flex items-center gap-2 bg-cream-200 rounded-2xl px-4 py-3">
          <input
            type="number"
            min="1"
            max="500"
            value={custom}
            onChange={e => { setCustom(e.target.value); setAmount(null); setError('') }}
            placeholder={t('feeding.customPlaceholder')}
            className="flex-1 bg-transparent text-brown-800 placeholder-brown-400 font-rubik text-base outline-none"
          />
          <span className="text-brown-500 text-sm font-medium">{t('feeding.ml')}</span>
        </div>
        {error && <p className="text-red-500 text-xs mt-1 font-rubik">{error}</p>}
      </div>

      {/* Time picker */}
      <div>
        <p className="text-sm font-medium text-brown-600 mb-2">{t('feeding.time')}</p>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full bg-cream-200 rounded-2xl px-4 py-3 text-brown-800 font-rubik text-base outline-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>{t('feeding.cancel')}</Button>
        <Button
          className="flex-1"
          style={{ backgroundColor: '#6B9E8C' }}
          onClick={handleSave}
          disabled={loading}
        >
          {t('feeding.save')}
        </Button>
      </div>
    </div>
  )
}
