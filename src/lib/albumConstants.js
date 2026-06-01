export const MONTH_LABELS = [
  'חודש ראשון', 'חודש שני', 'חודש שלישי', 'חודש רביעי',
  'חודש חמישי', 'חודש שישי', 'חודש שביעי', 'חודש שמיני',
  'חודש תשיעי', 'חודש עשירי', 'חודש אחד עשר', 'שנה ראשונה',
]

// ASCII-safe names for ZIP filenames (avoid Hebrew/emoji on Windows)
export const MONTH_FILENAMES = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12-birthday',
]

export const HE_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export const EFFECTS = [
  { id: 'none',   label: 'רגיל',     filter: '',                                previewBg: '#FFF8F0' },
  { id: 'warm',   label: 'חם',       filter: 'sepia(0.25) brightness(1.08)',    previewBg: '#FED7AA' },
  { id: 'sepia',  label: 'ספייה',    filter: 'sepia(0.6)',                      previewBg: '#FDE68A' },
  { id: 'bw',     label: 'שחור-לבן', filter: 'grayscale(1)',                    previewBg: '#D1D5DB' },
  { id: 'bright', label: 'בהיר',     filter: 'brightness(1.18) contrast(0.95)', previewBg: '#BAE6FD' },
]

// insetPx / color are used for the UI inset-shadow frame overlay (works inside overflow-hidden)
// canvasColor is used by the Canvas export pipeline
export const FRAMES = [
  { id: 'none',  label: 'ללא',  insetPx: 0,  color: null,      canvasColor: null },
  { id: 'white', label: 'לבן',  insetPx: 6,  color: '#FFFFFF', canvasColor: '#FFFFFF' },
  { id: 'cream', label: 'קרם',  insetPx: 6,  color: '#FFF8F0', canvasColor: '#FFF8F0' },
  { id: 'gold',  label: 'זהב',  insetPx: 5,  color: '#F5C842', canvasColor: '#F5C842' },
  { id: 'dark',  label: 'כהה',  insetPx: 5,  color: '#3D2B1F', canvasColor: '#3D2B1F' },
]

export function getEffect(effectId) { return EFFECTS.find(e => e.id === effectId) ?? EFFECTS[0] }
export function getFrame(frameId)   { return FRAMES.find(f => f.id === frameId)   ?? FRAMES[0] }

export const SUPABASE_MUSIC_URL = 'https://ssvrfjmlmeilanwgppko.supabase.co/storage/v1/object/public/Music'

export const MUSIC_TRACKS = [
  { id: 'BabyBass',     label: 'בייבי בס',     emoji: '🎸' },
  { id: 'BabySleep',    label: 'שיר ערש',       emoji: '🌙' },
  { id: 'Calmbabysong', label: 'מנגינה רגועה',  emoji: '🎵' },
  { id: 'Carnvel',      label: 'קרנבל',         emoji: '🎪' },
  { id: 'HappyDance',   label: 'ריקוד שמח',     emoji: '💃' },
  { id: 'HappyJoyBaby', label: 'שמחה ועליצות',  emoji: '🎉' },
  { id: 'HappyPiano',   label: 'פסנתר שמח',     emoji: '🎹' },
  { id: 'Hiphop',       label: 'היפ הופ',       emoji: '🎤' },
]

export const VIDEO_SIZE       = 1080
export const TRANSITION_MS    = 600
export const TRANSITION_STEPS = 20
export const GIF_SIZE         = 600
export const PREVIEW_SIZE     = 160

// gifenc delay is in centiseconds (gifenc divides ms by 10 internally);
// same values are used as actual ms for the video frameDuration.
export const GIF_SPEED_MS = { slow: 4500, normal: 2800, fast: 1500 }

// ── Canvas export constants ────────────────────────────────────────────────────
export const CANVAS_SIZE        = 2100 // 7 inches × 300 DPI
export const CANVAS_FRAME_WIDTH = 60
