import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useChildren } from '../hooks/useChildren'
import { useHomeEvents } from '../hooks/useHomeEvents'
import { TRACKER_TYPES } from '../lib/constants'
import { FeedingCard } from '../components/trackers/FeedingCard'
import { VitaminDCard } from '../components/trackers/VitaminDCard'
import { DiaperCard } from '../components/trackers/DiaperCard'
import { SleepCard } from '../components/trackers/SleepCard'
import { CustomTrackerCard } from '../components/trackers/CustomTrackerCard'
import { GrowthCard } from '../components/trackers/GrowthCard'
import { HeroCard } from '../components/trackers/HeroCard'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Spinner } from '../components/ui/Spinner'
import { format, addDays, subDays, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { formatTime, cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

export function HomePage() {
  const { identity, setActiveChildId, notifications, unreadCount, markNotificationsRead, setMemberAvatarUrl } = useApp()
  const navigate = useNavigate()
  const { trackers: allTrackers, loading } = useTrackers(identity.familyId)
  const trackers = allTrackers.filter(t => t.is_active !== false)
  const { children } = useChildren(identity.familyId)
  const [childPickerOpen, setChildPickerOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [bellOpen, setBellOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [localOrder, setLocalOrder] = useState([])
  const [saving, setSaving] = useState(false)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const avatarFileRef = useRef(null)

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
  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null
  const { eventsByTracker } = useHomeEvents(identity.familyId, viewDate, activeChild?.id ?? null)
  const todayLabel = format(new Date(), 'EEEE, d בMMMM', { locale: he })
  const dateLabel = isToday ? 'היום' : format(viewDate, 'd/M', { locale: he })

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
    setSaving(true)
    try {
      await Promise.all(
        localOrder.map((tracker, index) =>
          supabase.from('trackers').update({ display_order: index, is_active: tracker._visible }).eq('id', tracker.id)
        )
      )
    } finally {
      setSaving(false)
      setEditMode(false)
    }
  }

  function handleBellClick() {
    markNotificationsRead()
    setBellOpen(prev => !prev)
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const ext = file.name.split('.').pop()
      const path = `members/${identity.memberId}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setMemberAvatarUrl(data.publicUrl)
      await supabase.from('members').update({ avatar_url: data.publicUrl }).eq('id', identity.memberId)
    } catch { /* silent */ }
    setProfileSheetOpen(false)
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
      case TRACKER_TYPES.DOSE:      return tracker.config?.display_mode === 'simple'
                                      ? <CustomTrackerCard key={tracker.id} {...props} compact={inGrid} />
                                      : <VitaminDCard key={tracker.id} {...props} />
      case TRACKER_TYPES.GROWTH:    return <GrowthCard key={tracker.id} {...props} child={activeChild} />
      default:                      return <CustomTrackerCard key={tracker.id} {...props} compact={inGrid} />
    }
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Backdrop to close bell dropdown */}
      {bellOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-rubik text-brown-400 text-sm capitalize">{todayLabel}</p>
          <h1 className="font-rubik font-bold text-3xl text-brown-800">
            שלום, {identity.memberName} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit / Done button */}
          {editMode && (
            <button
              onClick={saveAndExit}
              disabled={saving}
              className="px-3 py-1.5 rounded-full bg-brown-800 text-white font-rubik font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60"
            >
              {saving ? '...' : 'סיום'}
            </button>
          )}

          {/* Notification bell + edit button stacked */}
          <div className="relative flex flex-col items-center gap-0.5">
            <button
              onClick={handleBellClick}
              className="w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center text-lg active:scale-95 transition-transform relative"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center font-rubik">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {bellOpen && (
              <div className="absolute left-0 top-12 w-72 bg-white rounded-2xl shadow-lg z-50 overflow-hidden border border-cream-200">
                <div className="px-4 py-3 border-b border-cream-200">
                  <p className="font-rubik font-semibold text-brown-800 text-sm">{t('notifications.title')}</p>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-center text-brown-400 font-rubik text-sm py-6">{t('notifications.noNotifications')}</p>
                ) : (
                  <>
                    {notifications.slice(0, 3).map(n => (
                      <div key={n.id} className="px-4 py-3 flex items-start gap-3 border-b border-cream-100 last:border-0">
                        <span className="text-xl flex-shrink-0">{n.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-rubik text-sm text-brown-700 leading-tight">{n.message}</p>
                          <p className="font-rubik text-xs text-brown-400 mt-0.5">{formatTime(n.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                    {notifications.length > 3 && (
                      <button
                        onClick={() => { setBellOpen(false); navigate('/history') }}
                        className="w-full py-3 text-center font-rubik text-sm font-semibold text-brown-600 hover:bg-cream-100 transition-colors"
                      >
                        {t('notifications.showAll')} ›
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {!editMode && (
              <button
                onClick={enterEditMode}
                className="w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center text-base active:scale-95 transition-transform"
                aria-label="עריכת תצוגה"
              >
                ✏️
              </button>
            )}
            <span className="font-rubik text-[9px] text-brown-300 leading-none">
              {editMode ? '' : 'עריכת תצוגה'}
            </span>
          </div>

          {/* Avatar — tap to open profile sheet */}
          <button
            onClick={() => setProfileSheetOpen(true)}
            className="w-12 h-12 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0 shadow-soft border-2 border-white active:scale-95 transition-transform"
          >
            {(identity.memberAvatarUrl || identity.googleAvatarUrl)
              ? <img
                  src={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
                  alt={identity.memberName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              : <span className="text-2xl">👤</span>
            }
          </button>
        </div>
      </div>

      {/* Child + inline date nav bar */}
      <div className="flex items-center gap-2 bg-white rounded-2xl shadow-soft px-3 py-2.5 mb-4">
        {activeChild ? (
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-right active:opacity-70 transition-opacity"
            onClick={() => children.length > 1 && setChildPickerOpen(true)}
            style={{ cursor: children.length > 1 ? 'pointer' : 'default' }}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0">
              {activeChild.avatar_url
                ? <img src={activeChild.avatar_url} alt={activeChild.name} className="w-full h-full object-cover" />
                : <span className="text-sm">👶</span>
              }
            </div>
            <div className="min-w-0">
              <p className="font-rubik font-semibold text-brown-800 text-sm leading-tight truncate">{activeChild.name}</p>
              <p className="font-rubik text-brown-400 text-xs leading-tight">מעקב עבור{children.length > 1 ? ' · החלף ›' : ''}</p>
            </div>
          </button>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setViewDate(d => subDays(d, 1))}
            className="w-7 h-7 rounded-full bg-cream-100 text-brown-600 font-bold flex items-center justify-center active:scale-95 transition-transform text-lg leading-none"
          >‹</button>
          <button
            onClick={() => !isToday && setViewDate(new Date())}
            className={cn(
              'font-rubik font-medium text-sm px-2 py-0.5 rounded-full transition-colors min-w-[44px] text-center',
              isToday ? 'text-brown-600' : 'text-amber-700 bg-amber-50'
            )}
          >
            {dateLabel}
          </button>
          <button
            onClick={() => setViewDate(d => addDays(d, 1))}
            disabled={isToday}
            className="w-7 h-7 rounded-full bg-cream-100 text-brown-600 font-bold flex items-center justify-center active:scale-95 transition-transform text-lg leading-none disabled:opacity-25"
          >›</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Hero card — hidden in edit mode */}
          {!editMode && (
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
            <div className="flex items-center justify-center gap-4 pb-1">
              <p className="font-rubik text-xs text-brown-400">גרור לשינוי סדר · לחץ עין להסתרה</p>
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
                  className="flex items-center justify-center w-10 flex-shrink-0 bg-white rounded-2xl shadow-card cursor-grab active:cursor-grabbing select-none touch-none"
                  onTouchStart={(e) => handleTouchHandleStart(e, index)}
                  onTouchMove={handleTouchHandleMove}
                  onTouchEnd={handleTouchHandleEnd}
                >
                  <span className="text-brown-300 text-xl leading-none">⠿</span>
                </div>
                {/* Card with visibility-based styling */}
                <div className={cn('flex-1 rounded-3xl ring-2 overflow-hidden transition-opacity', tracker._visible ? 'ring-brown-200 opacity-100' : 'ring-cream-300 opacity-40')}>
                  {renderTracker(tracker)}
                </div>
                {/* Eye toggle */}
                <button
                  onClick={() => toggleVisible(index)}
                  className="flex items-center justify-center w-10 flex-shrink-0 bg-white rounded-2xl shadow-card active:scale-95 transition-transform select-none"
                >
                  <span className="text-lg leading-none">{tracker._visible ? '👁️' : '🙈'}</span>
                </button>
              </div>
            ))
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
        title={t('children.switchChild')}
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
      <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <BottomSheet isOpen={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} title="">
        <div className="flex flex-col pb-2 -mx-4 -mt-2">
          {/* Hero banner photo */}
          <div className="relative w-full h-52 bg-gradient-to-br from-amber-100 to-cream-200 overflow-hidden">
            {(identity.memberAvatarUrl || identity.googleAvatarUrl)
              ? <img
                  src={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
                  alt={identity.memberName}
                  className="w-full h-full object-cover object-top"
                />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl opacity-40">👤</span>
                </div>
            }
            {/* gradient fade at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/90 to-transparent" />
            {/* Name overlay */}
            <div className="absolute bottom-3 right-4 text-right">
              <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight drop-shadow-sm">{identity.memberName}</p>
              <p className="font-rubik text-brown-500 text-xs">{identity.email}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 px-4 pt-4">
            <button
              onClick={() => avatarFileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cream-100 active:bg-cream-200 transition-colors"
            >
              <span className="text-lg">📷</span>
              <span className="font-rubik font-medium text-brown-700 text-sm">החלף תמונה</span>
            </button>
            <button
              onClick={() => { setProfileSheetOpen(false); navigate('/profile') }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#8B5E3C] active:opacity-90 transition-opacity"
            >
              <span className="text-lg">👤</span>
              <span className="font-rubik font-medium text-white text-sm">גש לפרופיל</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
