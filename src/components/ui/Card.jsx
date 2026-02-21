import { cn } from '../../lib/utils'

export function Card({ children, className, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-3xl shadow-card p-4',
        onClick && 'cursor-pointer active:scale-98 transition-transform',
        className
      )}
    >
      {children}
    </div>
  )
}
