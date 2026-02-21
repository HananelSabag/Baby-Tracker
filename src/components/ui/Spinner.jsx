import { cn } from '../../lib/utils'

export function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className={cn('animate-spin rounded-full border-2 border-cream-300 border-t-brown-600', sizes[size], className)} />
  )
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100">
      <Spinner size="lg" />
    </div>
  )
}
