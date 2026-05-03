import { cn } from '../../lib/utils'

export function Button({ children, variant = 'primary', size = 'md', className, disabled, onClick, type = 'button' }) {
  const base = 'font-rubik font-semibold rounded-2xl transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 select-none cursor-pointer'

  const variants = {
    primary: 'bg-amber-600 text-white border border-amber-700/25 hover:bg-amber-500 active:bg-amber-700',
    secondary: 'bg-cream-200 text-brown-700 border border-cream-300 hover:bg-cream-300',
    ghost: 'text-brown-600 hover:bg-cream-100',
    danger: 'bg-red-500 text-white border border-red-600/20 hover:bg-red-600',
    tracker: 'text-white border border-white/20 hover:opacity-90',
  }

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-5 py-3 text-base min-h-[44px]',
    lg: 'px-6 py-4 text-lg min-h-[52px]',
    icon: 'w-11 h-11 flex items-center justify-center text-xl',
  }

  const shadows = {
    primary: '0 4px 14px rgba(180,93,20,0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
    secondary: '0 2px 8px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.85)',
    ghost: 'none',
    danger: '0 4px 12px rgba(239,68,68,0.24), inset 0 1px 0 rgba(255,255,255,0.14)',
    tracker: '0 4px 16px rgba(61,43,31,0.18), inset 0 1px 0 rgba(255,255,255,0.18)',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={!disabled ? { boxShadow: shadows[variant] } : undefined}
      className={cn(base, variants[variant], sizes[size], disabled && 'opacity-40 cursor-not-allowed', className)}
    >
      {children}
    </button>
  )
}
