import { cn } from '../../lib/utils'

export function Card({ children, className, onClick, compact = false }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-3xl border border-cream-200',
        compact ? 'p-3' : 'p-5',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className
      )}
      style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
    >
      {children}
    </div>
  )
}
