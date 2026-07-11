// Album export pipeline — ZIP, GIF, and Video generation.
// All functions are pure (no React state); they receive data and call callbacks.

import {
  MONTH_LABELS, MONTH_FILENAMES, HE_MONTHS,
  EFFECTS, FRAMES, MUSIC_TRACKS, SUPABASE_MUSIC_URL,
  VIDEO_SIZE, TRANSITION_MS,
  GIF_SIZE, GIF_SPEED_MS, GIF_TRANSITION_FRAMES,
  CANVAS_SIZE,
} from './albumConstants'

// ── Canvas helpers ─────────────────────────────────────────────────────────────

export function loadImageCrossOrigin(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => {
      // Fallback: retry without query params (helps with some CDN CORS configs)
      const fb = new Image()
      fb.crossOrigin = 'anonymous'
      fb.onload  = () => resolve(fb)
      fb.onerror = reject
      fb.src = src.split('?')[0]
    }
    // Use the URL as-is — uploadMilestonePhoto already appends ?v=<timestamp>
    // so the browser never serves a stale cached version after a re-upload.
    img.src = src
  })
}

export function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw    = img.naturalWidth  * scale
  const sh    = img.naturalHeight * scale
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh)
}

// Splits `text` into lines that fit within `maxWidth` px (at the current ctx font).
// Returns at most `maxLines` lines; the last line is truncated with "…" if needed.
export function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
  const words = text.split(' ')
  const lines = []
  let line       = ''
  let truncated  = false

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = word
      if (lines.length >= maxLines) {
        // No room for another line — the current word (and any after) is cut.
        truncated = true
        line = ''
        break
      }
    }
  }
  if (line) {
    if (lines.length < maxLines) lines.push(line)
    else truncated = true          // leftover line has nowhere to go
  }

  // Add an ellipsis whenever content was cut — either the last line overflows
  // its width, or whole words were dropped. Prevents captions from being
  // silently clipped with no visual cue.
  if (lines.length > 0) {
    let last = lines[lines.length - 1]
    if (truncated || ctx.measureText(last).width > maxWidth) {
      while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) {
        last = last.slice(0, -1)
      }
      lines[lines.length - 1] = last + '…'
    }
  }

  return lines.slice(0, maxLines)
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/**
 * Cross-fade between two pre-rendered canvases. The alpha is derived from the
 * real elapsed time (not a fixed step count), so the motion is smooth and
 * frame-rate independent — the old fixed 30ms-step loop dropped frames and
 * stuttered on mobile. A ~16ms setTimeout tick keeps it running even when the
 * tab is backgrounded and requestAnimationFrame is paused (which would stall an
 * in-progress video export). `shouldAbort` lets a looping preview bail early.
 */
export function crossfadeCanvases(ctx, fromCanvas, toCanvas, durationMs, shouldAbort) {
  return new Promise(resolve => {
    const start = performance.now()
    function step() {
      if (shouldAbort?.()) { resolve(); return }
      const t = Math.min(1, (performance.now() - start) / durationMs)
      ctx.globalAlpha = 1
      ctx.drawImage(fromCanvas, 0, 0)
      ctx.globalAlpha = easeInOut(t)
      ctx.drawImage(toCanvas, 0, 0)
      ctx.globalAlpha = 1
      if (t < 1) setTimeout(step, 16)
      else resolve()
    }
    step()
  })
}

export function formatAlbumTime(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function formatHebrewDate(d) {
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return null
  const day  = String(dt.getDate()).padStart(2, '0')
  const mon  = HE_MONTHS[dt.getMonth()]
  const year = dt.getFullYear()
  return `${day} ${mon} ${year}`
}

export async function getPhotoDate(photo) {
  try {
    const exifr = await import('exifr')
    const data  = await exifr.parse(photo.photo_url.split('?')[0], ['DateTimeOriginal', 'DateTime'])
    const d     = data?.DateTimeOriginal ?? data?.DateTime
    if (d) return formatHebrewDate(d)
  } catch { /* EXIF not available — fall through */ }

  if (photo.created_at) return formatHebrewDate(new Date(photo.created_at))
  return null
}

// ── Frame renderer ─────────────────────────────────────────────────────────────

function getEffect(effectId) { return EFFECTS.find(e => e.id === effectId) ?? EFFECTS[0] }
function getFrame(frameId)   { return FRAMES.find(f => f.id === frameId)   ?? FRAMES[0] }

const CAPTION_MAX_LINES = 3

/**
 * Pure geometry for the lower-third text band. Returns font sizes, the band
 * height, and a bottom-anchored y for each line box (textBaseline='bottom').
 * Kept pure (no ctx) so it can be unit-tested.
 *
 * Layout differs by content, which is the "captioned vs non-captioned" design:
 *   • nothing        → bandH 0 (clean full-bleed image)
 *   • month only     → short band
 *   • caption present → band grows to fit every line, capped at 62% of the
 *     frame so it never covers the important upper part of the photo.
 */
export function computeAlbumBand({ S, hasMonth, capLineCount }) {
  const pad        = Math.round(S * 0.05)
  const monthFont  = Math.round(S * 0.072)
  const capFont    = Math.round(S * 0.046)
  const dateFont   = Math.round(S * 0.032)
  const monthLineH = Math.round(monthFont * 1.12)
  const capLineH   = Math.round(capFont * 1.34)
  const gap        = (hasMonth && capLineCount > 0) ? Math.round(S * 0.012) : 0

  // Stack line boxes upward from the bottom padding line.
  const rows = []
  let bottom = S - pad
  if (hasMonth) {
    rows.push({ kind: 'month', y: bottom })
    bottom -= monthLineH
  }
  if (capLineCount > 0) {
    bottom -= gap
    for (let i = capLineCount - 1; i >= 0; i--) {   // bottom-most caption line first
      rows.push({ kind: 'cap', line: i, y: bottom })
      bottom -= capLineH
    }
  }

  const contentTop = bottom                          // top edge of the highest box
  const hasText    = hasMonth || capLineCount > 0
  const rawBandH   = (S - contentTop) + Math.round(pad * 0.5)
  const bandH      = hasText
    ? Math.max(Math.round(S * 0.16), Math.min(rawBandH, Math.round(S * 0.62)))
    : 0

  return { pad, monthFont, capFont, dateFont, capLineH, bandH, rows }
}

/**
 * Draws a fully-composited album frame onto `ctx` (size × size).
 * Shared by the live preview, GIF, video, and ZIP so all four render identically.
 * Pass `precomputedDate` to skip the async EXIF lookup on repeated calls.
 */
export async function drawAlbumFrame(ctx, size, img, photo, month, options, precomputedDate) {
  const S = size

  ctx.fillStyle = '#FFFAF5'
  ctx.fillRect(0, 0, S, S)

  // Photo — cover-fit and centred; the canvas clips anything past its edges.
  const filter = getEffect(options.effectOverride ?? photo.effect_id).filter
  if (filter) ctx.filter = filter
  drawCover(ctx, img, 0, 0, S, S)
  ctx.filter = 'none'

  // Decorative frame border (drawn on top of the photo, inset).
  const fr = getFrame(photo.frame_id ?? 'none')
  if (fr.canvasColor) {
    const fw        = Math.max(2, Math.round(fr.insetPx * (S / 100)))
    ctx.strokeStyle = fr.canvasColor
    ctx.lineWidth   = fw
    ctx.strokeRect(fw / 2, fw / 2, S - fw, S - fw)
  }

  // Resolve text pieces first so the band can be sized to exactly fit them.
  const monthLabel = options.showMonthLabel ? MONTH_LABELS[month - 1] : null
  const caption    = options.showCaption && photo.caption ? photo.caption.trim() : ''

  // Measure/wrap caption at its real font before computing the band height.
  const probe = computeAlbumBand({ S, hasMonth: !!monthLabel, capLineCount: 0 })
  let capLines = []
  if (caption) {
    ctx.font = `${probe.capFont}px Arial, sans-serif`
    capLines = wrapCanvasText(ctx, caption, S - probe.pad * 2, CAPTION_MAX_LINES)
  }

  const L = computeAlbumBand({ S, hasMonth: !!monthLabel, capLineCount: capLines.length })

  // Lower gradient band — only as tall as the text needs.
  if (L.bandH > 0) {
    const grad = ctx.createLinearGradient(0, S - L.bandH, 0, S)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.55, 'rgba(0,0,0,0.34)')
    grad.addColorStop(1, 'rgba(0,0,0,0.76)')
    ctx.fillStyle = grad
    ctx.fillRect(0, S - L.bandH, S, L.bandH)
  }

  ctx.direction    = 'rtl'
  ctx.textAlign    = 'right'
  ctx.textBaseline = 'alphabetic'
  const x = S - L.pad

  // Date — top-right, with its own subtle top scrim.
  if (options.showDate) {
    const dateStr = precomputedDate !== undefined ? precomputedDate : await getPhotoDate(photo)
    if (dateStr) {
      const scrimH  = Math.round(S * 0.09)
      const topGrad = ctx.createLinearGradient(0, 0, 0, scrimH)
      topGrad.addColorStop(0, 'rgba(0,0,0,0.4)')
      topGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = topGrad
      ctx.fillRect(0, 0, S, scrimH)
      ctx.textBaseline = 'top'
      ctx.font        = `bold ${L.dateFont}px Arial, sans-serif`
      ctx.fillStyle   = 'rgba(255,255,255,0.9)'
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur  = Math.round(S * 0.006)
      ctx.fillText(dateStr, x, Math.round(S * 0.035))
      ctx.shadowBlur  = 0
    }
  }

  // Month label + caption — drawn bottom-anchored per the computed layout.
  ctx.textBaseline = 'bottom'
  for (const row of L.rows) {
    if (row.kind === 'month') {
      ctx.font        = `bold ${L.monthFont}px Arial, sans-serif`
      ctx.fillStyle   = '#FFFFFF'
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur  = Math.round(S * 0.01)
      ctx.fillText(monthLabel, x, row.y)
      ctx.shadowBlur  = 0
    } else {
      ctx.font        = `${L.capFont}px Arial, sans-serif`
      ctx.fillStyle   = 'rgba(255,255,255,0.92)'
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur  = Math.round(S * 0.007)
      ctx.fillText(capLines[row.line], x, row.y)
      ctx.shadowBlur  = 0
    }
  }
  ctx.textBaseline = 'alphabetic'
}

// ── ZIP export pipeline ────────────────────────────────────────────────────────

// Print options for the ZIP pages — month + caption baked in, no date scrim.
const ZIP_FRAME_OPTIONS = { showMonthLabel: true, showCaption: true, showDate: false, effectOverride: null }

async function renderPage(photo, month) {
  const canvas  = document.createElement('canvas')
  canvas.width  = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')

  const img = await loadImageCrossOrigin(photo.photo_url)
  // Same compositor as preview/GIF/video → the printed page matches what the
  // user saw. `precomputedDate: null` skips the EXIF lookup (date is off here).
  await drawAlbumFrame(ctx, CANVAS_SIZE, img, photo, month, ZIP_FRAME_OPTIONS, null)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

export async function exportAlbum({ byMonth, childName, onProgress, onDone }) {
  const JSZip = (await import('jszip')).default
  const zip   = new JSZip()

  const photos = Object.entries(byMonth).sort(([a], [b]) => Number(a) - Number(b))

  for (let i = 0; i < photos.length; i++) {
    const [monthStr, photo] = photos[i]
    const month = Number(monthStr)
    onProgress(i + 1)
    const blob = await renderPage(photo, month)
    zip.file(`month-${MONTH_FILENAMES[month - 1]}.jpg`, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(zipBlob, `BabyTracker-${childName.replace(/[^\w-]/g, '-')}-album.zip`)
  onDone()
}

// ── GIF pipeline ───────────────────────────────────────────────────────────────

export async function generateAlbumGif({ byMonth, childName, options, onProgress, onDone }) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')

  const gif    = GIFEncoder()
  const photos = Object.entries(byMonth).sort(([a], [b]) => Number(a) - Number(b))
  const S      = GIF_SIZE
  const holdMs = GIF_SPEED_MS[options.speed ?? 'normal']

  const blend = document.createElement('canvas')
  blend.width = blend.height = S
  const bctx  = blend.getContext('2d')

  // gifenc runs synchronously; quantize is heavy, so yield after every frame to
  // keep the progress UI responsive instead of freezing the tab.
  async function writeCanvas(source, delay) {
    const rgba    = source.getContext('2d').getImageData(0, 0, S, S).data
    const palette = quantize(rgba, 256)
    const index   = applyPalette(rgba, palette)
    gif.writeFrame(index, S, S, { palette, delay, repeat: 0 })
    await waitMs(0)
  }

  const steps     = GIF_TRANSITION_FRAMES
  const stepDelay = Math.max(20, Math.round(TRANSITION_MS / steps))

  // Stream one photo at a time (only prev + current held) so a 12-month album
  // doesn't allocate a dozen full-size canvases at once on a phone.
  let prev = null
  for (let i = 0; i < photos.length; i++) {
    const [monthStr, photo] = photos[i]
    onProgress(i + 1)

    const cur  = document.createElement('canvas')
    cur.width  = cur.height = S
    const img  = await loadImageCrossOrigin(photo.photo_url)
    await drawAlbumFrame(cur.getContext('2d'), S, img, photo, Number(monthStr), options)

    // Smooth dissolve from the previous photo before showing this one.
    if (prev) {
      for (let f = 1; f <= steps; f++) {
        const alpha = easeInOut(f / (steps + 1))
        bctx.globalAlpha = 1;     bctx.drawImage(prev, 0, 0)
        bctx.globalAlpha = alpha; bctx.drawImage(cur, 0, 0)
        bctx.globalAlpha = 1
        await writeCanvas(blend, stepDelay)
      }
    }
    await writeCanvas(cur, holdMs)
    prev = cur
  }

  gif.finish()
  const buffer = gif.bytes()
  const blob   = new Blob([buffer], { type: 'image/gif' })
  triggerDownload(blob, `BabyTracker-${childName.replace(/[^\w-]/g, '-')}.gif`)
  onDone()
}

// ── Video pipeline ─────────────────────────────────────────────────────────────

export async function generateAlbumVideo({ byMonth, childName, options, onProgress, onDone }) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('הדפדפן שלך אינו תומך ביצוא וידאו. נסה Chrome או Safari עדכני.')
  }

  const mimeType =
    ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'

  const photos = Object.entries(byMonth).sort(([a], [b]) => Number(a) - Number(b))
  if (photos.length === 0) throw new Error('אין תמונות לייצוא.')

  onProgress({ phase: 'loading', step: 0, total: photos.length })

  const [imgs, dates] = await Promise.all([
    Promise.all(photos.map(([, p]) => loadImageCrossOrigin(p.photo_url))),
    Promise.all(photos.map(([, p]) => getPhotoDate(p))),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = VIDEO_SIZE
  const ctx = canvas.getContext('2d')

  await drawAlbumFrame(ctx, VIDEO_SIZE, imgs[0], photos[0][1], Number(photos[0][0]), options, dates[0])

  const videoStream = canvas.captureStream(30)

  let audioCtx    = null
  let musicSource = null
  let gainNode    = null
  const audioTracks = []

  const musicTrack = options.music ? MUSIC_TRACKS.find(t => t.id === options.music) : null
  if (musicTrack) {
    audioCtx = new AudioContext()
    const resp   = await fetch(`${SUPABASE_MUSIC_URL}/${musicTrack.id}.mp3`)
    if (!resp.ok) throw new Error('לא הצלחתי לטעון את השיר. בדוק חיבור אינטרנט.')
    const buf    = await resp.arrayBuffer()
    const decoded = await audioCtx.decodeAudioData(buf)

    const dest = audioCtx.createMediaStreamDestination()
    gainNode   = audioCtx.createGain()
    gainNode.connect(dest)
    musicSource = audioCtx.createBufferSource()
    musicSource.buffer = decoded
    musicSource.connect(gainNode)
    audioTracks.push(...dest.stream.getAudioTracks())
  }

  const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks])
  const chunks   = []
  const recorder = new MediaRecorder(combined, {
    mimeType,
    // 8 Mbps @ 1080p is high quality for a photo slideshow while staying within
    // reach of mobile software encoders (12 Mbps could choke VP8 → dropped frames).
    videoBitsPerSecond: 8_000_000,
  })
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  const stoppedPromise = new Promise(resolve => { recorder.onstop = resolve })

  const frameDurationMs = GIF_SPEED_MS[options.speed ?? 'normal']
  const totalVideoMs    =
    photos.length * frameDurationMs +
    (photos.length > 1 ? (photos.length - 1) * TRANSITION_MS : 0)

  recorder.start(1000)

  if (musicSource && gainNode && audioCtx) {
    musicSource.start(0, options.musicStart ?? 0)
    const fadeStart = audioCtx.currentTime + Math.max(0, (totalVideoMs - 2000) / 1000)
    const fadeEnd   = audioCtx.currentTime + totalVideoMs / 1000
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime)
    gainNode.gain.setValueAtTime(1, fadeStart)
    gainNode.gain.linearRampToValueAtTime(0, fadeEnd)
  }

  // Phase 2: rendering — sequential for per-frame progress reporting
  const offscreens = []
  for (let i = 0; i < photos.length; i++) {
    onProgress({ phase: 'rendering', step: i + 1, total: photos.length })
    const [monthStr, photo] = photos[i]
    const off = document.createElement('canvas')
    off.width = off.height = VIDEO_SIZE
    await drawAlbumFrame(off.getContext('2d'), VIDEO_SIZE, imgs[i], photo, Number(monthStr), options, dates[i])
    offscreens.push(off)
  }

  // Phase 3: recording — hold each frame, then a smooth rAF cross-fade to the next.
  for (let i = 0; i < photos.length; i++) {
    onProgress({ phase: 'recording', step: i + 1, total: photos.length })

    ctx.globalAlpha = 1
    ctx.drawImage(offscreens[i], 0, 0)
    await waitMs(frameDurationMs)

    if (i < photos.length - 1) {
      await crossfadeCanvases(ctx, offscreens[i], offscreens[i + 1], TRANSITION_MS)
    }
  }

  recorder.stop()
  try { musicSource?.stop() } catch { /* already ended */ }
  if (audioCtx) await audioCtx.close()

  await stoppedPromise

  const blob = new Blob(chunks, { type: mimeType })
  triggerDownload(blob, `BabyTracker-${childName.replace(/[^\w-]/g, '-')}.${ext}`)
  onDone()
}
