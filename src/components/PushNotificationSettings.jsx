import { useState } from 'react'
import { usePushNotifications, DEFAULT_PREFS } from '../hooks/usePushNotifications'
import { useTrackers } from '../hooks/useTrackers'
import { cn } from '../lib/utils'

const HOUR_OPTIONS_DIAPER = [3, 4, 5]

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

export function PushNotificationSettings({ familyId, memberId }) {
  const {
    supported,
    permission,
    isSubscribed,
    prefs,
    loading,
    subscribe,
    unsubscribe,
    updatePrefs,
  } = usePushNotifications({ familyId, memberId })

  const { trackers } = useTrackers(familyId)

  // Dose-capable trackers: vitamin_d and custom dose
  const doseTrackers = trackers.filter(
    t => (t.tracker_type === 'vitamin_d' || t.tracker_type === 'dose') && t.is_active !== false
  )

  const [status, setStatus] = useState(null) // 'denied' | 'success' | 'error'

  async function handleEnable() {
    const result = await subscribe(DEFAULT_PREFS)
    if (result === 'denied')      setStatus('denied')
    else if (result === 'granted') setStatus('success')
    else                           setStatus('error')
  }

  function isTrackerEnabled(trackerId) {
    // Missing key = enabled by default
    return prefs.dose_trackers?.[trackerId] !== false
  }

  async function toggleTracker(trackerId, enabled) {
    const next = {
      ...prefs,
      dose_trackers: { ...prefs.dose_trackers, [trackerId]: enabled },
    }
    await updatePrefs(next)
  }

  async function handleDiaperChange(key, value) {
    await updatePrefs({ ...prefs, [key]: value })
  }

  // Not supported in this browser
  if (!supported) {
    return (
      <div className="bg-white rounded-2xl shadow-soft px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🔕</span>
          <div>
            <p className="font-rubik font-medium text-brown-700 text-sm">התראות Push</p>
            <p className="font-rubik text-brown-400 text-xs mt-0.5">
              הדפדפן שלך לא תומך ב-Push Notifications. פתח כ-PWA מהמסך הראשי של הטלפון.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft px-4 py-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-rubik font-semibold text-brown-800 text-sm">🔔 התראות Push</p>
          <p className="font-rubik text-brown-400 text-xs mt-0.5">
            {isSubscribed ? 'פועל — גם כשהאפליקציה סגורה' : 'התראות גם כשהאפליקציה סגורה'}
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

      {/* Status messages */}
      {status === 'denied' && (
        <p className="text-xs font-rubik text-red-500 bg-red-50 rounded-xl px-3 py-2">
          🚫 הרשאה נדחתה — לשנות בהגדרות הדפדפן
        </p>
      )}
      {status === 'success' && (
        <p className="text-xs font-rubik text-green-600 bg-green-50 rounded-xl px-3 py-2">
          ✅ הופעל! תקבל התראות גם כשהאפליקציה סגורה
        </p>
      )}
      {permission === 'denied' && !isSubscribed && (
        <p className="text-xs font-rubik text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
          ⚠️ הרשאה חסומה בדפדפן — לאפשר בהגדרות
        </p>
      )}

      {/* Dose trackers section */}
      {doseTrackers.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-cream-200">
          <p className="font-rubik text-xs font-semibold text-brown-400 uppercase tracking-wide">מינונים ותרופות</p>
          {doseTrackers.map(tracker => {
            const config = tracker.config ?? {}
            const times = config.notification_times ?? []
            const labels = config.dose_labels ?? []
            const doseCount = config.daily_doses ?? 1
            const enabled = isTrackerEnabled(tracker.id)

            return (
              <div key={tracker.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{tracker.icon}</span>
                    <p className="font-rubik text-sm text-brown-700">{tracker.name}</p>
                  </div>
                  <Toggle
                    on={enabled}
                    onChange={v => toggleTracker(tracker.id, v)}
                    disabled={!isSubscribed}
                  />
                </div>
                {/* Show dose times if configured */}
                {enabled && times.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pr-7">
                    {Array.from({ length: doseCount }, (_, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 bg-cream-100 rounded-full px-2 py-0.5 font-rubik text-xs text-brown-500"
                      >
                        {labels[i] ?? `מינון ${i + 1}`}
                        {times[i] && <span className="text-brown-400">{times[i]}</span>}
                      </span>
                    ))}
                    <span className="font-rubik text-[10px] text-brown-300 self-center">
                      לשינוי שעות — ⚙️ כוונן מעקב
                    </span>
                  </div>
                )}
                {enabled && times.length === 0 && (
                  <p className="font-rubik text-xs text-amber-600 bg-amber-50 rounded-xl px-2 py-1 pr-7">
                    ⚙️ הגדר שעות התראה בכוונן המעקב
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Diaper section */}
      <div className="space-y-2 pt-1 border-t border-cream-200">
        <p className="font-rubik text-xs font-semibold text-brown-400 uppercase tracking-wide">חיתול</p>
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">👶</span>
              <p className="font-rubik text-sm text-brown-700">התראה אחרי</p>
            </div>
            <Toggle
              on={prefs.diaper}
              onChange={v => handleDiaperChange('diaper', v)}
              disabled={!isSubscribed}
            />
          </div>
          {prefs.diaper && (
            <div className="flex gap-1.5 mt-1.5">
              {HOUR_OPTIONS_DIAPER.map(h => (
                <button
                  key={h}
                  onClick={() => handleDiaperChange('diaper_hours', h)}
                  className={cn(
                    'flex-1 py-1 rounded-xl text-xs font-rubik font-medium transition-all',
                    prefs.diaper_hours === h ? 'text-white shadow-soft' : 'bg-cream-100 text-brown-500'
                  )}
                  style={prefs.diaper_hours === h ? { backgroundColor: '#9B8EC4' } : {}}
                >
                  {h}ש'
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isSubscribed && (
        <p className="text-xs font-rubik text-brown-300 text-center pt-1">
          לחץ "הפעל" לשמור את ההגדרות ולהתחיל לקבל התראות
        </p>
      )}
    </div>
  )
}
