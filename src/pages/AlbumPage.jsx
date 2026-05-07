import { useState } from 'react'
import {
  BookImage, Camera, Pencil, Trash2, Download,
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

  const [editMonth, setEditMonth] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportStep, setExportStep] = useState(0)
  const [exportDone, setExportDone] = useState(false)

  const filled = Object.keys(byMonth).length
  // First month with no photo — highlighted as "next step" for the user
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
              maxLength={80}
              rows={2}
              placeholder={isBday ? 'שנה שלמה של אהבה...' : 'תאר את הרגע הקסום...'}
              className="w-full font-rubik text-brown-800 text-sm bg-transparent resize-none outline-none placeholder-brown-400 leading-relaxed"
              dir="rtl"
            />
            <p className="font-rubik text-brown-400 text-[10px] text-left mt-0.5">{caption.length}/80</p>
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

  // Optional caption
  if (photo.caption) {
    ctx.font      = '52px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillText(photo.caption, CANVAS_SIZE - 80, CANVAS_SIZE - 28)
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

function loadImageCrossOrigin(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => {
      // Fallback: retry with no cache params (helps with some CDN CORS configs)
      const fb = new Image()
      fb.crossOrigin = 'anonymous'
      fb.onload  = () => resolve(fb)
      fb.onerror = reject
      fb.src = src.split('?')[0]
    }
    // Strip existing cache buster and add a fresh CORS-friendly param
    img.src = src.split('?')[0] + '?t=1'
  })
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw    = img.naturalWidth  * scale
  const sh    = img.naturalHeight * scale
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh)
}
