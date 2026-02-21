// Tracker type identifiers
export const TRACKER_TYPES = {
  FEEDING: 'feeding',
  VITAMIN_D: 'vitamin_d',
  DIAPER: 'diaper',
  CUSTOM: 'custom',
}

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
  },
  {
    name: 'ויטמין D',
    icon: '☀️',
    color: '#E8B84B',
    tracker_type: TRACKER_TYPES.VITAMIN_D,
    display_order: 1,
    is_builtin: true,
    field_schema: [{ key: 'dose', type: 'choice', label: 'מינון', options: ['morning', 'evening'] }],
  },
  {
    name: 'חיתול',
    icon: '👶',
    color: '#9B8EC4',
    tracker_type: TRACKER_TYPES.DIAPER,
    display_order: 2,
    is_builtin: true,
    field_schema: [{ key: 'type', type: 'choice', label: 'סוג', options: ['wet', 'dirty', 'both'] }],
  },
]

// Feeding preset amounts in ml
export const FEEDING_PRESETS = [30, 60, 90, 120, 150, 180]

// Display names for family members
export const MEMBER_NAMES = {
  DAD: 'אבא',
  MOM: 'אמא',
}

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

// Emoji options for custom trackers
export const TRACKER_ICONS = [
  '🌡️', '🛁', '💊', '⚖️', '🩺', '😴', '🤱', '🧸',
  '🌙', '☀️', '❤️', '⭐', '🎵', '🌸', '🦋', '🐣',
]

// LocalStorage keys
export const STORAGE_KEYS = {
  FAMILY_ID: 'bt_family_id',
  MEMBER_ID: 'bt_member_id',
  MEMBER_NAME: 'bt_member_name',
  DEVICE_TOKEN: 'bt_device_token',
}
