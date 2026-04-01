import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { he } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useEvents } from '../../hooks/useEvents'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ageInMonths, getWeightPercentileLabel, getHeightPercentileLabel } from '../../lib/whoGrowthData'

export function GrowthCard({ tracker, familyId, memberId, childId, child }) {
  const navigate = useNavigate()
  const { events, loading, addEvent } = useEvents(familyId, { trackerId: tracker.id, childId })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [weightVal, setWeightVal] = useState('')
  const [heightVal, setHeightVal] = useState('')
  const [headVal, setHeadVal] = useState('')
  const [dateVal, setDateVal] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  // Most recent measurement (already sorted desc by occurred_at in useEvents)
  const lastEvent = events[0]
  const lastWeight = lastEvent?.data?.weight_kg ? parseFloat(lastEvent.data.weight_kg) : null
  const lastHeight = lastEvent?.data?.height_cm ? parseFloat(lastEvent.data.height_cm) : null
  const lastHead   = lastEvent?.data?.head_cm   ? parseFloat(lastEvent.data.head_cm)   : null

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

  // WHO percentile for badge
  let percentileResult = null
  if (birthDate && lastEvent) {
    const months = ageInMonths(birthDate, lastEvent.occurred_at)
    if (months !== null) {
      percentileResult = lastWeight != null
        ? getWeightPercentileLabel(lastWeight, months, child?.gender ?? 'male')
        : lastHeight != null
          ? getHeightPercentileLabel(lastHeight, months, child?.gender ?? 'male')
          : null
    }
  }

  let percentileBadgeColor = '#5BAD6F'
  if (percentileResult) {
    const p = percentileResult.percentile
    if (p < 3 || p > 97) percentileBadgeColor = '#E05A4B'
    else if (p < 15 || p > 85) percentileBadgeColor = '#E8B84B'
  }

  async function handleSave() {
    if (!weightVal && !heightVal && !headVal) return
    setSaving(true)
    try {
      const [y, mo, d] = dateVal.split('-').map(Number)
      const occurred = new Date(y, mo - 1, d, 12, 0, 0)
      const data = {}
      if (weightVal) data.weight_kg = parseFloat(weightVal)
      if (heightVal) data.height_cm = parseFloat(heightVal)
      if (headVal)   data.head_cm   = parseFloat(headVal)
      await addEvent({ trackerId: tracker.id, memberId, childId, data, occurredAt: occurred.toISOString() })
      setWeightVal('')
      setHeightVal('')
      setHeadVal('')
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
          <div className="flex items-center gap-2">
            {/* Reports link */}
            <button
              onClick={() => navigate('/reports')}
              className="px-2.5 py-1 rounded-full font-rubik text-xs font-semibold active:scale-95 transition-transform"
              style={{ backgroundColor: `${tracker.color}18`, color: tracker.color }}
            >
              גרף ›
            </button>
            <button
              onClick={() => setSheetOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-soft active:scale-95 transition-transform"
              style={{ backgroundColor: tracker.color }}
            >+</button>
          </div>
        </div>

        {/* Last measurement */}
        {loading ? (
          <p className="font-rubik text-brown-400 text-sm">טוען...</p>
        ) : lastWeight || lastHeight || lastHead ? (
          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-3 flex-wrap"
            style={{ backgroundColor: `${tracker.color}12` }}
          >
            {lastWeight && (
              <span className="font-rubik text-sm">
                <span className="font-bold text-brown-800">{lastWeight}</span>
                <span className="text-brown-400 text-xs"> ק"ג</span>
              </span>
            )}
            {lastHeight && (
              <span className="font-rubik text-sm">
                <span className="font-bold text-brown-800">{lastHeight}</span>
                <span className="text-brown-400 text-xs"> ס"מ</span>
              </span>
            )}
            {lastHead && (
              <span className="font-rubik text-sm">
                <span className="font-bold text-brown-800">{lastHead}</span>
                <span className="text-brown-400 text-xs"> ס"מ ראש</span>
              </span>
            )}
            {/* WHO percentile badge */}
            {percentileResult && (
              <span
                className="font-rubik text-xs font-bold px-2 py-0.5 rounded-full text-white mr-auto"
                style={{ backgroundColor: percentileBadgeColor }}
              >
                P{percentileResult.percentile}
              </span>
            )}
            {lastDateLabel && !percentileResult && (
              <span className="font-rubik text-brown-400 text-xs mr-auto">{lastDateLabel}</span>
            )}
            {lastDateLabel && percentileResult && (
              <span className="font-rubik text-brown-400 text-xs">{lastDateLabel}</span>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full py-3 rounded-2xl border-2 border-dashed text-brown-400 font-rubik text-sm active:scale-95 transition-transform"
            style={{ borderColor: `${tracker.color}60` }}
          >
            הוסף מדידה ראשונה
          </button>
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
          <p className="text-xs text-brown-400 font-rubik text-center">כל השדות אופציונליים — הכנס מה שרוצים</p>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setSheetOpen(false)}>ביטול</Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || (!weightVal && !heightVal && !headVal)}
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
