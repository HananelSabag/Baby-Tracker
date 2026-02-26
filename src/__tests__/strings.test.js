import { describe, it, expect } from 'vitest'
import { t } from '../lib/strings'

describe('t() — i18n accessor', () => {
  it('returns the correct translation for a top-level nested key', () => {
    expect(t('app.title')).toBe('BabyTracker')
  })

  it('returns the correct translation for a deeper nested key', () => {
    expect(t('auth.signOut')).toBe('התנתק')
  })

  it('falls back to the dot-path string when the full key is missing', () => {
    // No crash — just returns the key itself so the UI shows something readable
    expect(t('totally.nonexistent.key')).toBe('totally.nonexistent.key')
  })

  it('falls back to the path when only the leaf is missing (partial path)', () => {
    // 'app' exists in he.json but 'app.ghost' does not
    expect(t('app.ghost')).toBe('app.ghost')
  })
})
