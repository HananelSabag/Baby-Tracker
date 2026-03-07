import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// Convert VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export const DEFAULT_PREFS = {
  dose_trackers: {},   // { [trackerId]: bool } — missing key = enabled by default
  diaper:        false,
  diaper_hours:  4,
}

export function usePushNotifications({ familyId, memberId }) {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && Boolean(VAPID_PUBLIC_KEY)

  const [permission, setPermission]     = useState(() => supported ? Notification.permission : 'unsupported')
  const [subscription, setSubscription] = useState(null)   // PushSubscription | null
  const [prefs, setPrefsState]          = useState(DEFAULT_PREFS)
  const [loading, setLoading]           = useState(false)

  // On mount: check existing subscription + load saved prefs from DB
  useEffect(() => {
    if (!supported || !familyId || !memberId) return

    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      setSubscription(sub ?? null)

      if (sub) {
        // Load saved prefs from DB
        const { data } = await supabase
          .from('push_subscriptions')
          .select('prefs')
          .eq('endpoint', sub.endpoint)
          .maybeSingle()
        if (data?.prefs) setPrefsState(prev => ({ ...DEFAULT_PREFS, ...prev, ...data.prefs }))
      }
    })
  }, [supported, familyId, memberId])

  // Save prefs to Supabase (called when prefs change while subscribed)
  const savePrefs = useCallback(async (newPrefs) => {
    if (!subscription) return
    await supabase
      .from('push_subscriptions')
      .update({ prefs: newPrefs, updated_at: new Date().toISOString() })
      .eq('endpoint', subscription.endpoint)
  }, [subscription])

  async function updatePrefs(newPrefs) {
    setPrefsState(newPrefs)
    await savePrefs(newPrefs)
  }

  // Subscribe: request permission → create PushSubscription → save to DB
  async function subscribe(initialPrefs = prefs) {
    if (!supported) return 'unsupported'
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return perm

      const reg = await navigator.serviceWorker.ready
      let sub
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      } catch {
        return 'error'
      }

      const json = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        family_id: familyId,
        member_id: memberId,
        endpoint:  json.endpoint,
        p256dh:    json.keys.p256dh,
        auth:      json.keys.auth,
        prefs:     initialPrefs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' })

      setSubscription(sub)
      setPrefsState(initialPrefs)
      return 'granted'
    } finally {
      setLoading(false)
    }
  }

  // Unsubscribe: browser + DB
  async function unsubscribe() {
    if (!subscription) return
    setLoading(true)
    try {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  const isSubscribed = Boolean(subscription)

  return {
    supported,
    permission,
    isSubscribed,
    prefs,
    loading,
    subscribe,
    unsubscribe,
    updatePrefs,
  }
}
