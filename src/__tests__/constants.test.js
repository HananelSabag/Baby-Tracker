import { describe, it, expect } from 'vitest'
import {
  BUILTIN_TRACKERS,
  TRACKER_TYPES,
  TRACKER_ARCHETYPES,
  ROLES,
  FEEDING_PRESETS,
  PARENT_ROLES,
} from '../lib/constants'

// ---------------------------------------------------------------------------
// BUILTIN_TRACKERS — structural integrity
// Regression protection: catches accidental removal of required fields
// ---------------------------------------------------------------------------
describe('BUILTIN_TRACKERS structure', () => {
  const REQUIRED_FIELDS = ['name', 'icon', 'color', 'tracker_type', 'is_builtin', 'field_schema', 'config']

  it('contains exactly 5 built-in trackers', () => {
    expect(BUILTIN_TRACKERS).toHaveLength(5)
  })

  it('every tracker has all required fields', () => {
    for (const tracker of BUILTIN_TRACKERS) {
      for (const field of REQUIRED_FIELDS) {
        expect(tracker, `tracker "${tracker.name}" is missing field "${field}"`).toHaveProperty(field)
      }
    }
  })

  it('every tracker has is_builtin set to true', () => {
    for (const tracker of BUILTIN_TRACKERS) {
      expect(tracker.is_builtin).toBe(true)
    }
  })

  it('every tracker has a valid tracker_type from TRACKER_TYPES', () => {
    const validTypes = new Set(Object.values(TRACKER_TYPES))
    for (const tracker of BUILTIN_TRACKERS) {
      expect(validTypes, `"${tracker.tracker_type}" is not in TRACKER_TYPES`).toContain(tracker.tracker_type)
    }
  })

  it('every tracker has a non-empty field_schema array', () => {
    for (const tracker of BUILTIN_TRACKERS) {
      expect(Array.isArray(tracker.field_schema)).toBe(true)
      expect(tracker.field_schema.length, `tracker "${tracker.name}" has empty field_schema`).toBeGreaterThan(0)
    }
  })

  it('display_order values are unique and sequential starting from 0', () => {
    const orders = BUILTIN_TRACKERS.map(t => t.display_order).sort((a, b) => a - b)
    expect(orders).toEqual([0, 1, 2, 3, 4])
  })

  it('color values are valid hex color strings', () => {
    for (const tracker of BUILTIN_TRACKERS) {
      expect(tracker.color, `tracker "${tracker.name}" has invalid color`).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

// ---------------------------------------------------------------------------
// TRACKER_TYPES — sanity check on known values
// ---------------------------------------------------------------------------
describe('TRACKER_TYPES', () => {
  it('contains all expected tracker type keys', () => {
    expect(TRACKER_TYPES).toHaveProperty('FEEDING')
    expect(TRACKER_TYPES).toHaveProperty('VITAMIN_D')
    expect(TRACKER_TYPES).toHaveProperty('DIAPER')
    expect(TRACKER_TYPES).toHaveProperty('SLEEP')
    expect(TRACKER_TYPES).toHaveProperty('GROWTH')
    expect(TRACKER_TYPES).toHaveProperty('DOSE')
    expect(TRACKER_TYPES).toHaveProperty('CUSTOM')
  })

  it('all values are non-empty strings', () => {
    for (const [key, val] of Object.entries(TRACKER_TYPES)) {
      expect(typeof val, `TRACKER_TYPES.${key} should be a string`).toBe('string')
      expect(val.length, `TRACKER_TYPES.${key} should not be empty`).toBeGreaterThan(0)
    }
  })

  it('has no duplicate values', () => {
    const values = Object.values(TRACKER_TYPES)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

// ---------------------------------------------------------------------------
// ROLES — ensures the role list stays consistent
// ---------------------------------------------------------------------------
describe('ROLES', () => {
  it('every role has value, label, and emoji', () => {
    for (const role of ROLES) {
      expect(role).toHaveProperty('value')
      expect(role).toHaveProperty('label')
      expect(role).toHaveProperty('emoji')
    }
  })

  it('PARENT_ROLES are a subset of ROLES values', () => {
    const allValues = new Set(ROLES.map(r => r.value))
    for (const parentRole of PARENT_ROLES) {
      expect(allValues, `PARENT_ROLES includes "${parentRole}" which is not in ROLES`).toContain(parentRole)
    }
  })
})

// ---------------------------------------------------------------------------
// FEEDING_PRESETS — amounts are positive and ordered
// ---------------------------------------------------------------------------
describe('FEEDING_PRESETS', () => {
  it('contains only positive numbers', () => {
    for (const amount of FEEDING_PRESETS) {
      expect(amount).toBeGreaterThan(0)
    }
  })

  it('is sorted in ascending order', () => {
    for (let i = 1; i < FEEDING_PRESETS.length; i++) {
      expect(FEEDING_PRESETS[i]).toBeGreaterThan(FEEDING_PRESETS[i - 1])
    }
  })
})
