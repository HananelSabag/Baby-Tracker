// Album export pipeline — ZIP, GIF, and Video generation.
// All functions are pure (no React state); they receive data and call callbacks.

import {
  MONTH_LABELS, MONTH_FILENAMES, HE_MONTHS,
  EFFECTS, FRAMES, MUSIC_TRACKS, SUPABASE_MUSIC_URL,
  VIDEO_SIZE, TRANSITION_MS, TRANSITION_STEPS,
  GIF_SIZE, GIF_SPEED_MS,
  CANVAS_SIZE, CANVAS_FRAME_WIDTH,
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
  let line    = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    }
  }
  if (line && lines.length < maxLines) lines.push(line)

  if (lines.length > 0) {
    let last = lines[lines.length - 1]
    if (ctx.measureText(last).width > maxWidth) {
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

/**
 * Draws a fully-composited album frame onto `ctx` (size × size).
 * Pass `precomputedDate` to skip the async EXIF lookup on repeated calls.
 */
export async function drawAlbumFrame(ctx, size, img, photo, month, options, precomputedDate) {
  const S = size

  ctx.fillStyle = '#FFFAF5'
  ctx.fillRect(0, 0, S, S)

  const filter = getEffect(options.effectOverride ?? photo.effect_id).filter
  if (filter) ctx.filter = filter
  drawCover(ctx, img, 0, 0, S, S)
  ctx.filter = 'none'

  const fr = getFrame(photo.frame_id ?? 'none')
  if (fr.canvasColor) {
    const fw        = Math.round(fr.insetPx * (S / 100))
    ctx.strokeStyle = fr.canvasColor
    ctx.lineWidth   = fw
    ctx.strokeRect(fw / 2, fw / 2, S - fw, S - fw)
  }

  const bandH = Math.round(S * 0.34)
  const grad  = ctx.createLinearGradient(0, S - bandH, 0, S)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = grad
  ctx.fillRect(0, S - bandH, S, bandH)

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'

  if (options.showDate) {
    const dateStr = precomputedDate !== undefined ? precomputedDate : await getPhotoDate(photo)
    if (dateStr) {
      const topGrad = ctx.createLinearGradient(0, 0, 0, 56)
      topGrad.addColorStop(0, 'rgba(0,0,0,0.38)')
      topGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = topGrad
      ctx.fillRect(0, 0, S, 56)
      ctx.font        = `bold ${Math.round(S * 0.038)}px Arial, sans-serif`
      ctx.fillStyle   = 'rgba(255,255,255,0.88)'
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur  = 5
      ctx.fillText(dateStr, S - 12, 26)
      ctx.shadowBlur  = 0
    }
  }

  const yMonth   = S - 18
  const yCaption = options.showMonthLabel ? S - 62 : S - 18

  if (options.showMonthLabel) {
    ctx.font        = `bold ${Math.round(S * 0.08)}px Arial, sans-serif`
    ctx.fillStyle   = '#FFFFFF'
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur  = 10
    ctx.fillText(MONTH_LABELS[month - 1], S - 14, yMonth)
    ctx.shadowBlur  = 0
  }

  if (options.showCaption && photo.caption) {
    const capFontSize = Math.round(S * 0.052)
    const capLineH    = Math.round(capFontSize * 1.3)
    ctx.font          = `${capFontSize}px Arial, sans-serif`
    ctx.fillStyle     = 'rgba(255,255,255,0.82)'
    ctx.shadowColor   = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur    = 7
    const capLines    = wrapCanvasText(ctx, photo.caption, S - 28)
    capLines.reverse().forEach((ln, idx) => {
      ctx.fillText(ln, S - 14, yCaption - idx * capLineH)
    })
    ctx.shadowBlur = 0
  }
}

// ── ZIP export pipeline ────────────────────────────────────────────────────────

async function renderPage(photo, month) {
  const canvas  = document.createElement('canvas')
  canvas.width  = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#FFFAF5'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  const img    = await loadImageCrossOrigin(photo.photo_url)
  const filter = getEffect(photo.effect_id).filter
  if (filter) ctx.filter = filter
  drawCover(ctx, img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.filter = 'none'

  const frameColor = getFrame(photo.frame_id ?? 'none').canvasColor
  if (frameColor) {
    ctx.strokeStyle = frameColor
    ctx.lineWidth   = CANVAS_FRAME_WIDTH
    ctx.strokeRect(
      CANVAS_FRAME_WIDTH / 2,
      CANVAS_FRAME_WIDTH / 2,
      CANVAS_SIZE - CANVAS_FRAME_WIDTH,
      CANVAS_SIZE - CANVAS_FRAME_WIDTH
    )
  }

  const bandH = 200
  const grad  = ctx.createLinearGradient(0, CANVAS_SIZE - bandH, 0, CANVAS_SIZE)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.68)')
  ctx.fillStyle = grad
  ctx.fillRect(0, CANVAS_SIZE - bandH, CANVAS_SIZE, bandH)

  ctx.fillStyle = '#FFFFFF'
  ctx.font      = 'bold 80px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.direction = 'rtl'
  ctx.fillText(MONTH_LABELS[month - 1], CANVAS_SIZE - 80, CANVAS_SIZE - 90)

  if (photo.caption) {
    const capFontSize = 52
    const capLineH    = Math.round(capFontSize * 1.3)
    ctx.font          = `${capFontSize}px Arial, sans-serif`
    ctx.fillStyle     = 'rgba(255,255,255,0.82)'
    const capLines    = wrapCanvasText(ctx, photo.caption, CANVAS_SIZE - 160)
    capLines.reverse().forEach((ln, i) => {
      ctx.fillText(ln, CANVAS_SIZE - 80, CANVAS_SIZE - 28 - i * capLineH)
    })
  }

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

  for (let i = 0; i < photos.length; i++) {
    const [monthStr, photo] = photos[i]
    const month = Number(monthStr)
    onProgress(i + 1)

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = GIF_SIZE
    const ctx = canvas.getContext('2d')
    const img = await loadImageCrossOrigin(photo.photo_url)
    await drawAlbumFrame(ctx, GIF_SIZE, img, photo, month, options)

    const rgba    = ctx.getImageData(0, 0, GIF_SIZE, GIF_SIZE).data
    const palette = quantize(rgba, 256)
    const index   = applyPalette(rgba, palette)

    gif.writeFrame(index, GIF_SIZE, GIF_SIZE, {
      palette,
      delay:  GIF_SPEED_MS[options.speed ?? 'normal'],
      repeat: 0,
    })
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
    videoBitsPerSecond: 12_000_000,
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

  // Phase 3: recording
  for (let i = 0; i < photos.length; i++) {
    onProgress({ phase: 'recording', step: i + 1, total: photos.length })

    ctx.drawImage(offscreens[i], 0, 0)
    await waitMs(frameDurationMs)

    if (i < photos.length - 1) {
      const stepMs = Math.round(TRANSITION_MS / TRANSITION_STEPS)
      for (let f = 1; f <= TRANSITION_STEPS; f++) {
        ctx.globalAlpha = 1
        ctx.drawImage(offscreens[i], 0, 0)
        ctx.globalAlpha = f / TRANSITION_STEPS
        ctx.drawImage(offscreens[i + 1], 0, 0)
        ctx.globalAlpha = 1
        await waitMs(stepMs)
      }
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
