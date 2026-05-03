import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Bell, BellOff, Baby, Pill, Clock,
  Save, Loader2, CircleCheck, CircleX, TriangleAlert,
} from 'lucide-react'
import { goBack } from '../lib/utils'
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
      aria-checked={on}
      role="switch"
      className="relative w-13 h-7 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      style={{
        backgroundColor: on ? '#22C55E' : '#D6C4B0',
        boxShadow: on
          ? '0 2px 8px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 2px 6px rgba(61,43,31,0.12), inset 0 1px 0 rgba(255,255,255,0.3)',
        width: '52px',
        height: '28px',
      }}
    >
      <span
        className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200"
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
    <div className="px-4 pt-8 pb-10 space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => goBack(navigate, '/')}
          className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brown-600 cursor-pointer active:scale-95 transition-transform flex-shrink-0 border border-cream-200"
          style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' }}
          aria-label="חזור"
        >
          <ChevronRight size={20} />
        </button>
        <div>
          <h1 className="font-rubik font-bold text-3xl text-brown-800 leading-tight">מרכז התראות</h1>
          <p className="font-rubik text-brown-400 text-sm mt-0.5">הגדר מתי לקבל תזכורות</p>
        </div>
      </div>

      {/* Push status card */}
      {!supported ? (
        <div
          className="bg-white rounded-3xl px-4 py-4 flex items-start gap-3 border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          <div className="w-10 h-10 rounded-2xl bg-cream-100 flex items-center justify-center flex-shrink-0 border border-cream-200">
            <BellOff size={20} className="text-brown-400" />
          </div>
          <div className="flex-1">
            <p className="font-rubik font-bold text-brown-800 text-sm">התראות לא נתמכות</p>
            <p className="font-rubik text-brown-400 text-xs mt-0.5 leading-relaxed">
              פתח את האפליקציה כ-PWA מהמסך הראשי של הטלפון כדי להפעיל התראות.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="bg-white rounded-3xl px-4 py-4 border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border"
              style={isSubscribed
                ? { background: '#DCFCE7', borderColor: '#BBF7D0', boxShadow: '0 2px 6px rgba(34,197,94,0.12)' }
                : { background: '#FFF8F0', borderColor: '#E8C9A8', boxShadow: '0 2px 6px rgba(61,43,31,0.08)' }
              }
            >
              <Bell size={20} className={isSubscribed ? 'text-green-600' : 'text-brown-400'} />
            </div>
            <div className="flex-1">
              <p className="font-rubik font-bold text-brown-800 text-sm">התראות Push</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">
                {isSubscribed ? 'פועל — גם כשהאפליקציה סגורה' : 'כבוי — לחץ הפעל כדי להתחיל'}
              </p>
            </div>
            {isSubscribed ? (
              <button
                onClick={unsubscribe}
                disabled={loading}
                className="text-xs font-rubik font-bold text-red-500 bg-red-50 px-3 py-2 rounded-xl cursor-pointer active:scale-95 transition-transform disabled:opacity-40 border border-red-100 min-h-[36px]"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'כבה'}
              </button>
            ) : (
              <button
                onClick={handleEnable}
                disabled={loading || permission === 'denied'}
                className="text-xs font-rubik font-bold text-white bg-green-500 px-3 py-2 rounded-xl cursor-pointer active:scale-95 transition-transform disabled:opacity-40 border border-green-600/20 min-h-[36px]"
                style={{ boxShadow: '0 3px 10px rgba(34,197,94,0.30)' }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'הפעל'}
              </button>
            )}
          </div>

          {subscribeStatus === 'success' && (
            <div className="mt-3 flex items-center gap-2 text-xs font-rubik text-green-700 bg-green-50 rounded-2xl px-3 py-2.5 border border-green-100">
              <CircleCheck size={14} className="flex-shrink-0" />
              הופעל בהצלחה!
            </div>
          )}
          {subscribeStatus === 'denied' && (
            <div className="mt-3 flex items-center gap-2 text-xs font-rubik text-red-600 bg-red-50 rounded-2xl px-3 py-2.5 border border-red-100">
              <CircleX size={14} className="flex-shrink-0" />
              הרשאה נדחתה — לשנות בהגדרות הדפדפן
            </div>
          )}
          {permission === 'denied' && !isSubscribed && (
            <div className="mt-3 flex items-center gap-2 text-xs font-rubik text-amber-700 bg-amber-50 rounded-2xl px-3 py-2.5 border border-amber-100">
              <TriangleAlert size={14} className="flex-shrink-0" />
              הרשאה חסומה בדפדפן — לאפשר בהגדרות
            </div>
          )}
        </div>
      )}

      {/* Dose trackers */}
      {doseTrackers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Pill size={13} className="text-brown-400" />
            <p className="font-rubik font-bold text-brown-400 text-xs uppercase tracking-widest">
              מינונים ותרופות
            </p>
          </div>

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
                className="bg-white rounded-3xl overflow-hidden border border-cream-200"
                style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
              >
                {/* Color strip */}
                <div className="h-1.5 w-full" style={{ backgroundColor: tracker.color }} />

                <div className="px-4 py-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl border border-cream-200"
                        style={{ backgroundColor: `${tracker.color}18` }}
                      >
                        {tracker.icon}
                      </div>
                      <div>
                        <p className="font-rubik font-bold text-brown-800 text-sm">{tracker.name}</p>
                        <p className="font-rubik text-brown-400 text-xs mt-0.5">
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
                      <p className="font-rubik text-xs font-semibold text-brown-400 mb-2">
                        שעת תזכורת לכל מינון (אם לא ניתן עד השעה הזו):
                      </p>
                      {Array.from({ length: doseCount }, (_, i) => {
                        const label = doseLabels[i] || `מינון ${i + 1}`
                        const timeVal = displayTimes[i] ?? ''
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 bg-cream-50 rounded-2xl px-3 py-3 border border-cream-200"
                          >
                            <span className="text-lg flex-shrink-0">{DOSE_EMOJIS[i]}</span>
                            <p className="font-rubik text-sm font-medium text-brown-700 flex-1">{label}</p>
                            <div className="flex items-center gap-1.5 bg-white rounded-xl px-2 py-1.5 border border-cream-200 flex-shrink-0">
                              <Clock size={13} className="text-brown-400" />
                              <input
                                type="time"
                                value={timeVal}
                                onChange={e => handleTimeChange(tracker.id, i, e.target.value)}
                                className="font-rubik text-brown-700 text-sm outline-none w-[76px] bg-transparent"
                              />
                            </div>
                          </div>
                        )
                      })}

                      {isDirty && (
                        <button
                          onClick={() => saveTrackerTimes(tracker)}
                          disabled={isSaving}
                          className="w-full mt-1 py-2.5 rounded-2xl font-rubik font-bold text-sm text-white cursor-pointer active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-white/20 min-h-[44px]"
                          style={{ backgroundColor: tracker.color, boxShadow: `0 4px 12px ${tracker.color}40` }}
                        >
                          {isSaving
                            ? <Loader2 size={15} className="animate-spin" />
                            : <><Save size={14} /> שמור שעות</>
                          }
                        </button>
                      )}

                      {!isDirty && displayTimes.every(t => !t) && (
                        <div className="flex items-center justify-center gap-2 text-xs font-rubik text-amber-700 bg-amber-50 rounded-2xl px-3 py-2.5 border border-amber-100">
                          <TriangleAlert size={13} />
                          הגדר שעה לכל מינון כדי לקבל תזכורות
                        </div>
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
        <div className="flex items-center gap-2 px-1">
          <Baby size={13} className="text-brown-400" />
          <p className="font-rubik font-bold text-brown-400 text-xs uppercase tracking-widest">חיתול</p>
        </div>
        <div
          className="bg-white rounded-3xl px-4 py-4 border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0 border border-purple-100"
              style={{ boxShadow: '0 2px 6px rgba(155,142,196,0.15)' }}
            >
              <Baby size={20} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="font-rubik font-bold text-brown-800 text-sm">תזכורת חיתול</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">התראה אם לא הוחלף תוך כמה שעות</p>
            </div>
            <Toggle
              on={prefs.diaper}
              onChange={v => updatePrefs({ ...prefs, diaper: v })}
              disabled={!isSubscribed}
            />
          </div>

          {prefs.diaper && (
            <div className="mt-4 border-t border-cream-100 pt-4">
              <p className="font-rubik text-xs font-semibold text-brown-400 mb-3">שלח תזכורת אחרי:</p>
              <div className="flex gap-2">
                {DIAPER_HOUR_OPTIONS.map(h => (
                  <button
                    key={h}
                    onClick={() => updatePrefs({ ...prefs, diaper_hours: h })}
                    className={cn(
                      'flex-1 py-2.5 rounded-2xl text-sm font-rubik font-bold transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px] border',
                      prefs.diaper_hours === h
                        ? 'text-white border-purple-600/20'
                        : 'bg-cream-100 text-brown-500 border-cream-200'
                    )}
                    style={prefs.diaper_hours === h
                      ? { backgroundColor: '#9B8EC4', boxShadow: '0 4px 12px rgba(155,142,196,0.30), inset 0 1px 0 rgba(255,255,255,0.18)' }
                      : {}
                    }
                  >
                    {h} שעות
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isSubscribed && (
            <p className="text-xs font-rubik text-brown-300 mt-3 text-center">
              הפעל התראות Push כדי להגדיר
            </p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {doseTrackers.length === 0 && (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">💊</div>
          <p className="font-rubik font-semibold text-brown-500 text-sm">אין מעקבי מינון פעילים</p>
          <p className="font-rubik text-brown-400 text-xs mt-1">הוסף מעקב מינון בדף המעקבים</p>
        </div>
      )}
    </div>
  )
}
