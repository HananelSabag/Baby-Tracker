import { useState } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useChildren } from '../hooks/useChildren'
import { TRACKER_TYPES } from '../lib/constants'
import { FeedingCard } from '../components/trackers/FeedingCard'
import { VitaminDCard } from '../components/trackers/VitaminDCard'
import { DiaperCard } from '../components/trackers/DiaperCard'
import { CustomTrackerCard } from '../components/trackers/CustomTrackerCard'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Spinner } from '../components/ui/Spinner'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

export function HomePage() {
  const { identity, setActiveChildId } = useApp()
  const { trackers, loading } = useTrackers(identity.familyId)
  const { children } = useChildren(identity.familyId)
  const [childPickerOpen, setChildPickerOpen] = useState(false)

  const today = format(new Date(), 'EEEE, d בMMMM', { locale: he })
  const activeChild = children.find(c => c.id === identity.activeChildId) ?? children[0] ?? null

  function renderTracker(tracker) {
    const props = {
      key: tracker.id,
      tracker,
      familyId: identity.familyId,
      memberId: identity.memberId,
      childId: activeChild?.id ?? null,
    }
    switch (tracker.tracker_type) {
      case TRACKER_TYPES.FEEDING:   return <FeedingCard {...props} />
      case TRACKER_TYPES.VITAMIN_D: return <VitaminDCard {...props} />
      case TRACKER_TYPES.DIAPER:    return <DiaperCard {...props} />
      case TRACKER_TYPES.DOSE:      return <VitaminDCard {...props} />
      default:                      return <CustomTrackerCard {...props} />
    }
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-rubik text-brown-400 text-sm capitalize">{today}</p>
          <h1 className="font-rubik font-bold text-3xl text-brown-800">
            שלום, {identity.memberName} 👋
          </h1>
        </div>
        <div className="w-12 h-12 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0 shadow-soft border-2 border-white">
          {(identity.memberAvatarUrl || identity.googleAvatarUrl)
            ? <img src={identity.memberAvatarUrl ?? identity.googleAvatarUrl} alt={identity.memberName} className="w-full h-full object-cover" />
            : <span className="text-2xl">👤</span>
          }
        </div>
      </div>

      {/* Child selector */}
      {activeChild && (
        <button
          onClick={() => children.length > 1 && setChildPickerOpen(true)}
          className="flex items-center gap-3 bg-white rounded-2xl shadow-soft px-4 py-3 mb-5 w-full text-right transition-transform"
          style={{ cursor: children.length > 1 ? 'pointer' : 'default' }}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0">
            {activeChild.avatar_url
              ? <img src={activeChild.avatar_url} alt={activeChild.name} className="w-full h-full object-cover" />
              : <span className="text-xl">👶</span>
            }
          </div>
          <div className="flex-1 text-right">
            <p className="font-rubik font-semibold text-brown-800 text-base leading-tight">{activeChild.name}</p>
            <p className="font-rubik text-brown-400 text-xs">מעקב עבור</p>
          </div>
          {children.length > 1 && (
            <span className="text-brown-400 text-sm">החלף ›</span>
          )}
        </button>
      )}

      {/* Trackers */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-3">
          {trackers.map(renderTracker)}
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
