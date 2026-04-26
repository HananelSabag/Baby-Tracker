// Shared image utilities for avatar uploads.
//
// Goals:
//   • Single entry point for "pick from gallery" + "take a live photo"
//   • Resize + compress before upload so we don't ship 5 MB selfies over 4G
//   • Guess the MIME-type-derived extension instead of trusting filenames
//   • Stable storage paths (bucket + path) per subject to avoid orphans
//
// All callers should go through pickAndCompressImage() and uploadAvatar().
// No live DB writes happen here — RLS is enforced on the bucket itself.

import { supabase } from './supabase'

const MAX_DIM = 1024            // longest edge (px); bigger gets scaled down
const JPEG_QUALITY = 0.85
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES_BEFORE_COMPRESS = 200 * 1024 // skip compression for already-tiny files

// Map MIME → safe extension (don't trust file.name; phones rename things)
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

/**
 * Triggers the OS picker. `mode`:
 *   'camera'  → live capture (camera roll on iOS, camera app on Android)
 *   'gallery' → file browser
 *   'any'     → user's choice (mobile usually shows both options)
 *
 * Returns a File or null.
 */
export function pickImage({ mode = 'any' } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    if (mode === 'camera') {
      // `capture` is honored on Android + iOS Safari; ignored on desktop, which is fine.
      input.capture = 'user'
    }
    // Note: omitting `capture` for 'gallery' is intentional — without it,
    // most mobile browsers offer both camera and gallery in the chooser.

    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    // Fallback: if the user dismisses without picking, focus returns and there's no event.
    // We don't try to detect that — the promise simply stays pending until GC.
    input.click()
  })
}

/**
 * Down-scales (longest edge ≤ MAX_DIM) and re-encodes as JPEG.
 * Returns { blob, ext, mime } or throws.
 */
export async function compressImage(file) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('סוג קובץ לא נתמך. בחר תמונת JPG / PNG / WEBP / GIF.')
  }
  // Tiny files: skip the canvas round-trip (saves quality, still gets a sane ext)
  if (file.size <= MAX_BYTES_BEFORE_COMPRESS) {
    return { blob: file, ext: EXT_BY_MIME[file.type] ?? 'jpg', mime: file.type }
  }

  const bitmap = await loadBitmap(file)
  const { width, height } = scaleToFit(bitmap.width, bitmap.height, MAX_DIM)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('הדפדפן לא תומך בעיבוד תמונה')
  ctx.drawImage(bitmap, 0, 0, width, height)

  // Always re-encode as JPEG — smaller, no transparency needed for avatars.
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('דחיסת התמונה נכשלה')
  return { blob, ext: 'jpg', mime: 'image/jpeg' }
}

/**
 * One-shot helper: pick → compress.
 */
export async function pickAndCompressImage(opts) {
  const file = await pickImage(opts)
  if (!file) return null
  return compressImage(file)
}

/**
 * Upload a compressed blob to the `avatars` bucket at `<folder>/<subjectId>.jpg`.
 * Uses upsert: true so the same subject always overwrites — no orphan accumulation.
 *
 * Returns the public URL on success.
 */
export async function uploadAvatar({ folder, subjectId, blob, mime, ext }) {
  if (!folder || !subjectId || !blob) throw new Error('uploadAvatar: missing arguments')
  // Stable name → upsert overwrites previous avatars (jpg/png mix used to leak orphans)
  const path = `${folder}/${subjectId}.${ext ?? 'jpg'}`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: mime ?? 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Append a cache-buster so <img src> updates immediately after re-upload
  return `${data.publicUrl}?v=${Date.now()}`
}

// ── helpers ────────────────────────────────────────────────────────────────

async function loadBitmap(file) {
  // createImageBitmap is faster + works without a DOM <img>, but Safari < 14 lacks it.
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fall through */ }
  }
  return loadViaImageElement(file)
}

function loadViaImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('failed to load image')) }
    img.src = url
  })
}

function scaleToFit(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h }
  const r = w > h ? max / w : max / h
  return { width: Math.round(w * r), height: Math.round(h * r) }
}
