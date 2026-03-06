import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { usePushNotifications, DEFAULT_PREFS } from '../hooks/usePushNotifications'
import { cn } from '../lib/utils'

const DOSE_EMOJIS = ['☀️', '🌙', '🌅', '🌤', '⭐', '💫']
const DIAPER_HOUR_OPTIONS = [3, 4, 5]

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-40"
      style={{ backgroundColor: on ? '#22C55E' : '#D6C4B0' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(26px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

export function NotificationsPage() {
  const { identity } = useApp()
  const navigate = useNavigate()
  const { trackers, updateTracker } = useTrackers(identity.familyId)

  const {
    supported,
    permission,
    isSubscribed,
    prefs,
    loading,
    subscribe,
    unsubscribe,
    updatePrefs,
  } = usePushNotifications({ familyId: identity.familyId, memberId: identity.memberId })

  // Only active, non-deleted dose trackers
  const doseTrackers = trackers.filter(
    t => (t.tracker_type === 'vitamin_d' || t.tracker_type === 'dose')
      && t.is_active !== false
      && !t.is_deleted
  )

  // Local edit state: { [trackerId]: string[] }
  const [localTimes, setLocalTimes] = useState({})
  const [dirty, setDirty] = useState({})
  const [saving, setSaving] = useState({})
  const [subscribeStatus, setSubscribeStatus] = useState(null)

  function getDisplayTimes(tracker) {
    if (localTimes[tracker.id]) return localTimes[tracker.id]
    const config = tracker.config ?? {}
    const count = config.daily_doses ?? 1
    const stored = config.notification_times ?? []
    // Pad to doseCount with empty strings
    return Array.from({ length: count }, (_, i) => stored[i] ?? '')
  }

  function handleTimeChange(trackerId, doseIndex, value) {
    setLocalTimes(prev => {
      const tracker = doseTrackers.find(t => t.id === trackerId)
      const current = prev[trackerId] ?? getDisplayTimes(tracker)
      const next = [...current]
      next[doseIndex] = value
      return { ...prev, [trackerId]: next }
    })
    setDirty(prev => ({ ...prev, [trackerId]: true }))
  }

  async function saveTrackerTimes(tracker) {
    setSaving(prev => ({ ...prev, [tracker.id]: true }))
    const times = localTimes[tracker.id] ?? []
    await updateTracker(tracker.id, {
      config: { ...tracker.config, notification_times: times },
    })
    setSaving(prev => ({ ...prev, [tracker.id]: false }))
    setDirty(prev => ({ ...prev, [tracker.id]: false }))
  }

  function isTrackerEnabled(trackerId) {
    return prefs.dose_trackers?.[trackerId] !== false
  }

  async function toggleTracker(trackerId, enabled) {
    await updatePrefs({
      ...prefs,
      dose_trackers: { ...prefs.dose_trackers, [trackerId]: enabled },
    })
  }

  async function handleEnable() {
    const result = await subscribe(DEFAULT_PREFS)
    setSubscribeStatus(result === 'granted' ? 'success' : result === 'denied' ? 'denied' : 'error')
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-4" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => navigate(-1)} className="text-brown-400 text-xl active:opacity-60">←</button>
        <div>
          <h1 className="font-rubik font-bold text-2xl text-brown-800">מרכז התראות</h1>
          <p className="font-rubik text-brown-400 text-sm">הגדר מתי לקבל תזכורות</p>
        </div>
      </div>

      {/* Push status card */}
      {!supported ? (
        <div className="bg-white rounded-2xl shadow-soft px-4 py-4 flex items-start gap-3">
          <span className="text-2xl">🔕</span>
          <div>
            <p className="font-rubik font-semibold text-brown-800 text-sm">התראות לא נתמכות</p>
            <p className="font-rubik text-brown-400 text-xs mt-0.5 leading-relaxed">
              פתח את האפליקציה כ-PWA מהמסך הראשי של הטלפון כדי להפעיל התראות.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-soft px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-rubik font-semibold text-brown-800 text-sm">
                🔔 התראות Push
              </p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">
                {isSubscribed ? 'פועל — גם כשהאפליקציה סגורה' : 'כבוי — לחץ הפעל כדי להתחיל'}
              </p>
            </div>
            {isSubscribed ? (
              <button
                onClick={unsubscribe}
                disabled={loading}
                className="text-xs font-rubik text-red-400 bg-red-50 px-3 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-40"
              >
                {loading ? '...' : 'כבה'}
              </button>
            ) : (
              <button
                onClick={handleEnable}
                disabled={loading || permission === 'denied'}
                className="text-xs font-rubik text-white bg-green-500 px-3 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-40"
              >
                {loading ? '...' : 'הפעל'}
              </button>
            )}
          </div>
          {subscribeStatus === 'success' && (
            <p className="mt-2 text-xs font-rubik text-green-600 bg-green-50 rounded-xl px-3 py-1.5">
              ✅ הופעל בהצלחה!
            </p>
          )}
          {subscribeStatus === 'denied' && (
            <p className="mt-2 text-xs font-rubik text-red-500 bg-red-50 rounded-xl px-3 py-1.5">
              🚫 הרשאה נדחתה — לשנות בהגדרות הדפדפן
            </p>
          )}
          {permission === 'denied' && !isSubscribed && (
            <p className="mt-2 text-xs font-rubik text-amber-700 bg-amber-50 rounded-xl px-3 py-1.5">
              ⚠️ הרשאה חסומה בדפדפן — לאפשר בהגדרות
            </p>
          )}
        </div>
      )}

      {/* Dose trackers */}
      {doseTrackers.length > 0 && (
        <div className="space-y-3">
          <p className="font-rubik font-semibold text-brown-400 text-xs uppercase tracking-wider px-1">
            מינונים ותרופות
          </p>

          {doseTrackers.map(tracker => {
            const config = tracker.config ?? {}
            const doseCount = config.daily_doses ?? 1
            const doseLabels = config.dose_labels ?? []
            const displayTimes = getDisplayTimes(tracker)
            const enabled = isTrackerEnabled(tracker.id)
            const isDirty = dirty[tracker.id]
            const isSaving = saving[tracker.id]

            return (
              <div
                key={tracker.id}
                className="bg-white rounded-2xl shadow-soft overflow-hidden"
              >
                {/* Color strip */}
                <div className="h-1 w-full" style={{ backgroundColor: tracker.color }} />

                <div className="px-4 py-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{tracker.icon}</span>
                      <div>
                        <p className="font-rubik font-semibold text-brown-800 text-sm">{tracker.name}</p>
                        <p className="font-rubik text-brown-400 text-xs">
                          {doseCount === 1 ? 'מינון אחד ביום' : `${doseCount} מינונים ביום`}
                        </p>
                      </div>
                    </div>
                    <Toggle
                      on={enabled}
                      onChange={v => toggleTracker(tracker.id, v)}
                      disabled={!isSubscribed}
                    />
                  </div>

                  {/* Time pickers per dose */}
                  {enabled && (
                    <div className="space-y-2 border-t border-cream-100 pt-3">
                      <p className="font-rubik text-xs text-brown-400 mb-2">
                        שעת תזכורת לכל מינון (אם לא ניתן עד השעה הזו):
                      </p>
                      {Array.from({ length: doseCount }, (_, i) => {
                        const label = doseLabels[i] || `מינון ${i + 1}`
                        const timeVal = displayTimes[i] ?? ''
                        return (
                          <div key={i} className="flex items-center gap-3 bg-cream-100 rounded-2xl px-3 py-2.5">
                            <span className="text-lg flex-shrink-0">{DOSE_EMOJIS[i]}</span>
                            <p className="font-rubik text-sm text-brown-700 flex-1">{label}</p>
                            <input
                              type="time"
                              value={timeVal}
                              onChange={e => handleTimeChange(tracker.id, i, e.target.value)}
                              className="bg-white rounded-xl px-2 py-1 font-rubik text-brown-700 text-sm outline-none flex-shrink-0 w-[90px] border border-cream-200"
                            />
                          </div>
                        )
                      })}

                      {isDirty && (
                        <button
                          onClick={() => saveTrackerTimes(tracker)}
                          disabled={isSaving}
                          className="w-full mt-1 py-2 rounded-xl font-rubik font-semibold text-sm text-white active:scale-95 transition-all disabled:opacity-50"
                          style={{ backgroundColor: tracker.color }}
                        >
                          {isSaving ? '...' : '💾 שמור שעות'}
                        </button>
                      )}

                      {!isDirty && displayTimes.every(t => !t) && (
                        <p className="text-xs font-rubik text-amber-600 bg-amber-50 rounded-xl px-3 py-1.5 text-center">
                          הגדר שעה לכל מינון כדי לקבל תזכורות
                        </p>
                      )}
                    </div>
                  )}

                  {!isSubscribed && (
                    <p className="text-xs font-rubik text-brown-300 mt-2 text-center">
                      הפעל התראות Push כדי להגדיר שעות
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Diaper section */}
      <div className="space-y-3">
        <p className="font-rubik font-semibold text-brown-400 text-xs uppercase tracking-wider px-1">
          חיתול
        </p>
        <div className="bg-white rounded-2xl shadow-soft px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👶</span>
              <div>
                <p className="font-rubik font-semibold text-brown-800 text-sm">תזכורת חיתול</p>
                <p className="font-rubik text-brown-400 text-xs">
                  התראה אם לא הוחלף תוך כמה שעות
                </p>
              </div>
            </div>
            <Toggle
              on={prefs.diaper}
              onChange={v => updatePrefs({ ...prefs, diaper: v })}
              disabled={!isSubscribed}
            />
          </div>

          {prefs.diaper && (
            <div className="mt-3 border-t border-cream-100 pt-3">
              <p className="font-rubik text-xs text-brown-400 mb-2">שלח תזכורת אחרי:</p>
              <div className="flex gap-2">
                {DIAPER_HOUR_OPTIONS.map(h => (
                  <button
                    key={h}
                    onClick={() => updatePrefs({ ...prefs, diaper_hours: h })}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-sm font-rubik font-semibold transition-all active:scale-95',
                      prefs.diaper_hours === h ? 'text-white shadow-soft' : 'bg-cream-100 text-brown-500'
                    )}
                    style={prefs.diaper_hours === h ? { backgroundColor: '#9B8EC4' } : {}}
                  >
                    {h} שעות
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isSubscribed && (
            <p className="text-xs font-rubik text-brown-300 mt-2 text-center">
              הפעל התראות Push כדי להגדיר
            </p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {doseTrackers.length === 0 && (
        <div className="text-center py-8 text-brown-400">
          <div className="text-4xl mb-2">💊</div>
          <p className="font-rubik text-sm">אין מעקבי מינון פעילים</p>
          <p className="font-rubik text-xs mt-1">הוסף מעקב מינון בדף המעקבים</p>
        </div>
      )}
    </div>
  )
}
