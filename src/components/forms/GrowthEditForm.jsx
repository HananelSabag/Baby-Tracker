import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '../ui/Button'

export function GrowthEditForm({ initialData = {}, initialDate, onSave, onCancel, loading }) {
  const [dateVal, setDateVal] = useState(initialDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [weightVal, setWeightVal] = useState(initialData.weight_kg != null ? String(initialData.weight_kg) : '')
  const [heightVal, setHeightVal] = useState(initialData.height_cm != null ? String(initialData.height_cm) : '')
  const [headVal,   setHeadVal]   = useState(initialData.head_cm   != null ? String(initialData.head_cm)   : '')

  function handleSave() {
    if (!weightVal && !heightVal && !headVal) return
    const data = {}
    if (weightVal) data.weight_kg = parseFloat(weightVal)
    if (heightVal) data.height_cm = parseFloat(heightVal)
    if (headVal)   data.head_cm   = parseFloat(headVal)
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
            min="0"
            max="30"
            value={weightVal}
            onChange={e => setWeightVal(e.target.value)}
            placeholder="6.5"
            className="w-full bg-cream-200 rounded-2xl px-2 py-3 font-rubik text-brown-800 outline-none text-center text-base font-bold"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-brown-600 mb-2">גובה (ס"מ)</p>
          <input
            type="number"
            step="0.5"
            min="0"
            max="120"
            value={heightVal}
            onChange={e => setHeightVal(e.target.value)}
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
            onChange={e => setHeadVal(e.target.value)}
            placeholder="40"
            className="w-full bg-cream-200 rounded-2xl px-2 py-3 font-rubik text-brown-800 outline-none text-center text-base font-bold"
          />
        </div>
      </div>
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
