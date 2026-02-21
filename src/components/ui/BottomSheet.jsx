import { useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'

export function BottomSheet({ isOpen, onClose, title, children }) {
  const overlayRef = useRef(null)

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-brown-800/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={cn(
        'relative w-full max-w-[480px] bg-cream-100 rounded-t-4xl shadow-2xl animate-slide-up',
        'pb-safe'
      )}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-cream-300 rounded-full" />
        </div>

        {title && (
          <h2 className="font-rubik font-semibold text-brown-800 text-lg text-center py-3 px-4">
            {title}
          </h2>
        )}

        <div className="px-4 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
