import { useState, useRef } from 'react'
import {
  BookImage, Camera, Pencil, Trash2, Download,
  ChevronLeft, X, Loader2, CheckCircle2,
} from 'lucide-react'
import { useApp } from '../hooks/useAppContext'
import { useChildren } from '../hooks/useChildren'
import { useMilestones } from '../hooks/useMilestones'
import { pickMilestonePhoto, uploadMilestonePhoto } from '../lib/imageUpload'
import { BottomSheet } from '../components/ui/BottomSheet'
import { PhotoSourceSheet } from '../components/ui/PhotoSourceSheet'
import { Spinner } from '../components/ui/Spinner'

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'חודש ראשון', 'חודש שני', 'חודש שלישי', 'חודש רביעי',
  'חודש חמישי', 'חודש שישי', 'חודש שביעי', 'חודש שמיני',
  'חודש תשיעי', 'חודש עשירי', 'חודש אחד עשר', 'שנה!  🎂',
]

const EFFECTS = [
  { id: 'none',     label: 'רגיל',     filter: '',                           preview: 'bg-gradient-to-br from-amber-50 to-amber-100' },
  { id: 'sepia',    label: 'ספייה',    filter: 'sepia(0.6)',                  preview: 'bg-gradient-to-br from-yellow-100 to-amber-200' },
  { id: 'bw',       label: 'שחור-לבן', filter: 'grayscale(1)',               preview: 'bg-gradient-to-br from-gray-100 to-gray-300' },
  { id: 'warm',     label: 'חם',       filter: 'sepia(0.25) brightness(1.08)',preview: 'bg-gradient-to-br from-orange-50 to-orange-200' },
  { id: 'bright',   label: 'בהיר',     filter: 'brightness(1.2) contrast(0.95)', preview: 'bg-gradient-to-br from-blue-50 to-sky-100' },
]

const FRAMES = [
  { id: 'none',      label: 'ללא',      style: '' },
  { id: 'white',     label: 'לבן',      style: 'ring-[6px] ring-white' },
  { id: 'cream',     label: 'קרם',      style: 'ring-[6px] ring-amber-100' },
  { id: 'gold',      label: 'זהב',      style: 'ring-[5px] ring-amber-400' },
  { id: 'dark',      label: 'כהה',      style: 'ring-[5px] ring-brown-800' },
]

function effectFilter(effectId) {
  return EFFECTS.find(e => e.id === effectId)?.filter ?? ''
}
function frameClass(frameId) {
  return FRAMES.find(f => f.id === frameId)?.style ?? ''
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AlbumPage() {
  const { identity } = useApp()
  const { children } = useChildren(identity.familyId)
  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null

  const { byMonth, loading, upsertPhoto, deletePhoto } = useMilestones(
    identity.familyId,
    activeChild?.id ?? null
  )

  const [editMonth, setEditMonth]     = useState(null) // month 1-12 or null
  const [sourceOpen, setSourceOpen]   = useState(false)
  const [exporting, setExporting]     = useState(false)
  const [exportStep, setExportStep]   = useState(0)
  const [exportDone, setExportDone]   = useState(false)

  const filled = Object.keys(byMonth).length

  function openEdit(month) {
    setEditMonth(month)
  }

  function handleExport() {
    exportAlbum({
      byMonth,
      childName: activeChild?.name ?? 'album',
      onProgress: setExportStep,
      onDone: () => { setExporting(false); setExportDone(true); setTimeout(() => setExportDone(false), 3000) },
    })
    setExporting(true)
    setExportStep(0)
  }

  if (!activeChild) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cream-100 border border-cream-200 flex items-center justify-center mb-4"
          style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
          <BookImage size={28} className="text-brown-400" />
        </div>
        <p className="font-rubik font-semibold text-brown-600">הוסף ילד/ה תחילה</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-rubik font-bold text-2xl text-brown-800 leading-tight">
            שנה ראשונה
          </h1>
          <p className="font-rubik text-brown-400 text-sm mt-0.5">{activeChild.name}</p>
        </div>

        {/* Progress chip */}
        <div
          className="flex items-center gap-2 bg-white rounded-2xl px-3.5 py-2.5 border border-cream-200"
          style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
        >
          <div className="flex gap-0.5">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="w-1.5 h-4 rounded-full"
                style={{ backgroundColor: byMonth[i + 1] ? '#E8B84B' : '#F5E6D3' }}
              />
            ))}
          </div>
          <span className="font-rubik font-bold text-brown-700 text-sm">{filled}/12</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* 3×4 Grid */}
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, i) => {
              const month = i + 1
              const photo = byMonth[month]
              return (
                <MonthCell
                  key={month}
                  month={month}
                  photo={photo}
                  onTap={() => openEdit(month)}
                />
              )
            })}
          </div>

          {/* Export button */}
          <div className="mt-6">
            {exportDone ? (
              <div className="flex items-center justify-center gap-2 py-4 rounded-3xl bg-green-50 border border-green-200">
                <CheckCircle2 size={20} className="text-green-500" />
                <span className="font-rubik font-bold text-green-700">הורד בהצלחה!</span>
              </div>
            ) : exporting ? (
              <div
                className="flex flex-col items-center gap-2 py-4 rounded-3xl border border-cream-200 bg-white"
                style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08)' }}
              >
                <Loader2 size={22} className="text-brown-400 animate-spin" />
                <p className="font-rubik text-brown-500 text-sm">
                  מייצר תמונה {exportStep} מתוך {filled}...
                </p>
              </div>
            ) : (
              <button
                onClick={handleExport}
                disabled={filled === 0}
                className="w-full py-4 rounded-3xl font-rubik font-black text-white text-lg flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #A07050, #8B5E3C)',
                  boxShadow: '0 6px 24px rgba(139,94,60,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                <Download size={20} />
                ייצא לאלבום הדפסה
              </button>
            )}
            {filled > 0 && !exporting && !exportDone && (
              <p className="font-rubik text-brown-400 text-xs text-center mt-2">
                מוריד {filled} תמונות כ-ZIP • מתאים לכל שירות הדפסה
              </p>
            )}
          </div>
        </>
      )}

      {/* Edit sheet */}
      {editMonth !== null && (
        <EditMonthSheet
          month={editMonth}
          photo={byMonth[editMonth] ?? null}
          childId={activeChild.id}
          familyId={identity.familyId}
          onSave={async (data) => {
            await upsertPhoto({ month: editMonth, ...data })
            setEditMonth(null)
          }}
          onDelete={async () => {
            await deletePhoto(editMonth)
            setEditMonth(null)
          }}
          onClose={() => setEditMonth(null)}
        />
      )}
    </div>
  )
}

// ── Month cell ────────────────────────────────────────────────────────────────

function MonthCell({ month, photo, onTap }) {
  const filter  = effectFilter(photo?.effect_id)
  const frame   = frameClass(photo?.frame_id)
  const isLast  = month === 12

  return (
    <button
      onClick={onTap}
      className="relative aspect-square rounded-2xl overflow-hidden active:scale-[0.96] transition-transform border border-cream-200"
      style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' }}
    >
      {photo ? (
        <>
          <img
            src={photo.photo_url}
            alt={`חודש ${month}`}
            className={`w-full h-full object-cover ${frame}`}
            style={{ filter: filter || undefined }}
          />
          {/* Month badge */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
            <p className="font-rubik font-bold text-white text-[10px] leading-tight truncate">
              {MONTH_LABELS[month - 1]}
            </p>
            {photo.caption && (
              <p className="font-rubik text-white/80 text-[9px] leading-tight truncate">{photo.caption}</p>
            )}
          </div>
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-lg bg-white/80 flex items-center justify-center">
            <Pencil size={10} className="text-brown-600" />
          </div>
        </>
      ) : (
        <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 ${isLast ? 'bg-amber-50' : 'bg-cream-50'}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isLast ? 'bg-amber-100' : 'bg-cream-200'}`}>
            <Camera size={16} className={isLast ? 'text-amber-600' : 'text-brown-400'} />
          </div>
          <p className={`font-rubik font-bold text-[10px] text-center leading-tight px-1 ${isLast ? 'text-amber-700' : 'text-brown-400'}`}>
            {MONTH_LABELS[month - 1]}
          </p>
        </div>
      )}
    </button>
  )
}

// ── Edit bottom sheet ─────────────────────────────────────────────────────────

function EditMonthSheet({ month, photo, childId, familyId, onSave, onDelete, onClose }) {
  const [caption,   setCaption]   = useState(photo?.caption   ?? '')
  const [effectId,  setEffectId]  = useState(photo?.effect_id ?? 'none')
  const [frameId,   setFrameId]   = useState(photo?.frame_id  ?? 'none')
  const [photoUrl,  setPhotoUrl]  = useState(photo?.photo_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const filter = effectFilter(effectId)
  const frame  = frameClass(frameId)

  async function handlePickPhoto(mode) {
    try {
      setUploading(true)
      const result = await pickMilestonePhoto({ mode })
      if (!result) return
      const url = await uploadMilestonePhoto({ childId, month, blob: result.blob, mime: result.mime })
      setPhotoUrl(url)
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!photoUrl) return
    setSaving(true)
    try {
      await onSave({ photoUrl, caption, frameId, effectId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <BottomSheet isOpen onClose={onClose} title={MONTH_LABELS[month - 1]}>
        <div className="space-y-4 pb-2">

          {/* Photo preview / upload area */}
          <div
            className="relative w-full aspect-square rounded-2xl overflow-hidden border border-cream-200"
            style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07)' }}
          >
            {uploading ? (
              <div className="w-full h-full bg-cream-100 flex flex-col items-center justify-center gap-2">
                <Loader2 size={28} className="text-brown-400 animate-spin" />
                <p className="font-rubik text-brown-400 text-sm">מעלה תמונה...</p>
              </div>
            ) : photoUrl ? (
              <>
                <img
                  src={photoUrl}
                  alt="preview"
                  className={`w-full h-full object-cover ${frame}`}
                  style={{ filter: filter || undefined }}
                />
                <button
                  onClick={() => setSourceOpen(true)}
                  className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/50 rounded-xl px-2.5 py-1.5"
                >
                  <Camera size={13} className="text-white" />
                  <span className="font-rubik text-white text-xs font-semibold">החלף</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setSourceOpen(true)}
                className="w-full h-full bg-cream-50 flex flex-col items-center justify-center gap-3 active:bg-cream-100 transition-colors"
              >
                <div className="w-14 h-14 rounded-2xl bg-cream-200 flex items-center justify-center"
                  style={{ boxShadow: 'inset 0 2px 4px rgba(61,43,31,0.08)' }}>
                  <Camera size={26} className="text-brown-400" />
                </div>
                <p className="font-rubik font-semibold text-brown-500 text-sm">הוסף תמונה</p>
                <p className="font-rubik text-brown-300 text-xs">איכות מלאה לאלבום הדפסה</p>
              </button>
            )}
          </div>

          {/* Caption */}
          <div
            className="bg-white rounded-2xl px-4 py-3 border border-cream-200"
            style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.04), inset 0 1px 0 rgba(255,255,255,0.9)' }}
          >
            <label className="font-rubik text-brown-500 text-xs font-semibold block mb-1.5">כיתוב</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={80}
              rows={2}
              placeholder="תיאור רגע קסום..."
              className="w-full font-rubik text-brown-800 text-sm bg-transparent resize-none outline-none placeholder-brown-300 leading-relaxed"
              dir="rtl"
            />
            <p className="font-rubik text-brown-300 text-[10px] text-left mt-0.5">{caption.length}/80</p>
          </div>

          {/* Effect picker */}
          <div>
            <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">אפקט</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {EFFECTS.map(ef => (
                <button
                  key={ef.id}
                  onClick={() => setEffectId(ef.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all active:scale-95 ${
                    effectId === ef.id ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-cream-50'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${ef.preview} overflow-hidden`}
                    style={{ filter: ef.filter || undefined }}
                  >
                    {photoUrl && (
                      <img src={photoUrl} alt="" className="w-full h-full object-cover" style={{ filter: ef.filter || undefined }} />
                    )}
                  </div>
                  <span className={`font-rubik text-[11px] font-semibold ${effectId === ef.id ? 'text-amber-600' : 'text-brown-400'}`}>
                    {ef.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Frame picker */}
          <div>
            <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">מסגרת</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {FRAMES.map(fr => (
                <button
                  key={fr.id}
                  onClick={() => setFrameId(fr.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all active:scale-95 ${
                    frameId === fr.id ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-cream-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-cream-200 overflow-hidden ${fr.style}`}>
                    {photoUrl && (
                      <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <span className={`font-rubik text-[11px] font-semibold ${frameId === fr.id ? 'text-amber-600' : 'text-brown-400'}`}>
                    {fr.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={handleSave}
            disabled={!photoUrl || saving}
            className="w-full py-4 rounded-3xl font-rubik font-black text-white text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #A07050, #8B5E3C)',
              boxShadow: '0 6px 20px rgba(139,94,60,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            שמור חודש {month}
          </button>

          {photo && (
            confirmDel ? (
              <div className="flex gap-2">
                <button
                  onClick={onDelete}
                  className="flex-1 py-3 rounded-2xl font-rubik font-bold text-sm text-white bg-red-500 active:scale-95 transition-transform"
                >
                  כן, מחק
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="flex-1 py-3 rounded-2xl font-rubik font-bold text-sm text-brown-600 bg-cream-100 active:scale-95 transition-transform"
                >
                  ביטול
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-rubik text-sm text-red-400 active:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
                מחק תמונה
              </button>
            )
          )}
        </div>
      </BottomSheet>

      <PhotoSourceSheet
        isOpen={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onPick={handlePickPhoto}
        title="תמונת אלבום"
      />
    </>
  )
}

// ── Export pipeline (native Canvas + JSZip lazy) ──────────────────────────────

const CANVAS_SIZE  = 2100 // 7 inches × 300 DPI
const FRAME_COLORS = { none: null, white: '#FFFFFF', cream: '#FFF8F0', gold: '#F5C842', dark: '#3D2B1F' }
const FRAME_WIDTH  = 60

async function exportAlbum({ byMonth, childName, onProgress, onDone }) {
  const JSZip = (await import('jszip')).default
  const zip   = new JSZip()

  const photos = Object.entries(byMonth)
    .sort(([a], [b]) => Number(a) - Number(b))

  for (let i = 0; i < photos.length; i++) {
    const [monthStr, photo] = photos[i]
    const month = Number(monthStr)
    onProgress(i + 1)

    const blob = await renderPage(photo, month)
    zip.file(`month-${String(month).padStart(2, '0')}-${MONTH_LABELS[month - 1]}.jpg`, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url     = URL.createObjectURL(zipBlob)
  const a       = document.createElement('a')
  a.href        = url
  a.download    = `${childName}-שנה-ראשונה.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  onDone()
}

async function renderPage(photo, month) {
  const canvas = document.createElement('canvas')
  canvas.width  = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#FFFAF5'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Photo
  const img = await loadImageCrossOrigin(photo.photo_url)
  const ef  = EFFECTS.find(e => e.id === photo.effect_id)?.filter ?? ''
  if (ef) ctx.filter = ef
  drawCover(ctx, img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.filter = 'none'

  // Frame border
  const frameColor = FRAME_COLORS[photo.frame_id ?? 'none']
  if (frameColor) {
    ctx.strokeStyle = frameColor
    ctx.lineWidth   = FRAME_WIDTH
    ctx.strokeRect(FRAME_WIDTH / 2, FRAME_WIDTH / 2, CANVAS_SIZE - FRAME_WIDTH, CANVAS_SIZE - FRAME_WIDTH)
  }

  // Month label band at bottom
  const bandH = 180
  const grad  = ctx.createLinearGradient(0, CANVAS_SIZE - bandH, 0, CANVAS_SIZE)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = grad
  ctx.fillRect(0, CANVAS_SIZE - bandH, CANVAS_SIZE, bandH)

  ctx.fillStyle = '#FFFFFF'
  ctx.font      = 'bold 80px sans-serif'
  ctx.textAlign = 'right'
  ctx.direction = 'rtl'
  ctx.fillText(MONTH_LABELS[month - 1], CANVAS_SIZE - 80, CANVAS_SIZE - 90)

  if (photo.caption) {
    ctx.font      = '52px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(photo.caption, CANVAS_SIZE - 80, CANVAS_SIZE - 28)
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

function loadImageCrossOrigin(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = reject
    // Strip cache-buster for CORS requests so the cached response is reused
    img.src = src.replace(/\?v=\d+$/, '') + '?t=1'
  })
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw    = img.naturalWidth  * scale
  const sh    = img.naturalHeight * scale
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh)
}
