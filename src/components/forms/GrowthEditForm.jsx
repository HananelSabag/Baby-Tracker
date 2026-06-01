import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '../ui/Button'
import { AlertCircle } from 'lucide-react'

// Plausible clinical ranges (generous to avoid false rejections for premature/large babies)
const RANGES = {
  weight_kg: { min: 0.5,  max: 30,  label: 'משקל',      unit: 'ק"ג',  hint: '0.5–30' },
  height_cm: { min: 30,   max: 120, label: 'גובה',       unit: 'ס"מ',  hint: '30–120' },
  head_cm:   { min: 20,   max: 60,  label: 'היקף ראש',   unit: 'ס"מ',  hint: '20–60'  },
}

function parseField(val, key) {
  if (!val || val.trim() === '') return { value: null, error: null }
  const n = parseFloat(val)
  if (isNaN(n)) return { value: null, error: `${RANGES[key].label}: יש להזין מספר` }
  const { min, max, label, unit, hint } = RANGES[key]
  if (n < min || n > max) return { value: null, error: `${label}: טווח תקין ${hint} ${unit}` }
  return { value: n, error: null }
}

export function GrowthEditForm({ initialData = {}, initialDate, onSave, onCancel, loading }) {
  const [dateVal, setDateVal] = useState(initialDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [weightVal, setWeightVal] = useState(initialData.weight_kg != null ? String(initialData.weight_kg) : '')
  const [heightVal, setHeightVal] = useState(initialData.height_cm != null ? String(initialData.height_cm) : '')
  const [headVal,   setHeadVal]   = useState(initialData.head_cm   != null ? String(initialData.head_cm)   : '')
  const [errors,    setErrors]    = useState([])

  function handleSave() {
    if (!weightVal && !heightVal && !headVal) return

    const w = parseField(weightVal, 'weight_kg')
    const h = parseField(heightVal, 'height_cm')
    const hd = parseField(headVal, 'head_cm')

    const errs = [w.error, h.error, hd.error].filter(Boolean)
    if (errs.length > 0) { setErrors(errs); return }

    const data = {}
    if (w.value  != null) data.weight_kg = w.value
    if (h.value  != null) data.height_cm = h.value
    if (hd.value != null) data.head_cm   = hd.value

    if (Object.keys(data).length === 0) return

    setErrors([])
    const [y, mo, d] = dateVal.split('-').map(Number)
    onSave(data, new Date(y, mo - 1, d, 12, 0, 0))
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-brown-600 mb-2">תאריך המדידה</p>
        <input
          type="date"
          value={dateVal}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={e => setDateVal(e.target.value)}
          className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs font-medium text-brown-600 mb-2">משקל (ק"ג)</p>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="30"
            value={weightVal}
            onChange={e => { setWeightVal(e.target.value); setErrors([]) }}
            placeholder="6.5"
            className="w-full bg-cream-200 rounded-2xl px-2 py-3 font-rubik text-brown-800 outline-none text-center text-base font-bold"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-brown-600 mb-2">גובה (ס"מ)</p>
          <input
            type="number"
            step="0.5"
            min="30"
            max="120"
            value={heightVal}
            onChange={e => { setHeightVal(e.target.value); setErrors([]) }}
            placeholder="65"
            className="w-full bg-cream-200 rounded-2xl px-2 py-3 font-rubik text-brown-800 outline-none text-center text-base font-bold"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-brown-600 mb-2">היקף ראש</p>
          <input
            type="number"
            step="0.1"
            min="20"
            max="60"
            value={headVal}
            onChange={e => { setHeadVal(e.target.value); setErrors([]) }}
            placeholder="40"
            className="w-full bg-cream-200 rounded-2xl px-2 py-3 font-rubik text-brown-800 outline-none text-center text-base font-bold"
          />
        </div>
      </div>

      {errors.length > 0 && (
        <div className="flex flex-col gap-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-rubik text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
              <AlertCircle size={12} className="flex-shrink-0" />
              {err}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-brown-400 font-rubik text-center">ניתן לערוך שדה אחד או יותר</p>
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>ביטול</Button>
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={loading || (!weightVal && !heightVal && !headVal)}
        >
          {loading ? 'שומר...' : 'שמור'}
        </Button>
      </div>
    </div>
  )
}
