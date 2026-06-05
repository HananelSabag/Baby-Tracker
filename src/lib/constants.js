// Tracker type identifiers
export const TRACKER_TYPES = {
  FEEDING: 'feeding',
  VITAMIN_D: 'vitamin_d',
  DIAPER: 'diaper',
  DOSE: 'dose',    // generic configurable dose tracker (medicine, vitamins, etc.)
  SLEEP: 'sleep',
  GROWTH: 'growth', // weight + height tracking with WHO growth curve comparison
  CUSTOM: 'custom',
}

// Archetypes shown in the "Add tracker" creation wizard
export const TRACKER_ARCHETYPES = [
  {
    id: 'dose',
    icon: '💊',
    label: 'מינון',
    description: 'תרופה, ויטמין — לפי מספר מינונים ביום',
    tracker_type: 'dose',
  },
  {
    id: 'stamp',
    icon: '✅',
    label: 'סימון',
    description: 'סמן שמשהו קרה — אמבטיה, שינה, טיפול',
    tracker_type: 'custom',
  },
  {
    id: 'measure',
    icon: '📏',
    label: 'מדידה',
    description: 'רשום ערך — חום, כמות מ"ל, משקל',
    tracker_type: 'custom',
  },
]

// Built-in tracker definitions (seeded per family on creation)
export const BUILTIN_TRACKERS = [
  {
    name: 'האכלה',
    icon: '🍼',
    color: '#6B9E8C',
    tracker_type: TRACKER_TYPES.FEEDING,
    display_order: 0,
    is_builtin: true,
    field_schema: [{ key: 'amount_ml', type: 'number', label: 'כמות מ"ל' }],
    config: {},
  },
  {
    name: 'ויטמין D',
    icon: '☀️',
    color: '#E8B84B',
    tracker_type: TRACKER_TYPES.VITAMIN_D,
    display_order: 1,
    is_builtin: true,
    field_schema: [{ key: 'dose', type: 'choice', label: 'מינון', options: ['morning', 'evening'] }],
    config: { daily_doses: 2, dose_labels: ['בוקר', 'ערב'] },
  },
  {
    name: 'חיתול',
    icon: '👶',
    color: '#9B8EC4',
    tracker_type: TRACKER_TYPES.DIAPER,
    display_order: 2,
    is_builtin: true,
    field_schema: [{ key: 'type', type: 'choice', label: 'סוג', options: ['wet', 'dirty', 'both'] }],
    config: {},
  },
  {
    name: 'שינה',
    icon: '🌙',
    color: '#7BA7E8',
    tracker_type: TRACKER_TYPES.SLEEP,
    display_order: 3,
    is_builtin: true,
    field_schema: [{ key: 'type', type: 'choice', label: 'סוג', options: ['start', 'end'] }],
    config: {},
  },
  {
    name: 'גדילה',
    icon: '⚖️',
    color: '#5BAD6F',
    tracker_type: TRACKER_TYPES.GROWTH,
    display_order: 4,
    is_builtin: true,
    field_schema: [
      { key: 'weight_kg', type: 'number', label: 'משקל (ק"ג)' },
      { key: 'height_cm', type: 'number', label: 'גובה (ס"מ)' },
    ],
    config: {},
  },
]

// Feeding preset amounts in ml
export const FEEDING_PRESETS = [30, 60, 90, 120, 150, 180]

// Roles that are allowed to manage children (add / edit / delete)
export const PARENT_ROLES = ['אמא', 'אבא']

// Available roles for family members
export const ROLES = [
  { value: 'אבא', label: 'אבא', emoji: '👨' },
  { value: 'אמא', label: 'אמא', emoji: '👩' },
  { value: 'סבא', label: 'סבא', emoji: '👴' },
  { value: 'סבתא', label: 'סבתא', emoji: '👵' },
  { value: 'אחר', label: 'אחר', emoji: '👤' },
]

// Custom field types available for new trackers
export const FIELD_TYPES = [
  { value: 'number', label: 'מספר' },
  { value: 'text', label: 'טקסט חופשי' },
  { value: 'choice', label: 'בחירה מרשימה' },
  { value: 'boolean', label: 'כן / לא' },
]

// Color palette for custom trackers
export const TRACKER_COLORS = [
  '#6B9E8C', '#E8B84B', '#9B8EC4', '#E87B7B',
  '#7BA7E8', '#E8A87B', '#8EC47B', '#C47BB5',
  '#7BE8D4', '#E8C97B',
]

// Grouped icon categories — used by IconPicker in wizard + edit sheet
export const TRACKER_ICON_CATEGORIES = [
  {
    id: 'medicine',
    label: 'רפואה וויטמינים',
    icons: ['💊', '💉', '🩸', '🧪', '🩺', '🌡️', '🩹', '🏥', '🧴', '🔬', '🩻', '🧬', '🫁'],
  },
  {
    id: 'care',
    label: 'טיפול ושגרה',
    icons: ['🛁', '🚿', '👶', '🍼', '🤱', '🧷', '🚼', '🪆', '🛏️', '🧸', '🎵', '🎒'],
  },
  {
    id: 'measure',
    label: 'מדידה ומעקב',
    icons: ['⚖️', '📏', '📊', '📈', '🔢', '⏱️', '🧮', '💧', '🥛', '❄️', '🔥', '🎚️'],
  },
  {
    id: 'activity',
    label: 'פעילות ומשחק',
    icons: ['🎨', '🧩', '🎠', '🪀', '🤸', '🏊', '🌟', '🌈', '🦋', '🐻', '🎭', '🎯'],
  },
  {
    id: 'nature',
    label: 'טבע ותוספים',
    icons: ['🌿', '🌊', '☀️', '🌙', '⭐', '🌸', '🐣', '🍃', '🫐', '🍋', '🌻', '🌅'],
  },
]

// Which categories to show per archetype in the wizard
export const ARCHETYPE_ICON_CATEGORY_IDS = {
  dose:    ['medicine', 'nature'],
  stamp:   ['care', 'activity'],
  measure: ['measure', 'care'],
}

// Flat combined list for backward compat
export const TRACKER_ICONS = TRACKER_ICON_CATEGORIES.flatMap(c => c.icons)

// Keep old named exports for anything still importing them
export const DOSE_ICONS    = TRACKER_ICON_CATEGORIES.find(c => c.id === 'medicine').icons
export const STAMP_ICONS   = TRACKER_ICON_CATEGORIES.find(c => c.id === 'care').icons
export const MEASURE_ICONS = TRACKER_ICON_CATEGORIES.find(c => c.id === 'measure').icons

// LocalStorage keys for caching identity after auth
export const STORAGE_KEYS = {
  FAMILY_ID: 'bt_family_id',
  MEMBER_ID: 'bt_member_id',
  MEMBER_NAME: 'bt_member_name',
  CHILD_ID: 'bt_child_id',
  NOTIFICATIONS: 'bt_notifications',
}

// Admin configuration — admin status is enforced server-side via the
// `is_admin()` SQL function and the admin RLS policies. The email here is
// only used as a UI gate (to show the /admin link).
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? ''
