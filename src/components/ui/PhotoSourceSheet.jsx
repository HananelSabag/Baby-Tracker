import { BottomSheet } from './BottomSheet'

// Shared "Take photo / Pick from gallery" sheet. Keeps the visual language
// identical across user avatar, kid avatar, and any future image upload.
//
// Props:
//   isOpen    — controlled
//   onClose   — close handler
//   onPick    — async (mode: 'camera' | 'gallery') => void
//   title     — optional override
export function PhotoSourceSheet({ isOpen, onClose, onPick, title = 'תמונה' }) {
  function handle(mode) {
    onClose()
    // Defer to next tick — closing the sheet first lets the file picker
    // open without the sheet's backdrop swallowing the tap on iOS.
    setTimeout(() => onPick(mode), 50)
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2 pb-2">
        <button
          onClick={() => handle('camera')}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-[#8B5E3C] text-white active:opacity-90 transition-opacity"
        >
          <span className="text-2xl">📸</span>
          <span className="font-rubik font-semibold text-base">צלם תמונה עכשיו</span>
        </button>
        <button
          onClick={() => handle('gallery')}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-cream-100 active:bg-cream-200 transition-colors"
        >
          <span className="text-2xl">🖼️</span>
          <span className="font-rubik font-semibold text-brown-700 text-base">בחר מהגלריה</span>
        </button>
        <button
          onClick={onClose}
          className="px-4 py-3 rounded-2xl text-brown-400 font-rubik text-sm active:bg-cream-100 transition-colors"
        >
          ביטול
        </button>
      </div>
    </BottomSheet>
  )
}
