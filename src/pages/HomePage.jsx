import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { TRACKER_TYPES } from '../lib/constants'
import { FeedingCard } from '../components/trackers/FeedingCard'
import { VitaminDCard } from '../components/trackers/VitaminDCard'
import { DiaperCard } from '../components/trackers/DiaperCard'
import { CustomTrackerCard } from '../components/trackers/CustomTrackerCard'
import { Spinner } from '../components/ui/Spinner'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

export function HomePage() {
  const { identity } = useApp()
  const { trackers, loading } = useTrackers(identity.familyId)

  const today = format(new Date(), 'EEEE, d בMMMM', { locale: he })

  function renderTracker(tracker) {
    const props = { key: tracker.id, tracker, familyId: identity.familyId, memberId: identity.memberId }
    switch (tracker.tracker_type) {
      case TRACKER_TYPES.FEEDING:   return <FeedingCard {...props} />
      case TRACKER_TYPES.VITAMIN_D: return <VitaminDCard {...props} />
      case TRACKER_TYPES.DIAPER:    return <DiaperCard {...props} />
      case TRACKER_TYPES.DOSE:      return <VitaminDCard {...props} /> // reuse dose UI
      default:                      return <CustomTrackerCard {...props} />
    }
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <p className="font-rubik text-brown-400 text-sm capitalize">{today}</p>
        <h1 className="font-rubik font-bold text-3xl text-brown-800">
          שלום, {identity.memberName} 👋
        </h1>
      </div>

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
    </div>
  )
}
