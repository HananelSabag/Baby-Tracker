import { useState, useRef, useEffect, cloneElement } from 'react'
import {
  BookImage, Camera, Pencil, Trash2, Download, Film,
  Loader2, CheckCircle2, Sparkles, Video, FolderDown, ChevronLeft, AlertCircle,
} from 'lucide-react'
import { useApp } from '../hooks/useAppContext'
import { useChildren } from '../hooks/useChildren'
import { useMilestones } from '../hooks/useMilestones'
import { pickMilestonePhoto, uploadMilestonePhoto } from '../lib/imageUpload'
import { BottomSheet } from '../components/ui/BottomSheet'
import { PhotoSourceSheet } from '../components/ui/PhotoSourceSheet'
import { Spinner } from '../components/ui/Spinner'
import {
  MONTH_LABELS, EFFECTS, FRAMES, MUSIC_TRACKS, SUPABASE_MUSIC_URL,
  VIDEO_SIZE, TRANSITION_MS, TRANSITION_STEPS, GIF_SIZE, PREVIEW_SIZE,
  GIF_SPEED_MS, getEffect, getFrame,
} from '../lib/albumConstants'
import {
  exportAlbum, generateAlbumGif, generateAlbumVideo,
  drawAlbumFrame, loadImageCrossOrigin, triggerDownload, waitMs,
  getPhotoDate, formatAlbumTime,
} from '../lib/albumExport'

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

  // ZIP export
  const [exporting,    setExporting]    = useState(false)
  const [zipProgress,  setZipProgress]  = useState({ step: 0, total: 0 })
  const [exportDone,   setExportDone]   = useState(false)

  // Single export sheet — null | 'hub' | 'gif' | 'video'
  // One BottomSheet handles all three panels to avoid history-back collisions
  // when transitioning hub→gif or hub→video (BottomSheet pushes a history entry
  // on open; if two sheets open/close in the same render, one's cleanup calls
  // history.back() which the other's popstate handler treats as an OS back gesture
  // and immediately closes the newly-opened sheet).
  const [exportSheet, setExportSheet] = useState(null)

  // GIF export
  const [gifGenerating, setGifGenerating] = useState(false)
  const [gifProgress,   setGifProgress]   = useState({ step: 0, total: 0 })
  const [gifDone,       setGifDone]       = useState(false)
  const [gifOptions,    setGifOptions]    = useState({
    showDate:       true,
    showCaption:    true,
    showMonthLabel: true,
    speed:          'normal',
    effectOverride: null,
  })

  // Video export — progress has 3 phases: loading → rendering → recording
  const [videoGenerating, setVideoGenerating] = useState(false)
  const [videoProgress,   setVideoProgress]   = useState({ phase: 'loading', step: 0, total: 0 })
  const [videoDone,       setVideoDone]       = useState(false)
  const [videoOptions,    setVideoOptions]    = useState({
    showDate:       true,
    showCaption:    true,
    showMonthLabel: true,
    speed:          'normal',
    effectOverride: null,
    music:          null,
    musicStart:     0,
  })

  // Video preview audio — lifted here so closeExportSheet can stop it
  const videoAudioRef      = useRef(null)
  const [videoPlayingTrack, setVideoPlayingTrack] = useState(null)

  function stopVideoPreview() {
    if (videoAudioRef.current) { videoAudioRef.current.pause(); videoAudioRef.current = null }
    setVideoPlayingTrack(null)
  }

  function closeExportSheet() {
    stopVideoPreview()
    setExportSheet(null)
  }

  const filled     = Object.keys(byMonth).length
  const nextToFill = Array.from({ length: 12 }, (_, i) => i + 1).find(m => !byMonth[m]) ?? null

  function handleZipExport() {
    closeExportSheet()
    setExporting(true)
    setZipProgress({ step: 0, total: filled })
    exportAlbum({
      byMonth,
      childName: activeChild?.name ?? 'album',
      onProgress: (step) => setZipProgress({ step, total: filled }),
      onDone: () => {
        setExporting(false)
        setExportDone(true)
        setTimeout(() => setExportDone(false), 3500)
      },
    })
  }

  function handleGifGenerate() {
    closeExportSheet()
    setGifGenerating(true)
    setGifProgress({ step: 0, total: filled })
    generateAlbumGif({
      byMonth,
      childName: activeChild?.name ?? 'album',
      options: gifOptions,
      onProgress: (step) => setGifProgress({ step, total: filled }),
      onDone: () => {
        setGifGenerating(false)
        setGifDone(true)
        setTimeout(() => setGifDone(false), 3500)
      },
    }).catch(err => {
      setGifGenerating(false)
      alert(err.message ?? 'ייצוא GIF נכשל')
    })
  }

  function handleVideoGenerate() {
    stopVideoPreview()
    closeExportSheet()
    setVideoGenerating(true)
    setVideoProgress({ phase: 'loading', step: 0, total: filled })
    generateAlbumVideo({
      byMonth,
      childName: activeChild?.name ?? 'album',
      options: videoOptions,
      onProgress: setVideoProgress,
      onDone: () => {
        setVideoGenerating(false)
        setVideoDone(true)
        setTimeout(() => setVideoDone(false), 3500)
      },
    }).catch(err => {
      setVideoGenerating(false)
      alert(err.message ?? 'ייצוא וידאו נכשל')
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
              className="mb-5 rounded-3xl border border-amber-100 px-5 py-6 text-center"
              style={{
                background: 'linear-gradient(145deg, #FFFDF9 0%, #FFF8F0 100%)',
                boxShadow: '0 4px 20px rgba(232,184,75,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
              }}
            >
              {/* Floating camera icon */}
              <div className="relative w-fit mx-auto mb-3">
                {/* Sparkle dots */}
                <span
                  className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-amber-300 motion-safe:animate-ping"
                  style={{ animationDuration: '2s', animationDelay: '0s' }}
                />
                <span
                  className="absolute -bottom-1 -left-1 w-1.5 h-1.5 rounded-full bg-amber-200 motion-safe:animate-ping"
                  style={{ animationDuration: '2s', animationDelay: '0.7s' }}
                />
                <div
                  className="w-16 h-16 rounded-2xl bg-white border border-amber-100 flex items-center justify-center motion-safe:animate-float"
                  style={{ boxShadow: '0 4px 14px rgba(232,184,75,0.25), inset 0 1px 0 rgba(255,255,255,0.9)' }}
                >
                  <Camera size={28} className="text-amber-400" />
                </div>
              </div>
              <p className="font-rubik font-bold text-brown-700 text-sm mb-1.5">
                כל חודש הוא פרק חדש
              </p>
              <p className="font-rubik text-brown-400 text-xs leading-relaxed mb-3">
                לחצ{activeChild.gender === 'female' ? 'י' : ''} על חודש ראשון כדי להתחיל<br />
                את מסע השנה הראשונה של {activeChild.name}
              </p>
              {/* Animated arrow pointing down to the grid */}
              <div className="flex justify-center motion-safe:animate-bounce" style={{ animationDuration: '1.5s' }}>
                <ChevronLeft size={18} className="text-amber-400 rotate-[-90deg]" />
              </div>
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
          <div className="mt-6 space-y-2.5">

            {/* Progress cards — shown while busy or just finished */}
            {exporting && <ExportProgressCard type="zip" progress={zipProgress} />}
            {exportDone && <ExportDoneCard text="ZIP הורד בהצלחה! מוכן להדפסה" />}
            {gifGenerating && <ExportProgressCard type="gif" progress={gifProgress} />}
            {gifDone && <ExportDoneCard text="GIF הורד בהצלחה!" />}
            {videoGenerating && <ExportProgressCard type="video" progress={videoProgress} />}
            {videoDone && <ExportDoneCard text="וידאו הורד בהצלחה!" />}

            {/* Main export button — always visible when idle */}
            {!exporting && !exportDone && (
              <button
                onClick={() => setExportSheet('hub')}
                disabled={filled === 0}
                className="w-full py-4 rounded-3xl font-rubik font-black text-white text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-40 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #A07050, #8B5E3C)',
                  boxShadow: '0 6px 24px rgba(139,94,60,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                <Download size={20} />
                יצוא האלבום
              </button>
            )}
            {filled > 0 && !exporting && !exportDone && (
              <p className="font-rubik text-brown-400 text-xs text-center">
                {filled} {filled === 1 ? 'תמונה' : 'תמונות'} · ZIP · GIF · וידאו עם מוזיקה
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

      {/* ── Unified export sheet — one BottomSheet, three panels ── */}
      <BottomSheet
        isOpen={exportSheet !== null}
        onClose={closeExportSheet}
        title={
          exportSheet === 'hub'   ? 'יצוא האלבום' :
          exportSheet === 'gif'   ? 'GIF אנימציה' :
          exportSheet === 'video' ? 'וידאו עם מוזיקה' :
          ''
        }
      >
        {exportSheet === 'hub' && (
          <ExportHubContent
            filled={filled}
            onZip={handleZipExport}
            onGif={() => setExportSheet('gif')}
            onVideo={() => setExportSheet('video')}
          />
        )}
        {exportSheet === 'gif' && (
          <GifOptionsContent
            byMonth={byMonth}
            options={gifOptions}
            onOptionsChange={setGifOptions}
            filled={filled}
            onGenerate={handleGifGenerate}
          />
        )}
        {exportSheet === 'video' && (
          <VideoOptionsContent
            byMonth={byMonth}
            options={videoOptions}
            onOptionsChange={setVideoOptions}
            filled={filled}
            onGenerate={handleVideoGenerate}
            playingTrack={videoPlayingTrack}
            setPlayingTrack={setVideoPlayingTrack}
            audioRef={videoAudioRef}
          />
        )}
      </BottomSheet>
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
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState(null)
  const [sourceOpen,   setSourceOpen]   = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(false)

  const isBday = month === 12
  const ef = getEffect(effectId)
  const fr = getFrame(frameId)

  async function handlePickPhoto(mode) {
    setUploadError(null)
    try {
      setUploading(true)
      const result = await pickMilestonePhoto({ mode })
      if (!result) return
      const url = await uploadMilestonePhoto({ childId, month, blob: result.blob, mime: result.mime })
      setPhotoUrl(url)
    } catch (err) {
      const msg = err?.message ?? 'העלאת התמונה נכשלה'
      setUploadError(
        msg.includes('not supported') || msg.includes('לא נתמך')
          ? 'סוג קובץ לא נתמך — בחר תמונת JPG, PNG או WEBP.'
          : msg.includes('network') || msg.includes('fetch')
            ? 'שגיאת רשת — בדוק חיבור לאינטרנט ונסה שוב.'
            : msg
      )
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

          {/* ── Upload error ── */}
          {uploadError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-red-50 border border-red-200">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="font-rubik text-red-600 text-xs leading-snug">{uploadError}</p>
            </div>
          )}

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

// ── PreviewSlideshow — live canvas preview of export output ──────────────────
// Renders each photo with the currently-selected options so the user can see
// exactly how the exported file will look before clicking "Generate".

function PreviewSlideshow({ byMonth, options }) {
  const canvasRef = useRef(null)
  const abortRef  = useRef(false)

  const photos = Object.entries(byMonth)
    .sort(([a], [b]) => Number(a) - Number(b))

  useEffect(() => {
    if (!photos.length || !canvasRef.current) return
    abortRef.current = false
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const S      = PREVIEW_SIZE * 2  // 2× for retina

    async function runLoop() {
      const [imgCache, dateCache] = await Promise.all([
        Promise.all(photos.map(([, p]) => loadImageCrossOrigin(p.photo_url))),
        Promise.all(photos.map(([, p]) => getPhotoDate(p))),
      ])
      if (abortRef.current) return

      let i = 0
      while (!abortRef.current) {
        const [monthStr, photo] = photos[i]
        await drawAlbumFrame(ctx, S, imgCache[i], photo, Number(monthStr), options, dateCache[i])
        await waitMs(GIF_SPEED_MS[options.speed ?? 'normal'])
        if (!abortRef.current) i = (i + 1) % photos.length
      }
    }

    runLoop()
    return () => { abortRef.current = true }
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    photos.map(([m]) => m).join(','),
    options.speed, options.effectOverride,
    options.showDate, options.showCaption, options.showMonthLabel,
  ])

  if (!photos.length) return null

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-2xl overflow-hidden border-2 border-cream-200"
        style={{
          width: PREVIEW_SIZE, height: PREVIEW_SIZE,
          boxShadow: '0 4px 16px rgba(61,43,31,0.12)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE * 2}
          height={PREVIEW_SIZE * 2}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
      <p className="font-rubik text-brown-300 text-[10px]">תצוגה מקדימה · עודכן בזמן אמת</p>
    </div>
  )
}

// ── GIF options content ────────────────────────────────────────────────────────

function GifOptionsContent({ byMonth, options, onOptionsChange, filled, onGenerate }) {
  const totalSec = Math.round(filled * GIF_SPEED_MS[options.speed] / 1000)

  return (
    <div className="space-y-4 pb-2" dir="rtl">
      <PreviewSlideshow byMonth={byMonth} options={options} />

      <p className="font-rubik text-brown-400 text-xs text-center">
        {filled} {filled === 1 ? 'תמונה' : 'תמונות'} · כ-{totalSec} שניות · לולאה אינסופית
      </p>
      <p className="font-rubik text-amber-600 text-[10px] text-center -mt-2 bg-amber-50 rounded-xl px-3 py-1.5 border border-amber-100">
        GIF תומך ב-256 צבעים בלבד — לאיכות מלאה בחר &quot;וידאו עם מוזיקה&quot; ←
      </p>

      <OptionsSpeedBlock options={options} onOptionsChange={onOptionsChange} />
      <OptionsTextToggles options={options} onOptionsChange={onOptionsChange} />
      <OptionsEffectPicker options={options} onOptionsChange={onOptionsChange} />

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
  )
}

// ── Shared option sub-blocks (used by both GifOptionsSheet and VideoOptionsSheet) ─

function OptionsSpeedBlock({ options, onOptionsChange }) {
  return (
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
  )
}

function OptionsTextToggles({ options, onOptionsChange }) {
  return (
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
            <button
              onClick={() => onOptionsChange(o => ({ ...o, [key]: !o[key] }))}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${options[key] ? 'bg-amber-400' : 'bg-cream-200'}`}
              style={{ direction: 'ltr' }}
              aria-label={label}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${options[key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function OptionsEffectPicker({ options, onOptionsChange }) {
  return (
    <div>
      <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">
        אפקט <span className="font-normal text-brown-400 text-[10px]">עוקף את הגדרות כל תמונה בנפרד</span>
      </p>
      <div className="flex gap-2 pb-1" style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <button
          onClick={() => onOptionsChange(o => ({ ...o, effectOverride: null }))}
          className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 ${
            options.effectOverride === null ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-white'
          }`}
        >
          <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ width: 52, height: 52, gap: 2, padding: 2, backgroundColor: '#FFF0E0' }}>
            {EFFECTS.slice(0, 4).map(e => (
              <div key={e.id} className="rounded" style={{ backgroundColor: e.previewBg, filter: e.filter || undefined }} />
            ))}
          </div>
          <span className={`font-rubik text-[11px] font-semibold ${options.effectOverride === null ? 'text-amber-600' : 'text-brown-400'}`}>מקורי</span>
        </button>
        {EFFECTS.map(eff => (
          <button
            key={eff.id}
            onClick={() => onOptionsChange(o => ({ ...o, effectOverride: eff.id }))}
            className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 ${
              options.effectOverride === eff.id ? 'border-amber-400 bg-amber-50' : 'border-cream-200 bg-white'
            }`}
          >
            <div className="rounded-xl" style={{ width: 52, height: 52, backgroundColor: eff.previewBg, filter: eff.filter || undefined }} />
            <span className={`font-rubik text-[11px] font-semibold ${options.effectOverride === eff.id ? 'text-amber-600' : 'text-brown-400'}`}>{eff.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── ExportProgressCard ─────────────────────────────────────────────────────────

const EXPORT_STYLES = {
  zip:   { bar: '#A07050', track: '#F5E6D3', bg: 'linear-gradient(135deg,#FDF6F0,#FFF8F2)', border: '#F0D9C4' },
  gif:   { bar: '#E8B84B', track: '#FEF3C7', bg: 'linear-gradient(135deg,#FFFBEB,#FEF9E0)', border: '#FDE68A' },
  video: { bar: '#6366F1', track: '#E0E7FF', bg: 'linear-gradient(135deg,#EEF2FF,#E8EDFF)', border: '#C7D2FE' },
}

const VIDEO_PHASE_LABELS = {
  loading:   'טוען תמונות ומוזיקה...',
  rendering: 'מעבד פריימים...',
  recording: 'מקודד סרטון...',
}

function ExportProgressCard({ type, progress }) {
  const s = EXPORT_STYLES[type]
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.step / progress.total) * 100)) : 0

  const label = type === 'zip'
    ? `מכין תמונה ${progress.step} מתוך ${progress.total}...`
    : type === 'gif'
    ? `מקודד GIF — פריים ${progress.step}/${progress.total}`
    : VIDEO_PHASE_LABELS[progress.phase] ?? 'מעבד...'

  const subLabel = type === 'video' && progress.step > 0 && progress.total > 0
    ? `תמונה ${progress.step} מתוך ${progress.total}`
    : null

  return (
    <div
      className="rounded-2xl border px-4 py-3.5"
      style={{ background: s.bg, borderColor: s.border, boxShadow: '0 2px 12px rgba(61,43,31,0.06)' }}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-rubik font-semibold text-sm text-brown-700 flex items-center gap-1.5">
          <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: s.bar }} />
          {label}
        </span>
        <span className="font-rubik font-bold text-xs" style={{ color: s.bar }}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: s.track }}>
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%`, background: s.bar }}
        />
      </div>

      {subLabel && (
        <p className="font-rubik text-brown-400 text-[10px] mt-1">{subLabel}</p>
      )}
    </div>
  )
}

function ExportDoneCard({ text }) {
  return (
    <div
      className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border"
      style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', borderColor: '#BBF7D0' }}
    >
      <CheckCircle2 size={18} className="text-green-500" />
      <span className="font-rubik font-semibold text-sm text-green-700">{text}</span>
    </div>
  )
}

// ── ExportHubContent — 3 distinct export cards (no BottomSheet wrapper) ──────────

function ExportHubContent({ filled, onZip, onGif, onVideo }) {
  return (
    <div className="space-y-3 pb-2" dir="rtl">
      <p className="font-rubik text-brown-400 text-xs text-center -mt-1">
        {filled} {filled === 1 ? 'תמונה' : 'תמונות'} · בחר פורמט
      </p>

      <ExportCard
        icon={<FolderDown size={22} />}
        iconBg="#F5E6D3"
        iconColor="#8B5E3C"
        gradient="linear-gradient(135deg, #FDF6F0, #FFF0E0)"
        title="הדפסה — ZIP"
        desc={`${filled} תמונות · 2100×2100 · כל חודש כקובץ JPG נפרד באיכות הדפסה`}
        onClick={onZip}
      />

      <ExportCard
        icon={<Film size={22} />}
        iconBg="#FEF3C7"
        iconColor="#D4A030"
        gradient="linear-gradient(135deg, #FFFBEB, #FEF3C7)"
        title="GIF אנימציה"
        desc="אנימציה מסתובבת · לשיתוף ב-WhatsApp ורשתות חברתיות"
        onClick={onGif}
      />

      <ExportCard
        icon={<Video size={22} />}
        iconBg="#E0E7FF"
        iconColor="#4F46E5"
        gradient="linear-gradient(135deg, #EEF2FF, #E0E7FF)"
        title="וידאו עם מוזיקה"
        desc="סרטון MP4 עם מעברים חלקים · 8 שירי רקע לבחירה"
        onClick={onVideo}
      />
    </div>
  )
}

function ExportCard({ icon, iconBg, iconColor, gradient, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      dir="rtl"
      className="w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl border border-cream-200 active:scale-[0.98] transition-transform cursor-pointer text-right"
      style={{ background: gradient, boxShadow: '0 2px 12px rgba(61,43,31,0.06), inset 0 1px 0 rgba(255,255,255,0.85)' }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className="font-rubik font-bold text-brown-800 text-sm">{title}</p>
        <p className="font-rubik text-brown-400 text-xs mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <ChevronLeft size={18} className="text-brown-300 flex-shrink-0" />
    </button>
  )
}

// ── VideoOptionsContent — video panel (no BottomSheet wrapper) ─────────────────
// Audio state is lifted to AlbumPage so closeExportSheet can stop playback.

function VideoOptionsContent({ byMonth, options, onOptionsChange, filled, onGenerate, playingTrack, setPlayingTrack, audioRef }) {
  function stopPreview() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlayingTrack(null)
  }

  function togglePreview(trackId) {
    if (playingTrack === trackId) { stopPreview(); return }
    stopPreview()
    const audio = new Audio(`${SUPABASE_MUSIC_URL}/${trackId}.mp3`)
    audio.onended = () => setPlayingTrack(null)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlayingTrack(trackId)
  }

  const transitionMs = filled > 1 ? (filled - 1) * TRANSITION_MS : 0
  const totalSec = Math.round((filled * GIF_SPEED_MS[options.speed] + transitionMs) / 1000)

  return (
    <div className="space-y-4 pb-2" dir="rtl">
      <PreviewSlideshow byMonth={byMonth} options={options} />

      <p className="font-rubik text-brown-400 text-xs text-center">
        {filled} {filled === 1 ? 'תמונה' : 'תמונות'} · כ-{totalSec} שניות · MP4/WebM · 1080p
      </p>

      <OptionsSpeedBlock options={options} onOptionsChange={onOptionsChange} />
      <OptionsTextToggles options={options} onOptionsChange={onOptionsChange} />
      <OptionsEffectPicker options={options} onOptionsChange={onOptionsChange} />

      {/* ── Music section ── */}
      <div>
        <p className="font-rubik text-brown-500 text-xs font-semibold mb-2">
          מוזיקה
          <span className="font-normal text-brown-300 mr-1">· לחץ ▶ להאזנה מקדימה</span>
        </p>

        <div className="flex gap-2 pb-1" style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* No music */}
          <button
            onClick={() => { stopPreview(); onOptionsChange(o => ({ ...o, music: null, musicStart: 0 })) }}
            className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 ${
              !options.music ? 'border-indigo-400 bg-indigo-50' : 'border-cream-200 bg-white'
            }`}
            style={{ width: 68 }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: !options.music ? '#E0E7FF' : '#FFF8F0' }}>
              <Video size={20} style={{ color: !options.music ? '#4F46E5' : '#C9956C' }} />
            </div>
            <span className={`font-rubik text-[10px] font-semibold ${!options.music ? 'text-indigo-600' : 'text-brown-400'}`}>ללא</span>
          </button>

          {/* Track cards */}
          {MUSIC_TRACKS.map(track => {
            const selected = options.music === track.id
            const playing  = playingTrack === track.id
            return (
              <div
                key={track.id}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${
                  selected ? 'border-indigo-400 bg-indigo-50' : 'border-cream-200 bg-white'
                }`}
                style={{ width: 68 }}
              >
                <button
                  onClick={() => { stopPreview(); onOptionsChange(o => ({ ...o, music: track.id, musicStart: 0 })) }}
                  className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform w-full"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: selected ? '#E0E7FF' : '#FFF8F0' }}>
                    {track.emoji}
                  </div>
                  <span className={`font-rubik text-[10px] font-semibold text-center leading-tight ${selected ? 'text-indigo-600' : 'text-brown-400'}`}>
                    {track.label}
                  </span>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); togglePreview(track.id) }}
                  className={`w-full flex items-center justify-center gap-0.5 py-0.5 rounded-lg text-[10px] cursor-pointer transition-colors ${
                    playing ? 'text-indigo-600 bg-indigo-100' : 'text-brown-400'
                  }`}
                >
                  <span>{playing ? '⏸' : '▶'}</span>
                  <span className="font-rubik text-[9px]">{playing ? 'עצור' : 'נגן'}</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Start-time slider */}
        {options.music && (
          <div className="mt-2.5 px-1">
            <div className="flex items-center justify-between mb-1">
              <span className="font-rubik text-brown-500 text-[11px] font-semibold">התחל שיר מ:</span>
              <span className="font-rubik text-indigo-500 text-[11px] font-bold">{formatAlbumTime(options.musicStart)}</span>
            </div>
            <input
              type="range" min={0} max={60} step={1}
              value={options.musicStart}
              onChange={e => onOptionsChange(o => ({ ...o, musicStart: Number(e.target.value) }))}
              className="w-full"
              style={{ accentColor: '#6366F1' }}
            />
            <div className="flex justify-between mt-0.5">
              <span className="font-rubik text-brown-300 text-[9px]">0:00</span>
              <span className="font-rubik text-brown-300 text-[9px]">1:00</span>
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        className="w-full py-4 rounded-3xl font-rubik font-black text-white text-base flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
          boxShadow: '0 6px 20px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}
      >
        <Video size={18} />
        צור וידאו
      </button>
    </div>
  )
}

