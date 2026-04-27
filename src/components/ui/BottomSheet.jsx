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
        className="absolute inset-0 bg-brown-800/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={cn(
        'relative w-full max-w-[480px] bg-cream-100 rounded-t-4xl shadow-2xl animate-slide-up',
        'pb-safe'
      )}>
        {/* Handle */}
        {!hero && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-cream-300 rounded-full" />
          </div>
        )}

        {!hero && title && (
          <h2 className="font-rubik font-semibold text-brown-800 text-lg text-center py-3 px-4">
            {title}
          </h2>
        )}

        <div className={hero ? '' : 'px-4 pb-6'}>
          {children}
        </div>
      </div>
    </div>
  )
}
