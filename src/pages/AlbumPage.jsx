import { useState } from 'react'
import {
  BookImage, Camera, Pencil, Trash2, Download, Film,
  Loader2, CheckCircle2, Sparkles,
} from 'lucide-react'
import { useApp } from '../hooks/useAppContext'
import { useChildren } from '../hooks/useChildren'
import { useMilestones } from '../hooks/useMilestones'
import { pickMilestonePhoto, uploadMilestonePhoto } from '../lib/imageUpload'
import { BottomSheet } from '../components/ui/BottomSheet'
import { PhotoSourceSheet } from '../components/ui/PhotoSourceSheet'
import { Spinner } from '../components/ui/Spinner'

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'חודש ראשון', 'חודש שני', 'חודש שלישי', 'חודש רביעי',
  'חודש חמישי', 'חודש שישי', 'חודש שביעי', 'חודש שמיני',
  'חודש תשיעי', 'חודש עשירי', 'חודש אחד עשר', 'שנה ראשונה',
]

// ASCII-safe names for ZIP filenames (avoid Hebrew/emoji on Windows)
const MONTH_FILENAMES = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12-birthday',
]

const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const EFFECTS = [
  { id: 'none',   label: 'רגיל',     filter: '',                                previewBg: '#FFF8F0' },
  { id: 'warm',   label: 'חם',       filter: 'sepia(0.25) brightness(1.08)',    previewBg: '#FED7AA' },
  { id: 'sepia',  label: 'ספייה',    filter: 'sepia(0.6)',                      previewBg: '#FDE68A' },
  { id: 'bw',     label: 'שחור-לבן', filter: 'grayscale(1)',                    previewBg: '#D1D5DB' },
  { id: 'bright', label: 'בהיר',     filter: 'brightness(1.18) contrast(0.95)', previewBg: '#BAE6FD' },
]

// insetPx / color are used for the UI inset-shadow frame overlay (works inside overflow-hidden)
// canvasColor is used by the Canvas export pipeline
const FRAMES = [
  { id: 'none',  label: 'ללא',  insetPx: 0,  color: null,      canvasColor: null },
  { id: 'white', label: 'לבן',  insetPx: 6,  color: '#FFFFFF', canvasColor: '#FFFFFF' },
  { id: 'cream', label: 'קרם',  insetPx: 6,  color: '#FFF8F0', canvasColor: '#FFF8F0' },
  { id: 'gold',  label: 'זהב',  insetPx: 5,  color: '#F5C842', canvasColor: '#F5C842' },
  { id: 'dark',  label: 'כהה',  insetPx: 5,  color: '#3D2B1F', canvasColor: '#3D2B1F' },
]

function getEffect(effectId) { return EFFECTS.find(e => e.id === effectId) ?? EFFECTS[0] }
function getFrame(frameId)   { return FRAMES.find(f => f.id === frameId)   ?? FRAMES[0] }

// ── Main page ──────────────────────────────────────────────────────────────────

export function AlbumPage() {
  const { identity } = useApp()
  const { children } = useChildren(identity.familyId)
  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null

  const { byMonth, loading, upsertPhoto, deletePhoto } = useMilestones(
    identity.familyId,
    activeChild?.id ?? null
  )

  const [editMonth,    setEditMonth]    = useState(null)
  const [exporting,    setExporting]    = useState(false)
  const [exportStep,   setExportStep]   = useState(0)
  const [exportDone,   setExportDone]   = useState(false)

  const [gifSheetOpen,  setGifSheetOpen]  = useState(false)
  const [gifGenerating, setGifGenerating] = useState(false)
  const [gifStep,       setGifStep]       = useState(0)
  const [gifDone,       setGifDone]       = useState(false)
  const [gifOptions,    setGifOptions]    = useState({
    showDate:       true,
    showCaption:    true,
    showMonthLabel: true,
    speed:          'normal',   // 'slow' | 'normal' | 'fast'
    effectOverride: null,       // null = use each photo's saved effect
  })

  const filled     = Object.keys(byMonth).length
  const nextToFill = Array.from({ length: 12 }, (_, i) => i + 1).find(m => !byMonth[m]) ?? null

  function handleExport() {
    setExporting(true)
    setExportStep(0)
    exportAlbum({
      byMonth,
      childName: activeChild?.name ?? 'album',
      onProgress: setExportStep,
      onDone: () => {
        setExporting(false)
        setExportDone(true)
        setTimeout(() => setExportDone(false), 3500)
      },
    })
  }

  function handleGifGenerate() {
    setGifSheetOpen(false)
    setGifGenerating(true)
    setGifStep(0)
    generateAlbumGif({
      byMonth,
      childName: activeChild?.name ?? 'album',
      options: gifOptions,
      onProgress: setGifStep,
      onDone: () => {
        setGifGenerating(false)
        setGifDone(true)
        setTimeout(() => setGifDone(false), 3500)
      },
    })
  }

  // ── No child guard ──
  if (!activeChild) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center" dir="rtl">
        <div
          className="w-20 h-20 rounded-3xl bg-cream-100 border border-cream-200 flex items-center justify-center mb-5"
          style={{ boxShadow: '0 6px 24px rgba(61,43,31,0.09), inset 0 1px 0 rgba(255,255,255,0.9)' }}
        >
          <BookImage size={32} className="text-brown-400" />
        </div>
        <p className="font-rubik font-bold text-brown-700 text-lg mb-1.5">האלבום מחכה</p>
        <p className="font-rubik text-brown-400 text-sm leading-relaxed">
          הוסף ילד/ה כדי להתחיל<br />את מסע השנה הראשונה
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-6" dir="rtl">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-rubik font-black text-2xl text-brown-800 leading-tight">
            שנה ראשונה
          </h1>
          <p className="font-rubik text-brown-400 text-sm mt-0.5">
            {filled > 0
              ? `${activeChild.name} · ${filled}/12 חודשים`
              : `מסע השנה הראשונה של ${activeChild.name}`}
          </p>
        </div>

        {/* Progress bar — variable-height dots, taller when filled */}
        <div
          className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 border border-cream-200 flex-shrink-0"
          style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
        >
          <div className="flex gap-[3px] items-end">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width:           byMonth[i + 1] ? 6  : 4,
                  height:          byMonth[i + 1] ? 16 : 10,
                  backgroundColor: byMonth[i + 1] ? '#E8B84B' : '#F5E6D3',
                }}
              />
            ))}
          </div>
          <span className="font-rubik font-bold text-brown-700 text-sm">{filled}/12</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* ── Emotional empty-state banner (only when album is brand new) ── */}
          {filled === 0 && (
            <div
              className="mb-5 rounded-3xl border border-amber-100 px-5 py-5 text-center"
              style={{
                background: 'linear-gradient(145deg, #FFFDF9 0%, #FFF8F0 100%)',
                boxShadow: '0 4px 20px rgba(232,184,75,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl bg-white border border-amber-100 flex items-center justify-center mx-auto mb-3"
                style={{ boxShadow: '0 4px 14px rgba(232,184,75,0.25), inset 0 1px 0 rgba(255,255,255,0.9)' }}
              >
                <Camera size={26} className="text-amber-400" />
              </div>
              <p className="font-rubik font-bold text-brown-700 text-sm mb-1.5">
                כל חודש הוא פרק חדש
              </p>
              <p className="font-rubik text-brown-400 text-xs leading-relaxed">
                לחצי על חודש ראשון כדי להתחיל<br />
                את מסע השנה הראשונה של {activeChild.name}
              </p>
            </div>
          )}

          {/* ── 3 × 4 grid ── */}
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, i) => {
              const month = i + 1
              return (
                <MonthCell
                  key={month}
                  month={month}
                  photo={byMonth[month] ?? null}
                  isNext={month === nextToFill}
                  onTap={() => setEditMonth(month)}
                />
              )
            })}
          </div>

          {/* ── Export ── */}
          <div className="mt-6">
            {/* ZIP export */}
            {exportDone ? (
              <div
                className="flex items-center justify-center gap-2.5 py-4 rounded-3xl border border-green-200"
                style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}
              >
                <CheckCircle2 size={20} className="text-green-500" />
                <span className="font-rubik font-bold text-green-700">הורד בהצלחה!</span>
              </div>
            ) : exporting ? (
              <div
                className="flex flex-col items-center gap-2.5 py-5 rounded-3xl border border-cream-200 bg-white"
                style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08)' }}
              >
                <Loader2 size={22} className="text-brown-400 animate-spin" />
                <p className="font-rubik text-brown-500 text-sm">
                  מכין תמונה {exportStep} מתוך {filled}...
                </p>
              </div>
            ) : (
              <button
                onClick={handleExport}
                disabled={filled === 0}
                className="w-full py-4 rounded-3xl font-rubik font-black text-white text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-40 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #A07050, #8B5E3C)',
                  boxShadow: '0 6px 24px rgba(139,94,60,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                <Download size={20} />
                שמור לזכרון — הורד אלבום
              </button>
            )}
            {filled > 0 && !exporting && !exportDone && (
              <p className="font-rubik text-brown-400 text-xs text-center mt-2">
                {filled} תמונות · ZIP לשירות הדפסה
              </p>
            )}

            {/* GIF export */}
            {filled > 0 && (
              <div className="mt-3">
                {gifDone ? (
                  <div
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-green-200"
                    style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}
                  >
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="font-rubik font-bold text-green-700 text-sm">GIF הורד בהצלחה!</span>
                  </div>
                ) : gifGenerating ? (
                  <div
                    className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-white border border-cream-200"
                    style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.06)' }}
                  >
                    <Loader2 size={16} className="text-amber-500 animate-spin" />
                    <span className="font-rubik text-brown-500 text-sm">
                      מקודד תמונה {gifStep} מתוך {filled}...
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setGifSheetOpen(true)}
                    className="w-full py-3.5 rounded-3xl font-rubik font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #FFF8E6, #FEF3C7)',
                      border: '1px solid rgba(232,184,75,0.4)',
                      color: '#8B5E3C',
                      boxShadow: '0 3px 12px rgba(232,184,75,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    <Film size={16} className="text-amber-500" />
                    צור GIF אנימציה
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Edit sheet ── */}
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

      {/* ── GIF options sheet ── */}
      {gifSheetOpen && (
        <GifOptionsSheet
          isOpen={gifSheetOpen}
          onClose={() => setGifSheetOpen(false)}
          options={gifOptions}
          onOptionsChange={setGifOptions}
          filled={filled}
          onGenerate={handleGifGenerate}
        />
      )}
    </div>
  )
}

// ── Month cell ─────────────────────────────────────────────────────────────────

function MonthCell({ month, photo, isNext, onTap }) {
  const isBday = month === 12
  const ef = getEffect(photo?.effect_id)
  const fr = getFrame(photo?.frame_id)

  return (
    <button
      onClick={onTap}
      className="relative aspect-square rounded-2xl overflow-hidden active:scale-[0.94] transition-transform cursor-pointer"
      style={{
        boxShadow: isNext
          ? '0 0 0 2.5px #E8B84B, 0 4px 20px rgba(232,184,75,0.3)'
          : isBday
          ? '0 0 0 2px rgba(245,200,66,0.45), 0 4px 16px rgba(61,43,31,0.07)'
          : '0 3px 12px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      {photo ? (
        <>
          {/* Photo layer */}
          <img
            src={photo.photo_url}
            alt={`חודש ${month}`}
            className="w-full h-full object-cover"
            style={{ filter: ef.filter || undefined }}
          />

          {/* Frame: inset box-shadow overlay — works inside overflow-hidden */}
          {fr.color && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: `inset 0 0 0 ${fr.insetPx}px ${fr.color}` }}
            />
          )}

          {/* Gradient + labels */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 px-2 pb-1.5">
            <p className="font-rubik font-bold text-white text-[10px] leading-tight truncate">
              {MONTH_LABELS[month - 1]}
            </p>
            {photo.caption && (
              <p className="font-rubik text-white/70 text-[8px] leading-tight truncate">{photo.caption}</p>
            )}
          </div>

          {/* Edit badge */}
          <div className="absolute top-1.5 left-1.5 w-[22px] h-[22px] rounded-lg bg-black/35 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <Pencil size={10} className="text-white" />
          </div>

          {/* Birthday sparkle badge */}
          {isBday && (
            <div className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded-lg bg-amber-400/90 flex items-center justify-center pointer-events-none">
              <Sparkles size={11} className="text-white" />
            </div>
          )}
        </>
      ) : (
        /* ── Empty cell ── */
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-1"
          style={{
            background: isBday
              ? 'linear-gradient(145deg, #FFF8E6, #FEF3C7)'
              : 'linear-gradient(145deg, #FFFDF9, #FFF0E0)',
          }}
        >
          {/* Large faint month number — purely decorative background character */}
          <span
            className="absolute font-rubik font-black select-none pointer-events-none"
            style={{
              fontSize: '3rem',
              color: isBday ? 'rgba(245,200,66,0.22)' : 'rgba(201,149,108,0.14)',
              lineHeight: 1,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -60%)',
            }}
          >
            {month}
          </span>

          {/* Camera circle */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center relative z-10"
            style={{
              background: isNext
                ? 'linear-gradient(135deg, #E8B84B, #D4A030)'
                : isBday
                ? 'rgba(232,184,75,0.25)'
                : 'rgba(201,149,108,0.18)',
              boxShadow: isNext ? '0 2px 10px rgba(232,184,75,0.45)' : 'none',
            }}
          >
            <Camera
              size={13}
              className={isNext ? 'text-white' : isBday ? 'text-amber-500' : 'text-brown-400'}
            />
          </div>

          {/* Month label */}
          <p
            className="font-rubik font-semibold text-center leading-tight relative z-10 mt-0.5 px-1"
            style={{
              fontSize: 9,
              color: isBday ? '#B8883B' : isNext ? '#A07050' : '#C9956C',
            }}
          >
            {isNext ? 'הבא!' : MONTH_LABELS[month - 1]}
          </p>
        </div>
      )}
    </button>
  )
}

// ── Edit bottom sheet ──────────────────────────────────────────────────────────

function EditMonthSheet({ month, photo, childId, familyId, onSave, onDelete, onClose }) {
  const [caption,    setCaption]    = useState(photo?.caption   ?? '')
  const [effectId,   setEffectId]   = useState(photo?.effect_id ?? 'none')
  const [frameId,    setFrameId]    = useState(photo?.frame_id  ?? 'none')
  const [photoUrl,   setPhotoUrl]   = useState(photo?.photo_url ?? null)
  const [uploading,  setUploading]  = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const isBday = month === 12
  const ef = getEffect(effectId)
  const fr = getFrame(frameId)

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

  const sheetTitle = isBday ? `${MONTH_LABELS[month - 1]} ✨` : MONTH_LABELS[month - 1]

  return (
    <>
      <BottomSheet isOpen onClose={onClose} title={sheetTitle}>
        <div className="space-y-4 pb-2" dir="rtl">

          {/* ── Photo area (4:3 ratio — less cramped than square) ── */}
          <div
            className="relative w-full rounded-2xl overflow-hidden"
            style={{ aspectRatio: '4/3', boxShadow: '0 4px 20px rgba(61,43,31,0.1)' }}
          >
            {uploading ? (
              <div className="w-full h-full bg-cream-100 flex flex-col items-center justify-center gap-2.5">
                <Loader2 size={28} className="text-brown-400 animate-spin" />
                <p className="font-rubik text-brown-400 text-sm">מעלה תמונה...</p>
              </div>
            ) : photoUrl ? (
              <>
                <img
                  src={photoUrl}
                  alt="preview"
                  className="w-full h-full object-cover"
                  style={{ filter: ef.filter || undefined }}
                />
                {/* Frame overlay — inset shadow stays inside overflow-hidden */}
                {fr.color && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ boxShadow: `inset 0 0 0 ${fr.insetPx}px ${fr.color}` }}
                  />
                )}
                <button
                  onClick={() => setSourceOpen(true)}
                  className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/45 backdrop-blur-sm rounded-xl px-2.5 py-1.5 cursor-pointer active:opacity-80"
                >
                  <Camera size={13} className="text-white" />
                  <span className="font-rubik text-white text-xs font-semibold">החלף</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setSourceOpen(true)}
                className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-cream-50 to-cream-100 active:from-cream-100 transition-colors cursor-pointer"
              >
                <div
                  className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center"
                  style={{ boxShadow: '0 4px 14px rgba(61,43,31,0.1), inset 0 1px 0 rgba(255,255,255,0.9)' }}
                >
                  <Camera size={26} className="text-brown-400" />
                </div>
                <div className="text-center">
                  <p className="font-rubik font-bold text-brown-600 text-sm">הוסף תמונה</p>
                  <p className="font-rubik text-brown-400 text-xs mt-0.5">איכות מלאה לאלבום הדפסה</p>
                </div>
              </button>
            )}
          </div>

          {/* ── Caption ── */}
          <div
            className="rounded-2xl px-4 py-3 border border-cream-200 bg-white"
            style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.04), inset 0 1px 0 rgba(255,255,255,0.9)' }}
          >
            <label className="font-rubik text-brown-500 text-xs font-semibold block mb-1.5">כיתוב</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={60}
              rows={2}
              placeholder={isBday ? 'שנה שלמה של אהבה...' : 'תאר את הרגע הקסום...'}
              className="w-full font-rubik text-brown-800 text-sm bg-transparent resize-none outline-none placeholder-brown-400 leading-relaxed"
              dir="rtl"
            />
            <p className="font-rubik text-brown-400 text-[10px] text-left mt-0.5">{caption.length}/60</p>
          </div>

          {/* ── Effect picker ── */}
          <div>
            <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">אפקט</p>
            <div
              className="flex gap-2 pb-1"
              style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {EFFECTS.map(eff => (
                <button
                  key={eff.id}
                  onClick={() => setEffectId(eff.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all active:scale-95 cursor-pointer ${
                    effectId === eff.id ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-white'
                  }`}
                >
                  {/* Preview: real photo with filter, or colour swatch fallback */}
                  <div className="rounded-xl overflow-hidden" style={{ width: 52, height: 52 }}>
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={eff.label}
                        className="w-full h-full object-cover"
                        style={{ filter: eff.filter || undefined }}
                      />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundColor: eff.previewBg,
                          filter: eff.filter || undefined,
                        }}
                      />
                    )}
                  </div>
                  <span className={`font-rubik text-[11px] font-semibold ${effectId === eff.id ? 'text-amber-600' : 'text-brown-400'}`}>
                    {eff.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Frame picker ── */}
          <div>
            <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">מסגרת</p>
            <div
              className="flex gap-2 pb-1"
              style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {FRAMES.map(frm => (
                <button
                  key={frm.id}
                  onClick={() => setFrameId(frm.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all active:scale-95 cursor-pointer ${
                    frameId === frm.id ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-white'
                  }`}
                >
                  {/* Frame preview: inset shadow overlay shows actual frame */}
                  <div className="relative rounded-xl overflow-hidden" style={{ width: 52, height: 52 }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt={frm.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-cream-100" />
                    )}
                    {frm.color && (
                      <div
                        className="absolute inset-0"
                        style={{ boxShadow: `inset 0 0 0 ${frm.insetPx}px ${frm.color}` }}
                      />
                    )}
                  </div>
                  <span className={`font-rubik text-[11px] font-semibold ${frameId === frm.id ? 'text-amber-600' : 'text-brown-400'}`}>
                    {frm.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Save ── */}
          <button
            onClick={handleSave}
            disabled={!photoUrl || saving}
            className="w-full py-4 rounded-3xl font-rubik font-black text-white text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-40 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #A07050, #8B5E3C)',
              boxShadow: '0 6px 20px rgba(139,94,60,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'שומר...' : `שמור — ${MONTH_LABELS[month - 1]}`}
          </button>

          {/* ── Delete (two-step confirm) ── */}
          {photo && (
            confirmDel ? (
              <div className="flex gap-2">
                <button
                  onClick={onDelete}
                  className="flex-1 py-3 rounded-2xl font-rubik font-bold text-sm text-white bg-red-500 active:scale-95 transition-transform cursor-pointer"
                >
                  כן, מחק
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="flex-1 py-3 rounded-2xl font-rubik font-bold text-sm text-brown-600 bg-cream-100 active:scale-95 transition-transform cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-rubik text-sm text-red-400 active:bg-red-50 transition-colors cursor-pointer"
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

// ── GIF options sheet (control center) ────────────────────────────────────────

const GIF_SPEED_MS  = { slow: 4500, normal: 2800, fast: 1500 }   // gifenc expects ms → divides by 10 internally
const SPEED_OPTIONS = [
  { key: 'slow',   label: 'איטי',  sub: '4.5s' },
  { key: 'normal', label: 'רגיל',  sub: '2.8s' },
  { key: 'fast',   label: 'מהיר',  sub: '1.5s' },
]
const TEXT_TOGGLES  = [
  { key: 'showMonthLabel', label: 'שם החודש',  desc: 'כותרת חודש בתחתית כל תמונה' },
  { key: 'showDate',       label: 'תאריך',      desc: 'מה-EXIF או תאריך העלאה' },
  { key: 'showCaption',    label: 'כיתוב',      desc: 'הטקסט שנכתב לכל חודש' },
]

function GifOptionsSheet({ isOpen, onClose, options, onOptionsChange, filled, onGenerate }) {
  const totalSec = Math.round(filled * (GIF_SPEED_MS[options.speed] / 1000))

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="מרכז שליטה — GIF">
      <div className="space-y-4 pb-2" dir="rtl">

        {/* Info pill */}
        <p className="font-rubik text-brown-400 text-xs text-center -mt-1">
          {filled} {filled === 1 ? 'תמונה' : 'תמונות'} · כ-{totalSec} שניות סה״כ
        </p>

        {/* ── Speed segmented control ── */}
        <div>
          <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">מהירות</p>
          <div
            className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border border-cream-200"
            style={{ background: '#F0E4D6' }}
          >
            {SPEED_OPTIONS.map(({ key, label, sub }) => (
              <button
                key={key}
                onClick={() => onOptionsChange(o => ({ ...o, speed: key }))}
                className="py-2.5 rounded-xl transition-all cursor-pointer flex flex-col items-center active:scale-95"
                style={options.speed === key ? {
                  background: 'linear-gradient(135deg, #E8B84B, #D4A030)',
                  boxShadow: '0 3px 10px rgba(232,184,75,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
                } : {}}
              >
                <span className={`font-rubik font-bold text-sm leading-tight ${options.speed === key ? 'text-white' : 'text-brown-600'}`}>
                  {label}
                </span>
                <span className={`font-rubik text-[10px] ${options.speed === key ? 'text-white/70' : 'text-brown-400'}`}>
                  {sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Text overlay toggles ── */}
        <div>
          <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">שכבות טקסט</p>
          <div
            className="rounded-2xl border border-cream-200 bg-white overflow-hidden"
            style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.05), inset 0 1px 0 rgba(255,255,255,0.9)' }}
          >
            {TEXT_TOGGLES.map(({ key, label, desc }, idx) => (
              <div
                key={key}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx < TEXT_TOGGLES.length - 1 ? 'border-b border-cream-100' : ''
                }`}
              >
                <div>
                  <p className="font-rubik font-semibold text-brown-800 text-sm leading-tight">{label}</p>
                  <p className="font-rubik text-brown-400 text-[10px] mt-0.5">{desc}</p>
                </div>
                {/* Toggle — direction:ltr forces knob to slide LTR regardless of RTL parent */}
                <button
                  onClick={() => onOptionsChange(o => ({ ...o, [key]: !o[key] }))}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                    options[key] ? 'bg-amber-400' : 'bg-cream-200'
                  }`}
                  style={{ direction: 'ltr' }}
                  aria-label={label}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      options[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Global effect override ── */}
        <div>
          <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">
            אפקט <span className="font-normal text-brown-400 text-[10px]">עוקף את הגדרות כל תמונה בנפרד</span>
          </p>
          <div
            className="flex gap-2 pb-1"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* "Per photo" option — mosaic of the 4 effect preview colours */}
            <button
              onClick={() => onOptionsChange(o => ({ ...o, effectOverride: null }))}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 ${
                options.effectOverride === null ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-white'
              }`}
            >
              <div
                className="grid grid-cols-2 rounded-xl overflow-hidden"
                style={{ width: 52, height: 52, gap: 2, padding: 2, backgroundColor: '#FFF0E0' }}
              >
                {EFFECTS.slice(0, 4).map(e => (
                  <div
                    key={e.id}
                    className="rounded"
                    style={{ backgroundColor: e.previewBg, filter: e.filter || undefined }}
                  />
                ))}
              </div>
              <span className={`font-rubik text-[11px] font-semibold ${options.effectOverride === null ? 'text-amber-600' : 'text-brown-400'}`}>
                מקורי
              </span>
            </button>

            {/* Effect swatches */}
            {EFFECTS.map(eff => (
              <button
                key={eff.id}
                onClick={() => onOptionsChange(o => ({ ...o, effectOverride: eff.id }))}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 ${
                  options.effectOverride === eff.id ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-white'
                }`}
              >
                <div
                  className="rounded-xl"
                  style={{
                    width: 52, height: 52,
                    backgroundColor: eff.previewBg,
                    filter: eff.filter || undefined,
                  }}
                />
                <span className={`font-rubik text-[11px] font-semibold ${options.effectOverride === eff.id ? 'text-amber-600' : 'text-brown-400'}`}>
                  {eff.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={onGenerate}
          className="w-full py-4 rounded-3xl font-rubik font-black text-white text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #E8B84B, #D4A030)',
            boxShadow: '0 6px 20px rgba(232,184,75,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        >
          <Film size={18} />
          צור GIF
        </button>
      </div>
    </BottomSheet>
  )
}

// ── Export pipeline (Canvas + JSZip lazy-loaded) ───────────────────────────────

const CANVAS_SIZE        = 2100 // 7 inches × 300 DPI
const CANVAS_FRAME_WIDTH = 60

async function exportAlbum({ byMonth, childName, onProgress, onDone }) {
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
  const url = URL.createObjectURL(zipBlob)
  const a   = document.createElement('a')
  a.href    = url
  // ASCII-safe download filename (Hebrew chars stripped to avoid OS issues)
  a.download = `${childName.replace(/[^\w-]/g, '-')}-album.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  onDone()
}

async function renderPage(photo, month) {
  const canvas  = document.createElement('canvas')
  canvas.width  = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')

  // Warm off-white background
  ctx.fillStyle = '#FFFAF5'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Photo with effect filter
  const img    = await loadImageCrossOrigin(photo.photo_url)
  const filter = getEffect(photo.effect_id).filter
  if (filter) ctx.filter = filter
  drawCover(ctx, img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.filter = 'none'

  // Frame border (drawn after photo so it sits on top)
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

  // Gradient band at bottom
  const bandH = 200
  const grad  = ctx.createLinearGradient(0, CANVAS_SIZE - bandH, 0, CANVAS_SIZE)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.68)')
  ctx.fillStyle = grad
  ctx.fillRect(0, CANVAS_SIZE - bandH, CANVAS_SIZE, bandH)

  // Month label
  ctx.fillStyle = '#FFFFFF'
  ctx.font      = 'bold 80px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.direction = 'rtl'
  ctx.fillText(MONTH_LABELS[month - 1], CANVAS_SIZE - 80, CANVAS_SIZE - 90)

  // Optional caption — wrapped to max 2 lines so long text doesn't overflow
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

// ── GIF pipeline (gifenc + exifr, lazy-loaded) ─────────────────────────────────

const GIF_SIZE = 480

async function generateAlbumGif({ byMonth, childName, options, onProgress, onDone }) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')

  const gif    = GIFEncoder()
  const photos = Object.entries(byMonth).sort(([a], [b]) => Number(a) - Number(b))

  for (let i = 0; i < photos.length; i++) {
    const [monthStr, photo] = photos[i]
    const month = Number(monthStr)
    onProgress(i + 1)

    const rgba    = await renderGifFrame(photo, month, options)
    const palette = quantize(rgba, 256)
    const index   = applyPalette(rgba, palette)

    gif.writeFrame(index, GIF_SIZE, GIF_SIZE, {
      palette,
      delay: GIF_SPEED_MS[options.speed ?? 'normal'],
      repeat: 0,         // infinite loop
    })
  }

  gif.finish()

  const buffer = gif.bytes()
  const blob   = new Blob([buffer], { type: 'image/gif' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `${childName.replace(/[^\w-]/g, '-')}-album.gif`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  onDone()
}

async function renderGifFrame(photo, month, options) {
  const canvas  = document.createElement('canvas')
  canvas.width  = GIF_SIZE
  canvas.height = GIF_SIZE
  const ctx     = canvas.getContext('2d')
  const S       = GIF_SIZE

  ctx.fillStyle = '#FFFAF5'
  ctx.fillRect(0, 0, S, S)

  // Photo with effect (use global override if set, else each photo's own effect)
  const img    = await loadImageCrossOrigin(photo.photo_url)
  const filter = getEffect(options.effectOverride ?? photo.effect_id).filter
  if (filter) ctx.filter = filter
  drawCover(ctx, img, 0, 0, S, S)
  ctx.filter = 'none'

  // Frame border
  const fr = getFrame(photo.frame_id ?? 'none')
  if (fr.canvasColor) {
    const fw        = Math.round(fr.insetPx * (S / 100))
    ctx.strokeStyle = fr.canvasColor
    ctx.lineWidth   = fw
    ctx.strokeRect(fw / 2, fw / 2, S - fw, S - fw)
  }

  // Bottom gradient for text readability
  const bandH = Math.round(S * 0.34)
  const grad  = ctx.createLinearGradient(0, S - bandH, 0, S)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = grad
  ctx.fillRect(0, S - bandH, S, bandH)

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'

  // Date — small badge at top, extracted from EXIF or created_at
  if (options.showDate) {
    const dateStr = await getPhotoDate(photo)
    if (dateStr) {
      // Subtle dark vignette at top for date readability
      const topGrad = ctx.createLinearGradient(0, 0, 0, 56)
      topGrad.addColorStop(0, 'rgba(0,0,0,0.38)')
      topGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = topGrad
      ctx.fillRect(0, 0, S, 56)

      ctx.font         = `bold ${Math.round(S * 0.038)}px Arial, sans-serif`
      ctx.fillStyle    = 'rgba(255,255,255,0.88)'
      ctx.shadowColor  = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur   = 5
      ctx.fillText(dateStr, S - 12, 26)
      ctx.shadowBlur   = 0
    }
  }

  // Month label — position at bottom, caption sits above it
  const yMonth   = S - 18
  const yCaption = options.showMonthLabel ? S - 62 : S - 18

  if (options.showMonthLabel) {
    ctx.font         = `bold ${Math.round(S * 0.08)}px Arial, sans-serif`
    ctx.fillStyle    = '#FFFFFF'
    ctx.shadowColor  = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur   = 10
    ctx.fillText(MONTH_LABELS[month - 1], S - 14, yMonth)
    ctx.shadowBlur   = 0
  }

  if (options.showCaption && photo.caption) {
    const capFontSize = Math.round(S * 0.052)
    const capLineH    = Math.round(capFontSize * 1.3)
    ctx.font          = `${capFontSize}px Arial, sans-serif`
    ctx.fillStyle     = 'rgba(255,255,255,0.82)'
    ctx.shadowColor   = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur    = 7
    const capLines    = wrapCanvasText(ctx, photo.caption, S - 28)
    capLines.reverse().forEach((ln, i) => {
      ctx.fillText(ln, S - 14, yCaption - i * capLineH)
    })
    ctx.shadowBlur    = 0
  }

  return ctx.getImageData(0, 0, S, S).data
}

async function getPhotoDate(photo) {
  // Try EXIF first (requires CORS-enabled fetch of the image)
  try {
    const exifr = await import('exifr')
    const data  = await exifr.parse(photo.photo_url.split('?')[0], ['DateTimeOriginal', 'DateTime'])
    const d     = data?.DateTimeOriginal ?? data?.DateTime
    if (d) return formatHebrewDate(d)
  } catch { /* EXIF not available — fall through */ }

  // Fallback: use the DB record's created_at timestamp
  if (photo.created_at) return formatHebrewDate(new Date(photo.created_at))
  return null
}

function formatHebrewDate(d) {
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return null
  const day  = String(dt.getDate()).padStart(2, '0')
  const mon  = HE_MONTHS[dt.getMonth()]
  const year = dt.getFullYear()
  return `${day} ${mon} ${year}`
}

// ── Shared canvas helpers ──────────────────────────────────────────────────────

// Splits `text` into lines that fit within `maxWidth` px (at the current ctx font).
// Returns at most `maxLines` lines; the last line is truncated with "…" if needed.
function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
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

  // Truncate last line with ellipsis if it still overflows
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

function loadImageCrossOrigin(src) {
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
    // Do NOT replace it with a constant like ?t=1 which defeats the cache-buster.
    img.src = src
  })
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw    = img.naturalWidth  * scale
  const sh    = img.naturalHeight * scale
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh)
}
