// Supabase Edge Function: send-push-notifications
// Invoked by pg_cron every 30 minutes.
// For each family: checks dose-type trackers' notification_times against the current hour,
// and sends push alerts for any dose not yet given today.
// Also handles interval-based diaper alerts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@baby-tracker.app'

// ── VAPID signing (pure Web Crypto — no Node deps needed) ─────────────────

function base64urlToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function uint8ToBase64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function buildVapidAuthHeader(audience: string): Promise<string> {
  const header  = { typ: 'JWT', alg: 'ES256' }
  const now      = Math.floor(Date.now() / 1000)
  const payload  = { aud: audience, exp: now + 43200, sub: VAPID_EMAIL }
  const encodedH = uint8ToBase64url(new TextEncoder().encode(JSON.stringify(header)))
  const encodedP = uint8ToBase64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sigInput = `${encodedH}.${encodedP}`

  const rawKey = base64urlToUint8(VAPID_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  ).catch(async () => {
    return crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
  })

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput),
  )
  const token = `${sigInput}.${uint8ToBase64url(new Uint8Array(sig))}`
  return `vapid t=${token},k=${VAPID_PUBLIC_KEY}`
}

// ── Encrypt payload for web push (AES-128-GCM + ECDH) ────────────────────

async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder     = new TextEncoder()
  const p256dh      = base64urlToUint8(p256dhB64)
  const authSecret  = base64urlToUint8(authB64)
  const salt        = crypto.getRandomValues(new Uint8Array(16))

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  )
  const serverPublicKeyBuf = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  const serverPublicKey    = new Uint8Array(serverPublicKeyBuf)

  const clientPublicKey = await crypto.subtle.importKey(
    'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256,
  )
  const sharedSecret = new Uint8Array(sharedSecretBits)

  const prkKeyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits'])
  const authInfo = encoder.encode('Content-Encoding: auth\0')
  const prkBits  = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo }, prkKeyMaterial, 256,
  )
  const prk = new Uint8Array(prkBits)

  const prkIkm     = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits'])
  const contextBuf = new Uint8Array([
    ...encoder.encode('P-256\0'),
    0, 65, ...p256dh,
    0, 65, ...serverPublicKey,
  ])
  const cekInfo    = new Uint8Array([...encoder.encode('Content-Encoding: aesgcm\0'), ...contextBuf])
  const nonceInfo  = new Uint8Array([...encoder.encode('Content-Encoding: nonce\0'),  ...contextBuf])

  const cekBits   = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },   prkIkm, 128)
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkIkm, 96)

  const payloadBytes = encoder.encode(payload)
  const padLen  = Math.max(0, 3054 - 2 - payloadBytes.length)
  const padded  = new Uint8Array(2 + padLen + payloadBytes.length)
  new DataView(padded.buffer).setUint16(0, padLen, false)
  padded.set(payloadBytes, 2 + padLen)

  const cekKey = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt'])
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBits }, cekKey, padded,
  )

  return { ciphertext: new Uint8Array(cipherBuf), salt, serverPublicKey }
}

// ── Send a single web push notification ───────────────────────────────────

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object): Promise<boolean> {
  const url      = new URL(sub.endpoint)
  const audience = `${url.protocol}//${url.host}`

  const vapidHeader = await buildVapidAuthHeader(audience)
  const bodyStr     = JSON.stringify(payload)
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(bodyStr, sub.p256dh, sub.auth)

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization':      vapidHeader,
      'Content-Type':       'application/octet-stream',
      'Content-Encoding':   'aesgcm',
      'Encryption':         `salt=${uint8ToBase64url(salt)}`,
      'Crypto-Key':         `dh=${uint8ToBase64url(serverPublicKey)}`,
      'TTL':                '86400',
    },
    body: ciphertext,
  })

  if (res.status === 410 || res.status === 404) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  }

  return res.ok || res.status === 201
}

// ── Alert throttle check ───────────────────────────────────────────────────

async function wasAlertSentRecently(familyId: string, childId: string, alertType: string, withinMinutes = 90): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('push_notification_log')
    .select('id')
    .eq('family_id', familyId)
    .eq('child_id', childId)
    .eq('alert_type', alertType)
    .gte('sent_at', since)
    .limit(1)
  return (data?.length ?? 0) > 0
}

async function logAlert(familyId: string, childId: string, alertType: string) {
  await supabase.from('push_notification_log').insert({ family_id: familyId, child_id: childId, alert_type: alertType })
}

// ── Israel time helpers ────────────────────────────────────────────────────

function israelHour(): number {
  return parseInt(new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false,
  }).format(new Date()), 10)
}

function israelTodayStart(): Date {
  // Get today's date string in Israel timezone (YYYY-MM-DD)
  const israelDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  // Return midnight Israel = date T00:00:00 in Israel tz
  // We approximate by creating UTC date and subtracting the known offset (2h or 3h)
  const [y, m, d] = israelDateStr.split('-').map(Number)
  // Israel is UTC+2 in winter, UTC+3 in summer. Use 2h as safe lower bound.
  // The actual offset doesn't matter much — we just need "today" in Israel.
  return new Date(`${israelDateStr}T00:00:00+02:00`)
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const hour = israelHour()
  // Don't send alerts between midnight and 6 AM
  if (hour >= 0 && hour < 6) {
    return new Response(JSON.stringify({ skipped: 'night hours' }), { status: 200 })
  }

  // Get all push subscriptions
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('*')

  if (subsError || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // Get all active dose-type trackers (vitamin_d + custom dose)
  const { data: allDoseTrackers } = await supabase
    .from('trackers')
    .select('id, name, icon, color, config, tracker_type, family_id')
    .in('tracker_type', ['vitamin_d', 'dose'])
    .neq('is_deleted', true)
    .neq('is_active', false)

  // Get all active diaper trackers
  const { data: allDiaperTrackers } = await supabase
    .from('trackers')
    .select('id, family_id')
    .eq('tracker_type', 'diaper')
    .neq('is_deleted', true)
    .neq('is_active', false)

  let totalSent = 0
  const todayStart = israelTodayStart()

  // Group subscriptions by family
  const byFamily = new Map<string, typeof subs>()
  for (const sub of subs) {
    if (!byFamily.has(sub.family_id)) byFamily.set(sub.family_id, [])
    byFamily.get(sub.family_id)!.push(sub)
  }

  for (const [familyId, familySubs] of byFamily) {
    // Get active children for this family
    const { data: children } = await supabase
      .from('children')
      .select('id, name')
      .eq('family_id', familyId)

    if (!children?.length) continue

    const familyDoseTrackers = (allDoseTrackers ?? []).filter(t => t.family_id === familyId)
    const familyDiaperTracker = (allDiaperTrackers ?? []).find(t => t.family_id === familyId)

    for (const child of children) {
      const childId = child.id

      // ── Dose tracker alerts (vitamin_d + custom dose) ────────────────────
      for (const tracker of familyDoseTrackers) {
        const config = tracker.config ?? {}
        const notifTimes: string[] = config.notification_times ?? []
        const doseCount: number = config.daily_doses ?? 1
        const doseLabels: string[] = config.dose_labels ?? []

        // Fetch all doses given today for this child+tracker
        const { data: todayEvents } = await supabase
          .from('events')
          .select('data')
          .eq('family_id', familyId)
          .eq('child_id', childId)
          .eq('tracker_id', tracker.id)
          .gte('occurred_at', todayStart.toISOString())

        const givenDoseIndices = new Set(
          (todayEvents ?? []).map(e => String(e.data?.dose_index ?? e.data?.dose))
        )

        for (let i = 0; i < doseCount; i++) {
          const timeStr = notifTimes[i]
          if (!timeStr) continue  // no notification time configured for this dose

          const alertHour = parseInt(timeStr.split(':')[0], 10)
          if (hour !== alertHour) continue  // not the right hour window

          if (givenDoseIndices.has(String(i))) continue  // dose already given today

          const alertType = `tracker_${tracker.id}_dose_${i}`
          const alreadySent = await wasAlertSentRecently(familyId, childId, alertType, 120)
          if (alreadySent) continue

          // Subscribers who haven't explicitly disabled this tracker
          const eligibleSubs = familySubs.filter(
            s => s.prefs?.dose_trackers?.[tracker.id] !== false
          )

          for (const sub of eligibleSubs) {
            const doseLabel = doseLabels[i] ?? `מינון ${i + 1}`
            await sendPush(sub, {
              title: `${tracker.icon} ${tracker.name}`,
              body: `עדיין לא ניתן מינון ${doseLabel} לـ${child.name}`,
              tag: `dose_${tracker.id}_${i}`,
              url: '/',
            })
            totalSent++
          }
          await logAlert(familyId, childId, alertType)
        }
      }

      // ── Diaper alert (interval-based) ─────────────────────────────────────
      const diaperSubs = familySubs.filter(s => s.prefs?.diaper === true)
      if (diaperSubs.length > 0 && familyDiaperTracker) {
        const thresholdHours = Math.min(...diaperSubs.map(s => s.prefs?.diaper_hours ?? 4))

        const { data: lastDiaper } = await supabase
          .from('events')
          .select('occurred_at')
          .eq('family_id', familyId)
          .eq('child_id', childId)
          .eq('tracker_id', familyDiaperTracker.id)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastDiaper) {
          const hoursSince = (Date.now() - new Date(lastDiaper.occurred_at).getTime()) / 3600000
          if (hoursSince >= thresholdHours) {
            const alreadySent = await wasAlertSentRecently(familyId, childId, 'diaper', 90)
            if (!alreadySent) {
              const hoursRounded = Math.round(hoursSince * 10) / 10
              for (const sub of diaperSubs) {
                if (hoursSince < (sub.prefs?.diaper_hours ?? 4)) continue
                await sendPush(sub, {
                  title: '👶 לבדוק חיתול',
                  body: `עברו ${hoursRounded} שעות מאז ההחלפה האחרונה של ${child.name}`,
                  tag: 'diaper',
                  url: '/',
                })
                totalSent++
              }
              await logAlert(familyId, childId, 'diaper')
            }
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent: totalSent }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
