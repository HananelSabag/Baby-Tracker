import { cn } from '../../lib/utils'

// Shimmer placeholder. `.skeleton` lives in index.css so the sweep animation can
// be disabled by the reduce-motion accessibility preference.
export function Skeleton({ className, rounded = 'rounded-xl' }) {
  return <div className={cn('skeleton', rounded, className)} />
}

// Stand-in for the home page while trackers + events load. Mirrors the real
// layout (hero card, then a stack of tracker cards) so nothing jumps when the
// data arrives — a centred spinner gave no hint of the shape to come.
export function HomeSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {/* Hero card */}
      <div className="bg-white rounded-3xl border border-cream-200 overflow-hidden" style={CARD_SHADOW}>
        <div className="px-4 pt-4 pb-4" style={{ background: 'linear-gradient(145deg, #FFFBF5 0%, #FFF3E0 100%)' }}>
          <Skeleton className="w-24 h-3.5 mb-3" rounded="rounded-lg" />
          <div className="rounded-2xl bg-cream-100/70 px-4 py-3 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="w-20 h-2.5" rounded="rounded" />
              <Skeleton className="w-24 h-7" rounded="rounded-lg" />
              <Skeleton className="w-16 h-2.5" rounded="rounded" />
            </div>
            <Skeleton className="w-14 h-10" rounded="rounded-lg" />
          </div>
        </div>
        <div className="px-4 py-3.5 border-t border-cream-100 flex gap-2.5">
          <Skeleton className="w-24 h-14" rounded="rounded-2xl" />
          <Skeleton className="w-24 h-14" rounded="rounded-2xl" />
          <Skeleton className="w-20 h-14" rounded="rounded-2xl" />
        </div>
      </div>

      {/* Tracker cards */}
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-3xl border border-cream-200 p-5" style={CARD_SHADOW}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8" rounded="rounded-xl" />
              <Skeleton className="w-24 h-4" rounded="rounded" />
            </div>
            <Skeleton className="w-9 h-9" rounded="rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-12" rounded="rounded-xl" />
            <Skeleton className="flex-1 h-12" rounded="rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

const CARD_SHADOW = {
  boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
}
