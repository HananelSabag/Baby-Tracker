import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { he } from 'date-fns/locale'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ageInMonths } from '../../lib/whoGrowthData'

export function GrowthCard({ tracker, familyId, memberId, childId, child }) {
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [weightVal, setWeightVal] = useState('')
  const [heightVal, setHeightVal] = useState('')
  const [dateVal, setDateVal] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  // Most recent measurement (already sorted desc by occurred_at in useEvents)
  const lastEvent = events[0]
  const lastWeight = lastEvent?.data?.weight_kg ? parseFloat(lastEvent.data.weight_kg) : null
  const lastHeight = lastEvent?.data?.height_cm ? parseFloat(lastEvent.data.height_cm) : null

  // Age at last measurement
  const birthDate = child?.birth_date
  let ageLabel = null
  if (birthDate && lastEvent) {
    const months = ageInMonths(birthDate, lastEvent.occurred_at)
    if (months !== null) {
      const m = Math.floor(months)
      const w = Math.round((months - m) * 4.33)
      ageLabel = m === 0 ? `${w} שבועות` : w > 0 ? `${m} חודשים ו-${w} שבועות` : `${m} חודשים`
    }
  }

  async function handleSave() {
    if (!weightVal && !heightVal) return
    setSaving(true)
    try {
      const [y, mo, d] = dateVal.split('-').map(Number)
      const occurred = new Date(y, mo - 1, d, 12, 0, 0)
      const data = {}
      if (weightVal) data.weight_kg = parseFloat(weightVal)
      if (heightVal) data.height_cm = parseFloat(heightVal)
      await addEvent({ trackerId: tracker.id, memberId, childId, data, occurredAt: occurred.toISOString() })
      setWeightVal('')
      setHeightVal('')
      setDateVal(format(new Date(), 'yyyy-MM-dd'))
      setSheetOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const lastDateLabel = lastEvent
    ? format(parseISO(lastEvent.occurred_at), 'd בMMM yyyy', { locale: he })
    : null

  return (
    <>
      <Card>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tracker.icon}</span>
            <div>
              <p className="font-rubik font-semibold text-brown-800">{tracker.name}</p>
              {ageLabel && <p className="font-rubik text-xs text-brown-400">{ageLabel}</p>}
            </div>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-soft active:scale-95 transition-transform"
            style={{ backgroundColor: tracker.color }}
          >+</button>
        </div>

        {/* Last measurement */}
        {loading ? (
          <p className="font-rubik text-brown-400 text-sm">טוען...</p>
        ) : lastWeight || lastHeight ? (
          <div className="flex gap-3">
            {lastWeight && (
              <div className="flex-1 bg-cream-100 rounded-2xl px-3 py-2.5 text-center">
                <p className="font-rubik font-bold text-2xl text-brown-800">{lastWeight}</p>
                <p className="font-rubik text-brown-400 text-xs">ק"ג</p>
              </div>
            )}
            {lastHeight && (
              <div className="flex-1 bg-cream-100 rounded-2xl px-3 py-2.5 text-center">
                <p className="font-rubik font-bold text-2xl text-brown-800">{lastHeight}</p>
                <p className="font-rubik text-brown-400 text-xs">ס"מ</p>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full py-4 rounded-2xl border-2 border-dashed text-brown-400 font-rubik text-sm active:scale-95 transition-transform"
            style={{ borderColor: `${tracker.color}60` }}
          >
            הוסף מדידה ראשונה
          </button>
        )}

        {lastDateLabel && (
          <p className="font-rubik text-brown-400 text-xs mt-2 text-center">{lastDateLabel}</p>
        )}
      </Card>

      {/* Add measurement sheet */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="הוסף מדידה">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">משקל (ק"ג)</p>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={weightVal}
                onChange={e => setWeightVal(e.target.value)}
                placeholder="6.5"
                className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-center text-lg font-bold"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-brown-600 mb-2">גובה (ס"מ)</p>
              <input
                type="number"
                step="0.5"
                min="0"
                max="120"
                value={heightVal}
                onChange={e => setHeightVal(e.target.value)}
                placeholder="65"
                className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-center text-lg font-bold"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setSheetOpen(false)}>ביטול</Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || (!weightVal && !heightVal)}
              style={{ backgroundColor: tracker.color }}
            >
              {saving ? 'שומר...' : 'שמור'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
