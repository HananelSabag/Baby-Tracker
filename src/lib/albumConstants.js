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

// Two quality tiers for the video export, picked at record time by which codec
// the browser actually supports (see generateAlbumVideo):
//   • MP4/H.264 (Chrome, Safari, Edge, virtually every phone) — hardware-encoded
//     on essentially all modern devices, so it can push more resolution/bitrate
//     safely.
//   • WebM/VP8 (the fallback for the handful of browsers without MP4 recording,
//     mainly desktop Firefox) — software-encoded, so it keeps the original,
//     already-tuned-for-mobile settings rather than risking dropped frames.
export const VIDEO_SIZE           = 1080
export const VIDEO_BITRATE        = 8_000_000
export const VIDEO_SIZE_HQ        = 1440
export const VIDEO_BITRATE_HQ     = 16_000_000
export const TRANSITION_MS    = 600
export const GIF_SIZE         = 600
export const PREVIEW_SIZE     = 160

// Number of intermediate cross-fade frames inserted between two photos in the
// GIF so the dissolve looks smooth instead of a hard cut. Balanced for the
// WhatsApp use case — smooth, but small enough that a full 12-month album stays
// shareable (the video export is the path for maximum smoothness/quality).
export const GIF_TRANSITION_FRAMES = 3

// gifenc delay is in centiseconds (gifenc divides ms by 10 internally);
// same values are used as actual ms for the video frameDuration.
export const GIF_SPEED_MS = { slow: 4500, normal: 2800, fast: 1500 }

// ── Canvas export constants ────────────────────────────────────────────────────
export const CANVAS_SIZE = 2100 // 7 inches × 300 DPI
