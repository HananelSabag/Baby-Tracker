import { useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'

export function BottomSheet({ isOpen, onClose, title, children, hero = false }) {
  const overlayRef = useRef(null)
  const onCloseRef = useRef(onClose)

  // Keep ref current without re-running the history effect
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Intercept OS back gesture: close the sheet instead of navigating away.
  // Depends only on isOpen — onClose is accessed via ref so a new function
  // reference from the parent never re-triggers this effect.
  useEffect(() => {
    if (!isOpen) return

    const sheetId = Date.now()
    window.history.pushState({ sheetId }, '')
    let closedByBackGesture = false

    function handlePopState() {
      closedByBackGesture = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // Only pop the history entry we pushed if the sheet was NOT closed by a
      // back gesture (in that case the browser already popped it) and the state
      // still matches (navigation may have replaced it, in which case we must
      // not call history.back() or we'd undo the navigation).
      if (!closedByBackGesture && window.history.state?.sheetId === sheetId) {
        window.history.back()
      }
    }
  }, [isOpen]) // intentionally excludes onClose — use onCloseRef instead

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-brown-800/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-[480px] bg-cream-50 rounded-t-4xl animate-slide-up',
          'pb-safe'
        )}
        style={{ boxShadow: '0 -8px 40px rgba(61,43,31,0.18), inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        {/* Handle */}
        {!hero && (
          <div className="flex justify-center pt-3.5 pb-1">
            <div className="w-12 h-1.5 bg-cream-300 rounded-full" />
          </div>
        )}

        {!hero && title && (
          <div className="px-4 pt-2 pb-3 border-b border-cream-200">
            <h2 className="font-rubik font-bold text-brown-800 text-lg text-center">
              {title}
            </h2>
          </div>
        )}

        <div className={hero ? '' : 'px-4 pt-4 pb-6'}>
          {children}
        </div>
      </div>
    </div>
  )
}
