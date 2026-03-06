import { useState } from 'react'
import { usePushNotifications, DEFAULT_PREFS } from '../hooks/usePushNotifications'
import { cn } from '../lib/utils'

const HOUR_OPTIONS_FEEDING = [2, 3, 4]
const HOUR_OPTIONS_DIAPER  = [3, 4, 5]

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

function HourPicker({ value, options, onChange, color }) {
  return (
    <div className="flex gap-1.5 mt-1.5">
      {options.map(h => (
        <button
          key={h}
          onClick={() => onChange(h)}
          className={cn(
            'flex-1 py-1 rounded-xl text-xs font-rubik font-medium transition-all',
            value === h ? 'text-white shadow-soft' : 'bg-cream-100 text-brown-500'
          )}
          style={value === h ? { backgroundColor: color } : {}}
        >
          {h}ש'
        </button>
      ))}
    </div>
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

  const [localPrefs, setLocalPrefs] = useState(prefs)
  const [status, setStatus] = useState(null) // 'denied' | 'success' | 'error'

  async function handleEnable() {
    const result = await subscribe(localPrefs)
    if (result === 'denied')      setStatus('denied')
    else if (result === 'granted') setStatus('success')
    else                           setStatus('error')
  }

  async function handlePrefChange(key, value) {
    const next = { ...localPrefs, [key]: value }
    setLocalPrefs(next)
    if (isSubscribed) await updatePrefs(next)
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
    <div className="bg-white rounded-2xl shadow-soft px-4 py-4 space-y-3">
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

      {/* Prefs grid — shown always so user can configure before enabling */}
      <div className="space-y-3 pt-1 border-t border-cream-200">

        {/* Feeding alert */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🍼</span>
              <p className="font-rubik text-sm text-brown-700">האכלה — התראה אחרי</p>
            </div>
            <Toggle
              on={localPrefs.feeding}
              onChange={v => handlePrefChange('feeding', v)}
              disabled={!isSubscribed && !loading}
            />
          </div>
          {localPrefs.feeding && (
            <HourPicker
              value={localPrefs.feeding_hours}
              options={HOUR_OPTIONS_FEEDING}
              onChange={v => handlePrefChange('feeding_hours', v)}
              color="#6B9E8C"
            />
          )}
        </div>

        {/* Vitamin D alert */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">☀️</span>
            <div>
              <p className="font-rubik text-sm text-brown-700">ויטמין D</p>
              <p className="font-rubik text-brown-400 text-xs">10:00 בוקר + 20:00 ערב</p>
            </div>
          </div>
          <Toggle
            on={localPrefs.vitaminD}
            onChange={v => handlePrefChange('vitaminD', v)}
            disabled={!isSubscribed && !loading}
          />
        </div>

        {/* Diaper alert */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">👶</span>
              <p className="font-rubik text-sm text-brown-700">חיתול — התראה אחרי</p>
            </div>
            <Toggle
              on={localPrefs.diaper}
              onChange={v => handlePrefChange('diaper', v)}
              disabled={!isSubscribed && !loading}
            />
          </div>
          {localPrefs.diaper && (
            <HourPicker
              value={localPrefs.diaper_hours}
              options={HOUR_OPTIONS_DIAPER}
              onChange={v => handlePrefChange('diaper_hours', v)}
              color="#9B8EC4"
            />
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
