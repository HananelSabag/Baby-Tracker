import { cn } from '../../lib/utils'

export function Card({ children, className, onClick, compact = false }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-3xl shadow-card',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer active:scale-98 transition-transform',
        className
      )}
    >
      {children}
    </div>
  )
}
