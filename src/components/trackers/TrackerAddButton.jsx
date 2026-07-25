import { Plus } from 'lucide-react'
import { cn } from '../../lib/utils'

// The round "+" that opens a tracker's entry sheet.
//
// Each card used to roll its own — w-8 vs w-9, text-lg vs text-xl, with and
// without a shadow — so the home page had four slightly different plus buttons
// stacked down the screen. One component, one size, one shadow.
// `decorative` renders a non-interactive span instead of a button, for cards
// where the whole surface is already the click target — nesting a button there
// would double-fire the handler and confuse screen readers.
export function TrackerAddButton({ color, onClick, disabled, label = 'הוסף', className, decorative = false }) {
  const shared = cn(
    'w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0',
    !decorative && 'active:scale-90 transition-transform duration-150 cursor-pointer disabled:opacity-50 disabled:active:scale-100',
    className,
  )
  const style = {
    backgroundColor: color,
    boxShadow: `0 3px 10px ${color}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
  }
  const glyph = <Plus size={19} strokeWidth={2.6} />

  if (decorative) {
    return <span className={shared} style={style} aria-hidden="true">{glyph}</span>
  }

  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className={shared} style={style}>
      {glyph}
    </button>
  )
}
