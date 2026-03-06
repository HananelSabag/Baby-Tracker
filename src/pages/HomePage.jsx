import { useState } from 'react'
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

export function HomePage() {
  const { identity, setActiveChildId, notifications, unreadCount, markNotificationsRead } = useApp()
  const navigate = useNavigate()
  const { trackers: allTrackers, loading } = useTrackers(identity.familyId)
  const trackers = allTrackers.filter(t => t.is_active !== false)
  const { children } = useChildren(identity.familyId)
  const [childPickerOpen, setChildPickerOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [bellOpen, setBellOpen] = useState(false)

  const isToday = isSameDay(viewDate, new Date())
  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null

  const { eventsByTracker } = useHomeEvents(identity.familyId, viewDate, activeChild?.id ?? null)

  const todayLabel = format(new Date(), 'EEEE, d בMMMM', { locale: he })
  const dateLabel = isToday ? 'היום' : format(viewDate, 'd/M', { locale: he })

  function handleBellClick() {
    markNotificationsRead()
    setBellOpen(prev => !prev)
  }

  // Trackers that render in 2-col grid when consecutive (custom + simple dose)
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
      case TRACKER_TYPES.FEEDING:   return <FeedingCard key={tracker.id} {...props} compact />
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
          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={handleBellClick}
              className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-xl active:scale-95 transition-transform"
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
          </div>

          {/* Avatar */}
          <div className="w-12 h-12 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0 shadow-soft border-2 border-white">
            {(identity.memberAvatarUrl || identity.googleAvatarUrl)
              ? <img
                  src={identity.memberAvatarUrl ?? identity.googleAvatarUrl}
                  alt={identity.memberName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              : <span className="text-2xl">👤</span>
            }
          </div>
        </div>
      </div>

      {/* Child + inline date nav bar */}
      <div className="flex items-center gap-2 bg-white rounded-2xl shadow-soft px-3 py-2.5 mb-4">
        {/* Child avatar + name */}
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

        {/* Inline date navigation — always visible */}
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
          {/* Hero summary card */}
          <HeroCard trackers={trackers} eventsByTracker={eventsByTracker} isToday={isToday} child={activeChild} />

          {/* Compact action cards */}
          {groupTrackers(trackers).map((group) =>
            group.type === 'pair' ? (
              <div key={`pair-${group.items[0].id}`} className="grid grid-cols-2 gap-3">
                {group.items.map(tr => renderTracker(tr, true))}
              </div>
            ) : (
              renderTracker(group.item)
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
    </div>
  )
}
