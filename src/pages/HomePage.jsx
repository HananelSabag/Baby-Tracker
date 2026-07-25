import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useChildren } from '../hooks/useChildren'
import { useHomeEvents } from '../hooks/useHomeEvents'
import { useToast } from '../hooks/useToast'
import { TRACKER_TYPES } from '../lib/constants'
import { FeedingCard } from '../components/trackers/FeedingCard'
import { VitaminDCard } from '../components/trackers/VitaminDCard'
import { DiaperCard } from '../components/trackers/DiaperCard'
import { SleepCard } from '../components/trackers/SleepCard'
import { CustomTrackerCard } from '../components/trackers/CustomTrackerCard'
import { GrowthCard } from '../components/trackers/GrowthCard'
import { HeroCard } from '../components/trackers/HeroCard'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ChildFormSheet } from '../components/ui/ChildFormSheet'
import { HomeSkeleton } from '../components/ui/Skeleton'
import { PhotoSourceSheet } from '../components/ui/PhotoSourceSheet'
import { ToastContainer } from '../components/ui/Toast'
import { format, addDays, subDays, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { formatTimeAgo, formatChildAge, cn } from '../lib/utils'
import { Bell, Pencil, GripVertical, Eye, EyeOff, Camera, User, RefreshCw, Loader2, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import api from '../lib/api'
import { pickAndCompressImage, uploadAvatar } from '../lib/imageUpload'

// Empty-state block for the tracker area of the home page.
function EmptyHome({ emoji, title, body, actionLabel, actionIcon, onAction }) {
  return (
    <div
      className="bg-white rounded-3xl border border-cream-200 px-6 py-9 flex flex-col items-center text-center"
      style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
    >
      <div
        className="w-16 h-16 rounded-3xl bg-cream-100 border border-cream-200 flex items-center justify-center text-3xl mb-4"
        style={{ boxShadow: '0 2px 12px rgba(61,43,31,0.07)' }}
      >
        {emoji}
      </div>
      <p className="font-rubik font-bold text-brown-800 text-base mb-1.5">{title}</p>
      <p className="font-rubik text-brown-400 text-sm leading-relaxed max-w-[17rem] mb-5">{body}</p>
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#8B5E3C] font-rubik font-bold text-white text-sm cursor-pointer active:scale-95 transition-transform min-h-[44px]"
        style={{ boxShadow: '0 4px 14px rgba(139,94,60,0.30)' }}
      >
        {actionIcon}
        {actionLabel}
      </button>
    </div>
  )
}

// A greeting that tracks the clock. "שלום" at 3am to a parent doing a night
// feed reads as canned; "לילה טוב" reads like the app knows what's going on.
function greetingFor(date) {
  const h = date.getHours()
  if (h < 5)  return { text: 'לילה טוב',      emoji: '🌙' }
  if (h < 12) return { text: 'בוקר טוב',      emoji: '☀️' }
  if (h < 17) return { text: 'צהריים טובים',  emoji: '🌤️' }
  if (h < 21) return { text: 'ערב טוב',       emoji: '🌆' }
  return { text: 'לילה טוב', emoji: '🌙' }
}

export function HomePage() {
  const { identity, setActiveChildId, notifications, unreadCount, markNotificationsRead, clearNotifications, setMemberAvatarUrl } = useApp()
  const navigate = useNavigate()
  const { trackers: allTrackers, loading, reorderTrackers } = useTrackers(identity.familyId)
  const trackers = allTrackers.filter(t => t.is_active !== false)
  const { children, updateChild } = useChildren(identity.familyId)
  const [childPickerOpen, setChildPickerOpen] = useState(false)
  const [childDetailOpen, setChildDetailOpen] = useState(false)
  const [childEditOpen, setChildEditOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [bellOpen, setBellOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [localOrder, setLocalOrder] = useState([])
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const { toasts, showToast, dismissToast } = useToast()

  // Long-press
  const longPressTimer = useRef(null)

  // HTML5 drag
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  // Touch drag
  const cardRefs = useRef([])
  const touchDragIndex = useRef(null)

  useEffect(() => {
    return () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }
  }, [])

  const isToday = isSameDay(viewDate, new Date())
  const hiddenCount = localOrder.filter(t => !t._visible).length
  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null
  const { eventsByTracker } = useHomeEvents(identity.familyId, viewDate, activeChild?.id ?? null)
  const todayLabel = format(new Date(), 'EEEE, d בMMMM', { locale: he })
  const dateLabel = isToday ? 'היום' : format(viewDate, 'd/M', { locale: he })
  const greeting = greetingFor(new Date())

  function enterEditMode() {
    // Include ALL trackers (visible + hidden) sorted by display_order
    const all = [...allTrackers].sort((a, b) => a.display_order - b.display_order)
    setLocalOrder(all.map(t => ({ ...t, _visible: t.is_active !== false })))
    setEditMode(true)
  }

  function toggleVisible(index) {
    setLocalOrder(prev => prev.map((t, i) => i === index ? { ...t, _visible: !t._visible } : t))
  }

  async function saveAndExit() {
    // Exit edit mode immediately with the new order visible (optimistic).
    // reorderTrackers updates allTrackers in-memory first, then persists to DB.
    // On DB failure it reverts to DB truth and throws so we can show a toast.
    setEditMode(false)
    try {
      await reorderTrackers(localOrder)
    } catch (err) {
      showToast({ message: err.message, emoji: '⚠️' })
    }
  }

  // Leave edit mode without writing anything — localOrder is thrown away.
  function cancelEdit() {
    setLocalOrder([])
    setEditMode(false)
  }

  function handleBellClick() {
    markNotificationsRead()
    setBellOpen(prev => !prev)
  }

  async function handleAvatarUpload(mode) {
    if (uploadingAvatar) return
    setUploadingAvatar(true)
    try {
      const picked = await pickAndCompressImage({ mode })
      // Cancelling the OS picker must leave the profile sheet open — the
      // `finally` below closes it, so bail out before reaching it.
      if (!picked) { setUploadingAvatar(false); return }
      const url = await uploadAvatar({
        folder: 'members',
        subjectId: identity.memberId,
        ...picked,
      })
      setMemberAvatarUrl(url)
      // NOTE: an older version wrote to a non-existent `members` table; the
      // real table is `family_members`. That silent bug meant the URL was
      // only persisted via setMemberAvatarUrl (localStorage), not the DB.
      // Going through the api also invalidates the cached member list, so the
      // new photo shows up on the family screen without a reload.
      await api.members.update(identity.familyId, identity.memberId, { avatar_url: url })
      showToast({ message: 'התמונה עודכנה', emoji: '✅' })
    } catch (err) {
      showToast({ message: err?.message ?? 'העלאת התמונה נכשלה', emoji: '⚠️' })
    } finally {
      setUploadingAvatar(false)
      setProfileSheetOpen(false)
    }
  }

  async function handleChildEditSave({ name, photo, birthDate, gender }) {
    if (!activeChild) return
    let uploadedUrl = activeChild.avatar_url ?? null
    if (photo?.blob) {
      try {
        uploadedUrl = await uploadAvatar({ folder: 'children', subjectId: activeChild.id, ...photo })
      } catch (err) {
        showToast({ message: 'העלאת התמונה נכשלה', emoji: '⚠️' })
      }
    }
    await updateChild(activeChild.id, { name, avatar_url: uploadedUrl, birth_date: birthDate || null, gender: gender || null })
    setChildEditOpen(false)
    showToast({ message: 'פרטי הילד עודכנו', emoji: '✅' })
  }

  // Long-press to enter edit mode
  function handleLongPressStart() {
    longPressTimer.current = setTimeout(enterEditMode, 500)
  }

  function handleLongPressCancel() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // HTML5 drag-and-drop
  function handleDragStart(index) {
    dragItem.current = index
  }

  function handleDragOver(e, index) {
    e.preventDefault()
    dragOverItem.current = index
  }

  function handleDrop() {
    const from = dragItem.current
    const to = dragOverItem.current
    if (from === null || to === null || from === to) return
    const next = [...localOrder]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setLocalOrder(next)
    dragItem.current = null
    dragOverItem.current = null
  }

  // Touch drag via handle
  function handleTouchHandleStart(e, index) {
    e.stopPropagation()
    touchDragIndex.current = index
  }

  function handleTouchHandleMove(e) {
    if (touchDragIndex.current === null) return
    e.preventDefault()
    const touch = e.touches[0]
    const hovered = cardRefs.current.findIndex(ref => {
      if (!ref) return false
      const rect = ref.getBoundingClientRect()
      return touch.clientY >= rect.top && touch.clientY <= rect.bottom
    })
    if (hovered !== -1 && hovered !== touchDragIndex.current) {
      const next = [...localOrder]
      const [moved] = next.splice(touchDragIndex.current, 1)
      next.splice(hovered, 0, moved)
      setLocalOrder(next)
      touchDragIndex.current = hovered
    }
  }

  function handleTouchHandleEnd() {
    touchDragIndex.current = null
  }

  // Trackers that render in 2-col grid when consecutive
  function isGridable(tracker) {
    return (
      tracker.tracker_type === TRACKER_TYPES.CUSTOM ||
      (tracker.tracker_type === TRACKER_TYPES.DOSE && tracker.config?.display_mode === 'simple')
    )
  }

  function groupTrackers(list) {
    const groups = []
    let i = 0
    while (i < list.length) {
      const current = list[i]
      const next = list[i + 1]
      if (isGridable(current) && next && isGridable(next)) {
        groups.push({ type: 'pair', items: [current, next] })
        i += 2
      } else {
        groups.push({ type: 'single', item: current })
        i += 1
      }
    }
    return groups
  }

  function renderTracker(tracker, inGrid = false) {
    const props = {
      tracker,
      familyId: identity.familyId,
      memberId: identity.memberId,
      childId: activeChild?.id ?? null,
      viewDate,
    }
    switch (tracker.tracker_type) {
      case TRACKER_TYPES.FEEDING:   return <FeedingCard key={tracker.id} {...props} />
      case TRACKER_TYPES.VITAMIN_D: return <VitaminDCard key={tracker.id} {...props} />
      case TRACKER_TYPES.DIAPER:    return <DiaperCard key={tracker.id} {...props} />
      case TRACKER_TYPES.SLEEP:     return <SleepCard key={tracker.id} {...props} />
      case TRACKER_TYPES.DOSE:      return <VitaminDCard key={tracker.id} {...props} compact={inGrid} />
      case TRACKER_TYPES.GROWTH:    return <GrowthCard key={tracker.id} {...props} child={activeChild} />
      default:                      return <CustomTrackerCard key={tracker.id} {...props} compact={inGrid} />
    }
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header row: greeting (right) + icon buttons + avatar (left) ─── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <p className="font-rubik text-brown-400 text-xs capitalize">{todayLabel}</p>
          <h1 className="font-rubik font-bold text-2xl text-brown-800 truncate">
            {greeting.text}, {identity.memberName} {greeting.emoji}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {editMode && (
            <>
              <button
                onClick={cancelEdit}
                className="px-3 h-10 rounded-2xl bg-white border border-cream-200 text-brown-500 font-rubik font-semibold text-sm active:scale-95 transition-all duration-150 cursor-pointer"
                style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.07)' }}
              >
                ביטול
              </button>
              <button
                onClick={saveAndExit}
                className="px-4 h-10 rounded-2xl bg-brown-800 text-white font-rubik font-semibold text-sm active:scale-95 transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
                style={{ boxShadow: '0 4px 12px rgba(61,43,31,0.25)' }}
              >
                שמור
              </button>
            </>
          )}

          {/* Notification bell — hidden in edit mode so the header can't overflow */}
          <div className={cn('relative', editMode && 'hidden')}>
            <button
              onClick={handleBellClick}
              aria-label={"התראות בזמן אמת"}
              className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-150 relative cursor-pointer border border-cream-200"
              style={{
                backgroundColor: unreadCount > 0 ? '#FEF3C7' : '#FFFFFF',
                boxShadow: '0 2px 10px rgba(61,43,31,0.09), inset 0 1px 0 rgba(255,255,255,0.95)',
              }}
            >
              <Bell size={18} className={unreadCount > 0 ? 'text-amber-600' : 'text-brown-600'} strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center font-rubik">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Edit-view button — sibling of bell, not stacked */}
          {!editMode && (
            <button
              onClick={enterEditMode}
              className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all duration-150 cursor-pointer border border-cream-200"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 10px rgba(61,43,31,0.09), inset 0 1px 0 rgba(255,255,255,0.95)' }}
              aria-label="עריכת תצוגה"
              title="עריכת תצוגה"
            >
              <Pencil size={16} className="text-brown-600" />
            </button>
          )}

          {/* User avatar — tap opens profile sheet */}
          <button
            onClick={() => setProfileSheetOpen(true)}
            className="w-11 h-11 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0 shadow-soft border-2 border-white active:scale-95 transition-transform"
          >
            {(identity.memberAvatarUrl || identity.googleAvatarUrl)
              ? <img
                  src={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
                  alt={identity.memberName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              : <User size={20} className="text-brown-400" />
            }
          </button>
        </div>
      </div>

      {/* ── Child card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-3 mb-4 border border-cream-200" style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}>
        <div className="flex items-center gap-3">
          {activeChild ? (
            <>
              {/* Avatar — tap opens child detail sheet */}
              <button
                onClick={() => setChildDetailOpen(true)}
                className="w-14 h-14 rounded-2xl overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform cursor-pointer"
                style={{ boxShadow: '0 0 0 2.5px #E8C9A8, 0 4px 12px rgba(61,43,31,0.12)' }}
              >
                {activeChild.avatar_url
                  ? <img src={activeChild.avatar_url} alt={activeChild.name} className="w-full h-full object-cover" />
                  : <span className="text-3xl">👶</span>
                }
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-rubik text-brown-400 text-[11px] leading-tight">מעקב עבור</p>
                <p className="font-rubik font-bold text-brown-800 text-base leading-tight truncate mt-0.5">
                  {activeChild.name}
                </p>
                {activeChild.birth_date && (
                  <p className="font-rubik text-brown-500 text-xs leading-tight mt-0.5">
                    {formatChildAge(activeChild.birth_date, activeChild.gender)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1" />
          )}

          {/* Day navigator. Sized to a 36px+ touch target — at 32px the arrows
              were easy to miss one-handed, which is the only way this app is
              ever used. */}
          <div
            className="flex items-center gap-0.5 flex-shrink-0 rounded-2xl bg-cream-100 border border-cream-200 p-0.5"
            style={{ boxShadow: 'inset 0 1px 3px rgba(61,43,31,0.05)' }}
          >
            <button
              onClick={() => setViewDate(d => subDays(d, 1))}
              aria-label="יום קודם"
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 active:bg-cream-200 transition-all duration-150 cursor-pointer"
            >
              <ChevronRight size={17} className="text-brown-600" />
            </button>
            <button
              onClick={() => !isToday && setViewDate(new Date())}
              aria-label={isToday ? 'היום' : 'חזור להיום'}
              className={cn(
                'font-rubik font-bold text-sm px-2 h-9 rounded-xl transition-colors min-w-[46px] text-center',
                isToday ? 'text-brown-500' : 'text-white cursor-pointer'
              )}
              style={isToday ? undefined : { backgroundColor: '#D9A441' }}
            >
              {dateLabel}
            </button>
            <button
              onClick={() => setViewDate(d => addDays(d, 1))}
              disabled={isToday}
              aria-label="יום הבא"
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 active:bg-cream-200 transition-all duration-150 cursor-pointer disabled:opacity-25 disabled:active:scale-100"
            >
              <ChevronLeft size={17} className="text-brown-600" />
            </button>
          </div>
        </div>

        {/* Multi-child quick switcher */}
        {children.length > 1 && (
          <div className="mt-2.5 pt-2.5 border-t border-cream-100 flex gap-3 overflow-x-auto pb-0.5">
            {children.map(child => {
              const isActive = child.id === activeChild?.id
              return (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center ring-2 transition-all',
                    isActive ? 'ring-[#8B5E3C]' : 'ring-transparent opacity-60'
                  )}>
                    {child.avatar_url
                      ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                      : <span className="text-lg">👶</span>
                    }
                  </div>
                  <span className={cn(
                    'font-rubik text-[10px] leading-none max-w-[44px] truncate text-center',
                    isActive ? 'text-brown-700 font-bold' : 'text-brown-400'
                  )}>
                    {child.name.split(' ')[0]}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <HomeSkeleton />
      ) : (
        <div className="space-y-3">
          {/* Past-day banner — one-tap actions stamp the current time, so they
              are disabled off-today; the "+" sheets can still back-fill. */}
          {!editMode && !isToday && (
            <button
              onClick={() => setViewDate(new Date())}
              className="w-full rounded-2xl px-4 py-3 border border-amber-200 bg-amber-50 flex items-center gap-3 text-right active:scale-[0.99] transition-transform cursor-pointer"
              style={{ boxShadow: '0 2px 10px rgba(180,93,20,0.08)' }}
            >
              <span className="text-lg flex-shrink-0">🗓️</span>
              <div className="min-w-0 flex-1">
                <p className="font-rubik text-sm font-bold text-amber-800 leading-tight">
                  צופה ב־{format(viewDate, 'EEEE, d בMMMM', { locale: he })}
                </p>
                <p className="font-rubik text-xs text-amber-700/80 leading-tight mt-0.5">
                  כפתורים מהירים כבויים · הוסף דרך ה־+ עם שעה
                </p>
              </div>
              <span className="font-rubik text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg flex-shrink-0">
                חזור להיום
              </span>
            </button>
          )}

          {/* Hero card — hidden in edit mode, and when there is nothing to
              summarise (otherwise it renders as an empty titled box) */}
          {!editMode && trackers.length > 0 && (
            <HeroCard
              trackers={trackers}
              eventsByTracker={eventsByTracker}
              isToday={isToday}
              child={activeChild}
              familyId={identity.familyId}
              childId={activeChild?.id ?? null}
              memberId={identity.memberId}
            />
          )}

          {/* Edit mode hint */}
          {editMode && (
            <div
              className="rounded-2xl px-4 py-3 border border-amber-200 bg-amber-50 flex items-center gap-3"
              style={{ boxShadow: '0 2px 10px rgba(180,93,20,0.08)' }}
            >
              <Pencil size={16} className="text-amber-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-rubik text-sm font-bold text-amber-800 leading-tight">עריכת תצוגה</p>
                <p className="font-rubik text-xs text-amber-700/80 leading-tight mt-0.5">
                  גרור בידית לשינוי סדר · לחץ על העין להסתרה
                </p>
              </div>
              {hiddenCount > 0 && (
                <span className="font-rubik text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg flex-shrink-0">
                  {hiddenCount} מוסתרים
                </span>
              )}
            </div>
          )}

          {/* Tracker cards */}
          {editMode ? (
            // Edit mode: all trackers (visible + hidden) with drag + eye toggle
            localOrder.map((tracker, index) => (
              <div
                key={tracker.id}
                ref={el => { cardRefs.current[index] = el }}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                className="flex items-stretch gap-2"
              >
                {/* Drag handle */}
                <div
                  className="flex items-center justify-center w-10 flex-shrink-0 bg-white rounded-2xl cursor-grab active:cursor-grabbing select-none touch-none border border-cream-200"
                  style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
                  onTouchStart={(e) => handleTouchHandleStart(e, index)}
                  onTouchMove={handleTouchHandleMove}
                  onTouchEnd={handleTouchHandleEnd}
                >
                  <GripVertical size={20} className="text-brown-300" />
                </div>
                {/* Card with visibility-based styling */}
                <div className={cn('flex-1 rounded-3xl ring-2 overflow-hidden transition-opacity', tracker._visible ? 'ring-brown-200 opacity-100' : 'ring-cream-300 opacity-40')}>
                  {renderTracker(tracker)}
                </div>
                {/* Eye toggle */}
                <button
                  onClick={() => toggleVisible(index)}
                  className="flex items-center justify-center w-10 flex-shrink-0 bg-white rounded-2xl active:scale-95 transition-all duration-150 select-none cursor-pointer border border-cream-200"
                  style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
                >
                  {tracker._visible
                    ? <Eye size={18} className="text-brown-500" />
                    : <EyeOff size={18} className="text-brown-300" />
                  }
                </button>
              </div>
            ))
          ) : trackers.length === 0 ? (
            // Nothing to show. Two very different causes, two different fixes —
            // previously both rendered an empty page that looked broken.
            allTrackers.length === 0 ? (
              <EmptyHome
                emoji="🍼"
                title="עוד אין מעקבים"
                body="מעקב הוא מה שאתם מתעדים — האכלה, חיתול, שינה או תרופה. הוסיפו את הראשון כדי להתחיל."
                actionLabel="הוסף מעקב"
                actionIcon={<Plus size={16} className="text-white" />}
                onAction={() => navigate('/trackers?action=add')}
              />
            ) : (
              <EmptyHome
                emoji="🙈"
                title="כל המעקבים מוסתרים"
                body={`${allTrackers.length} מעקבים קיימים אבל אף אחד לא מוצג במסך הבית.`}
                actionLabel="בחר מה להציג"
                actionIcon={<Eye size={16} className="text-white" />}
                onAction={enterEditMode}
              />
            )
          ) : (
            // Normal mode: grouped with long-press to enter edit mode
            groupTrackers(trackers).map((group) =>
              group.type === 'pair' ? (
                <div
                  key={`pair-${group.items[0].id}`}
                  className="grid grid-cols-2 gap-3"
                  onTouchStart={handleLongPressStart}
                  onTouchEnd={handleLongPressCancel}
                  onTouchMove={handleLongPressCancel}
                >
                  {group.items.map(tr => renderTracker(tr, true))}
                </div>
              ) : (
                <div
                  key={group.item.id}
                  onTouchStart={handleLongPressStart}
                  onTouchEnd={handleLongPressCancel}
                  onTouchMove={handleLongPressCancel}
                >
                  {renderTracker(group.item)}
                </div>
              )
            )
          )}
        </div>
      )}

      {/* Child picker sheet */}
      <BottomSheet
        isOpen={childPickerOpen}
        onClose={() => setChildPickerOpen(false)}
        title={"החלף ילד/ה"}
      >
        <div className="space-y-2 pb-2">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => { setActiveChildId(child.id); setChildPickerOpen(false) }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
              style={{ backgroundColor: child.id === identity.activeChildId ? '#8B5E3C' : '#F5EDE0' }}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0">
                {child.avatar_url
                  ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                  : <span className="text-2xl">👶</span>
                }
              </div>
              <span className={`font-rubik font-semibold text-lg ${child.id === identity.activeChildId ? 'text-white' : 'text-brown-800'}`}>
                {child.name}
              </span>
              {child.id === identity.activeChildId && (
                <span className="mr-auto text-white text-xl">✓</span>
              )}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Profile quick sheet */}
      <BottomSheet isOpen={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} hero>
        <div className="rounded-t-4xl overflow-hidden">
          {/* Floating handle */}
          <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
            <div className="w-10 h-1 bg-white/50 rounded-full" />
          </div>
          {/* Hero photo */}
          <div className="relative w-full h-72 bg-gradient-to-br from-amber-100 to-cream-200">
            {(identity.memberAvatarUrl || identity.googleAvatarUrl)
              ? <img
                  src={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
                  alt={identity.memberName}
                  className="w-full h-full object-cover object-top"
                />
              : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200">
                  <User size={80} className="text-brown-200" />
                </div>
            }
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/95 to-transparent" />
            <div className="absolute bottom-3 right-4 text-right">
              <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">{identity.memberName}</p>
              <p className="font-rubik text-brown-500 text-xs">{identity.email}</p>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex gap-3 px-4 pt-4 pb-6">
            <button
              onClick={() => setPhotoSourceOpen(true)}
              disabled={uploadingAvatar}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cream-100 active:bg-cream-200 transition-colors disabled:opacity-60 cursor-pointer border border-cream-200"
              style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.06)' }}
            >
              {uploadingAvatar
                ? <Loader2 size={18} className="text-brown-500 animate-spin" />
                : <Camera size={18} className="text-brown-600" />
              }
              <span className="font-rubik font-medium text-brown-700 text-sm">החלף תמונה</span>
            </button>
            <button
              onClick={() => { setProfileSheetOpen(false); navigate('/profile') }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#8B5E3C] active:opacity-90 transition-opacity cursor-pointer"
              style={{ boxShadow: '0 4px 14px rgba(139,94,60,0.30)' }}
            >
              <User size={18} className="text-white" />
              <span className="font-rubik font-medium text-white text-sm">גש לפרופיל</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Camera vs gallery picker */}
      <PhotoSourceSheet
        isOpen={photoSourceOpen}
        onClose={() => setPhotoSourceOpen(false)}
        onPick={handleAvatarUpload}
        title="תמונת פרופיל"
      />

      {/* Child detail sheet */}
      <BottomSheet isOpen={childDetailOpen} onClose={() => setChildDetailOpen(false)} hero>
        <div className="rounded-t-4xl overflow-hidden">
          {/* Floating handle */}
          <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
            <div className="w-10 h-1 bg-white/60 rounded-full" />
          </div>
          {/* Hero photo */}
          <div className="relative w-full h-72 bg-gradient-to-br from-amber-50 to-cream-200">
            {activeChild?.avatar_url
              ? <img src={activeChild.avatar_url} alt={activeChild.name} className="w-full h-full object-cover object-center" />
              : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-cream-200">
                  <span className="text-8xl opacity-30">👶</span>
                </div>
            }
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/95 to-transparent" />
            <div className="absolute bottom-3 right-4 text-right">
              <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">{activeChild?.name}</p>
              {activeChild?.birth_date && (
                <p className="font-rubik text-brown-500 text-sm">{formatChildAge(activeChild?.birth_date, activeChild?.gender)}</p>
              )}
            </div>
          </div>
          {/* Action buttons */}
          <div className={cn('px-4 pt-4 pb-6', children.length > 1 ? 'flex gap-3' : '')}>
            {children.length > 1 && (
              <button
                onClick={() => { setChildDetailOpen(false); setTimeout(() => setChildPickerOpen(true), 80) }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cream-100 active:bg-cream-200 transition-colors cursor-pointer border border-cream-200"
                style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.06)' }}
              >
                <RefreshCw size={17} className="text-brown-600" />
                <span className="font-rubik font-medium text-brown-700 text-sm">החלף ילד</span>
              </button>
            )}
            <button
              onClick={() => { setChildDetailOpen(false); setTimeout(() => setChildEditOpen(true), 80) }}
              className={cn(
                'flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#8B5E3C] active:opacity-90 transition-opacity cursor-pointer',
                children.length > 1 ? 'flex-1' : 'w-full'
              )}
              style={{ boxShadow: '0 4px 14px rgba(139,94,60,0.30)' }}
            >
              <Pencil size={17} className="text-white" />
              <span className="font-rubik font-medium text-white text-sm">ערוך פרופיל</span>
            </button>
          </div>
          {/* Summary page — the richest view of this child, so it gets its own
              full-width row rather than competing for space above. */}
          <div className="px-4 -mt-3 pb-6">
            <button
              onClick={() => { setChildDetailOpen(false); navigate('/child') }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cream-100 active:bg-cream-200 transition-colors cursor-pointer border border-cream-200"
              style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.06)' }}
            >
              <Sparkles size={17} className="text-green-600" />
              <span className="font-rubik font-medium text-brown-700 text-sm">הסיפור והגרפים</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Child edit sheet */}
      {childEditOpen && activeChild && (
        <ChildFormSheet
          isOpen={childEditOpen}
          onClose={() => setChildEditOpen(false)}
          title="עריכת ילד/ה"
          initialName={activeChild.name}
          initialAvatar={activeChild.avatar_url ?? null}
          initialBirthDate={activeChild.birth_date ?? ''}
          initialGender={activeChild.gender ?? ''}
          onSave={handleChildEditSave}
        />
      )}

      {/* Notifications bottom sheet */}
      <BottomSheet isOpen={bellOpen} onClose={() => setBellOpen(false)} title={"התראות בזמן אמת"}>
        <div className="space-y-2 pb-2" dir="rtl">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div
                className="w-16 h-16 rounded-3xl bg-cream-100 border border-cream-200 flex items-center justify-center"
                style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.06)' }}
              >
                <Bell size={28} className="text-brown-300" />
              </div>
              <p className="text-center text-brown-400 font-rubik text-sm">{"אין התראות עדיין"}</p>
            </div>
          ) : (
            <>
              {/* Clear all */}
              <div className="flex justify-end pb-1">
                <button
                  onClick={clearNotifications}
                  className="font-rubik text-xs text-brown-400 active:opacity-60 cursor-pointer px-1 py-0.5"
                >
                  נקה הכל
                </button>
              </div>

              {notifications.slice(0, 30).map(n => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-3 py-3 rounded-2xl bg-white border border-cream-200"
                  style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.05), inset 0 1px 0 rgba(255,255,255,0.95)' }}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{n.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-rubik text-sm text-brown-700 leading-snug">{n.message}</p>
                    <p className="font-rubik text-xs text-brown-400 mt-0.5">לפני {formatTimeAgo(n.timestamp)}</p>
                  </div>
                </div>
              ))}
              {notifications.length > 30 && (
                <button
                  onClick={() => { setBellOpen(false); navigate('/history') }}
                  className="w-full pt-3 pb-1 flex items-center justify-center gap-1.5 font-rubik text-sm font-semibold text-brown-500 active:opacity-70 cursor-pointer"
                >
                  {"הצג הכל"}
                  <ChevronLeft size={14} className="text-brown-400" />
                </button>
              )}
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
