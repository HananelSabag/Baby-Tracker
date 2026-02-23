import { cn } from '../../lib/utils'

export function Button({ children, variant = 'primary', size = 'md', className, disabled, onClick, type = 'button' }) {
  const base = 'font-rubik font-medium rounded-2xl transition-all active:scale-95 focus:outline-none select-none'

  const variants = {
    primary: 'bg-amber-600 text-white shadow-soft hover:bg-amber-700 active:bg-amber-700',
    secondary: 'bg-cream-200 text-brown-700 hover:bg-cream-300',
    ghost: 'text-brown-600 hover:bg-cream-200',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    tracker: 'text-white shadow-soft hover:opacity-90',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
    icon: 'w-11 h-11 flex items-center justify-center text-xl',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, variants[variant], sizes[size], disabled && 'opacity-40 cursor-not-allowed', className)}
    >
      {children}
    </button>
  )
}
