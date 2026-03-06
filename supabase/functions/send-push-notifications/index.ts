// Supabase Edge Function: send-push-notifications
// Invoked by pg_cron every 30 minutes.
// Checks each family's recent events and sends push alerts
// when a tracker hasn't been updated in too long.

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
  // Build JWT header + payload
  const header  = { typ: 'JWT', alg: 'ES256' }
  const now      = Math.floor(Date.now() / 1000)
  const payload  = { aud: audience, exp: now + 43200, sub: VAPID_EMAIL }
  const encodedH = uint8ToBase64url(new TextEncoder().encode(JSON.stringify(header)))
  const encodedP = uint8ToBase64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sigInput = `${encodedH}.${encodedP}`

  // Import private key (PKCS8 / raw)
  const rawKey = base64urlToUint8(VAPID_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  ).catch(async () => {
    // Fallback: try jwk format
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

  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  )
  const serverPublicKeyBuf = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  const serverPublicKey    = new Uint8Array(serverPublicKeyBuf)

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey }, serverKeyPair.privateKey, 256,
  )
  const sharedSecret = new Uint8Array(sharedSecretBits)

  // HKDF: pseudo-random key
  const prkKeyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits'])
  const authInfo = encoder.encode('Content-Encoding: auth\0')
  const prkBits  = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo }, prkKeyMaterial, 256,
  )
  const prk = new Uint8Array(prkBits)

  // HKDF: content encryption key + nonce
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

  // Pad payload to 3054 bytes (as per RFC 8291 recommendations)
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

  // 410 Gone or 404 = subscription expired, should be removed
  if (res.status === 410 || res.status === 404) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  }

  return res.ok || res.status === 201
}

// ── Alert throttle check ───────────────────────────────────────────────────

async function wasAlertSentRecently(familyId: string, childId: string | null, alertType: string, withinMinutes = 60): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()
  const query = supabase
    .from('push_notification_log')
    .select('id')
    .eq('family_id', familyId)
    .eq('alert_type', alertType)
    .gte('sent_at', since)
    .limit(1)

  if (childId) query.eq('child_id', childId)

  const { data } = await query
  return (data?.length ?? 0) > 0
}

async function logAlert(familyId: string, childId: string | null, alertType: string) {
  await supabase.from('push_notification_log').insert({ family_id: familyId, child_id: childId, alert_type: alertType })
}

// ── Israel time helpers ────────────────────────────────────────────────────

function israelHour(): number {
  return parseInt(new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false,
  }).format(new Date()), 10)
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Simple auth: only allow cron calls (or manual POST with secret header)
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

  let totalSent = 0

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

    // Check alerts for each child
    for (const child of children) {
      const childId = child.id

      // ── Feeding alert ──────────────────────────────────────────────────
      // Find subscriptions that have feeding alerts enabled
      const feedingSubs = familySubs.filter(s => s.prefs?.feeding === true)
      if (feedingSubs.length > 0) {
        const thresholdHours = Math.min(...feedingSubs.map(s => s.prefs?.feeding_hours ?? 3))

        const { data: lastFeeding } = await supabase
          .from('events')
          .select('occurred_at')
          .eq('family_id', familyId)
          .eq('child_id', childId)
          .eq('tracker_id', await getTrackerIdByType(familyId, 'feeding'))
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastFeeding) {
          const hoursSince = (Date.now() - new Date(lastFeeding.occurred_at).getTime()) / 3600000
          if (hoursSince >= thresholdHours) {
            const alreadySent = await wasAlertSentRecently(familyId, childId, 'feeding', 90)
            if (!alreadySent) {
              const hoursRounded = Math.round(hoursSince * 10) / 10
              for (const sub of feedingSubs) {
                if (sub.prefs?.feeding !== true) continue
                if (hoursSince < (sub.prefs?.feeding_hours ?? 3)) continue
                await sendPush(sub, {
                  title: '🍼 זמן להאכיל!',
                  body: `עברו ${hoursRounded} שעות מאז ההאכלה האחרונה של ${child.name}`,
                  tag: 'feeding',
                  url: '/',
                })
                totalSent++
              }
              await logAlert(familyId, childId, 'feeding')
            }
          }
        }
      }

      // ── Diaper alert ───────────────────────────────────────────────────
      const diaperSubs = familySubs.filter(s => s.prefs?.diaper === true)
      if (diaperSubs.length > 0) {
        const thresholdHours = Math.min(...diaperSubs.map(s => s.prefs?.diaper_hours ?? 4))

        const { data: lastDiaper } = await supabase
          .from('events')
          .select('occurred_at')
          .eq('family_id', familyId)
          .eq('child_id', childId)
          .eq('tracker_id', await getTrackerIdByType(familyId, 'diaper'))
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
                if (sub.prefs?.diaper !== true) continue
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

      // ── Vitamin D alerts ───────────────────────────────────────────────
      const vitSubs = familySubs.filter(s => s.prefs?.vitaminD === true)
      if (vitSubs.length > 0) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const vitaminTrackerId = await getTrackerIdByType(familyId, 'vitamin_d')

        if (vitaminTrackerId) {
          const { data: todayVitamin } = await supabase
            .from('events')
            .select('data')
            .eq('family_id', familyId)
            .eq('child_id', childId)
            .eq('tracker_id', vitaminTrackerId)
            .gte('occurred_at', today.toISOString())

          const givenDoseIndices = new Set((todayVitamin ?? []).map(e => String(e.data?.dose_index ?? e.data?.dose)))

          // Morning: alert at 10am if dose 0 not given
          if (hour >= 10 && hour < 11 && !givenDoseIndices.has('0')) {
            const alreadySent = await wasAlertSentRecently(familyId, childId, 'vitaminD_morning', 120)
            if (!alreadySent) {
              for (const sub of vitSubs) {
                await sendPush(sub, {
                  title: '☀️ ויטמין D — בוקר',
                  body: `עדיין לא ניתן מינון הבוקר של ויטמין D לـ${child.name}`,
                  tag: 'vitaminD',
                  url: '/',
                })
                totalSent++
              }
              await logAlert(familyId, childId, 'vitaminD_morning')
            }
          }

          // Evening: alert at 20:00 if dose 1 not given
          if (hour >= 20 && hour < 21 && !givenDoseIndices.has('1')) {
            const alreadySent = await wasAlertSentRecently(familyId, childId, 'vitaminD_evening', 120)
            if (!alreadySent) {
              for (const sub of vitSubs) {
                await sendPush(sub, {
                  title: '🌙 ויטמין D — ערב',
                  body: `עדיין לא ניתן מינון הערב של ויטמין D לـ${child.name}`,
                  tag: 'vitaminD',
                  url: '/',
                })
                totalSent++
              }
              await logAlert(familyId, childId, 'vitaminD_evening')
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

// ── Helper: get tracker ID by type for a family ────────────────────────────
const trackerCache = new Map<string, string | null>()

async function getTrackerIdByType(familyId: string, trackerType: string): Promise<string | null> {
  const key = `${familyId}:${trackerType}`
  if (trackerCache.has(key)) return trackerCache.get(key)!

  const { data } = await supabase
    .from('trackers')
    .select('id')
    .eq('family_id', familyId)
    .eq('tracker_type', trackerType)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const id = data?.id ?? null
  trackerCache.set(key, id)
  return id
}
