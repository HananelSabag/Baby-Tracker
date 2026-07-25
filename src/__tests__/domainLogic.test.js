import { describe, it, expect } from 'vitest'
import {
  resolveDoses, givenDoseKeys, isButtonDoseTracker, padToCount,
  autoEmojiForLabel, DOSE_DEFAULT_LABELS, DOSE_DEFAULT_EMOJIS, MAX_DOSES,
} from '../lib/doseConfig'
import { pairSleepEvents, sleepStats } from '../lib/sleepSessions'

// ─────────────────────────────────────────────────────────────────────────────
// doseConfig — was duplicated across four files in three different orders, so
// the same dose rendered a different emoji depending on the screen.
// ─────────────────────────────────────────────────────────────────────────────

describe('dose defaults', () => {
  it('pairs the four primary labels with the emoji the suggester would pick', () => {
    // The old positional list disagreed with autoEmojiForLabel: it gave
    // "צהריים" a sunrise and "לילה" a sun-behind-cloud.
    //
    // Only the first four are asserted. Slots 5-6 are variations ("בוקר מאוחר",
    // "ערב מוקדם") that the substring matcher would map onto the same icons as
    // slots 1-2; they are given distinct ones on purpose so a six-dose tracker
    // doesn't show the same emoji twice.
    DOSE_DEFAULT_LABELS.slice(0, 4).forEach((label, i) => {
      expect(DOSE_DEFAULT_EMOJIS[i]).toBe(autoEmojiForLabel(label))
    })
  })

  it('gives every default slot a distinct emoji', () => {
    expect(new Set(DOSE_DEFAULT_EMOJIS).size).toBe(DOSE_DEFAULT_EMOJIS.length)
  })

  it('has an emoji for every label slot', () => {
    expect(DOSE_DEFAULT_EMOJIS).toHaveLength(DOSE_DEFAULT_LABELS.length)
    expect(DOSE_DEFAULT_LABELS).toHaveLength(MAX_DOSES)
  })
})

describe('autoEmojiForLabel', () => {
  it('suggests from the text the user typed', () => {
    expect(autoEmojiForLabel('בוקר')).toBe('☀️')
    expect(autoEmojiForLabel('ערב')).toBe('🌙')
    expect(autoEmojiForLabel('צהריים')).toBe('🌤')
    expect(autoEmojiForLabel('לילה')).toBe('⭐')
  })

  it('returns null for anything it does not recognise', () => {
    expect(autoEmojiForLabel('אקמול')).toBeNull()
    expect(autoEmojiForLabel('')).toBeNull()
    expect(autoEmojiForLabel(null)).toBeNull()
  })
})

describe('padToCount', () => {
  it('fills missing slots from the defaults', () => {
    expect(padToCount(['בוקר'], 3, DOSE_DEFAULT_LABELS))
      .toEqual(['בוקר', DOSE_DEFAULT_LABELS[1], DOSE_DEFAULT_LABELS[2]])
  })

  it('treats a blank string as missing', () => {
    expect(padToCount(['בוקר', '   '], 2, DOSE_DEFAULT_LABELS)[1]).toBe(DOSE_DEFAULT_LABELS[1])
  })

  it('truncates when the count shrinks', () => {
    expect(padToCount(['a', 'b', 'c'], 2, DOSE_DEFAULT_LABELS)).toHaveLength(2)
  })

  it('handles undefined input', () => {
    expect(padToCount(undefined, 2, DOSE_DEFAULT_LABELS)).toEqual(DOSE_DEFAULT_LABELS.slice(0, 2))
  })
})

describe('resolveDoses', () => {
  it('returns one slot per configured dose', () => {
    const doses = resolveDoses({ config: { daily_doses: 3 } })
    expect(doses).toHaveLength(3)
    expect(doses.map(d => d.key)).toEqual(['0', '1', '2'])
  })

  it('uses the stored labels and emoji when present', () => {
    const doses = resolveDoses({
      config: { daily_doses: 2, dose_labels: ['לפני אוכל', 'אחרי אוכל'], dose_emojis: ['💊', '🧴'] },
    })
    expect(doses[0]).toEqual({ key: '0', label: 'לפני אוכל', emoji: '💊' })
    expect(doses[1]).toEqual({ key: '1', label: 'אחרי אוכל', emoji: '🧴' })
  })

  it('fills the gap when the count was raised after saving', () => {
    // The stored config still only has two entries.
    const doses = resolveDoses({
      config: { daily_doses: 4, dose_labels: ['בוקר', 'ערב'], dose_emojis: ['☀️', '🌙'] },
    })
    expect(doses).toHaveLength(4)
    doses.forEach(d => {
      expect(d.label).toBeTruthy()
      expect(d.emoji).toBeTruthy()
    })
  })

  it('defaults to two doses when unconfigured', () => {
    expect(resolveDoses({})).toHaveLength(2)
    expect(resolveDoses({ config: {} })).toHaveLength(2)
    expect(resolveDoses(null)).toHaveLength(2)
  })

  it('clamps nonsense counts instead of rendering zero or hundreds of buttons', () => {
    expect(resolveDoses({ config: { daily_doses: 0 } })).toHaveLength(1)
    expect(resolveDoses({ config: { daily_doses: -3 } })).toHaveLength(1)
    expect(resolveDoses({ config: { daily_doses: 99 } })).toHaveLength(MAX_DOSES)
    expect(resolveDoses({ config: { daily_doses: 'abc' } })).toHaveLength(2)
  })
})

describe('givenDoseKeys', () => {
  it('reads both the current and the legacy field name', () => {
    // Two write paths historically stored dose_index (number) and dose (string).
    const keys = givenDoseKeys([
      { data: { dose_index: 0 } },
      { data: { dose: '1' } },
    ])
    expect(keys.has('0')).toBe(true)
    expect(keys.has('1')).toBe(true)
  })

  it('normalises numbers and strings to the same key', () => {
    expect(givenDoseKeys([{ data: { dose_index: 2 } }]).has('2')).toBe(true)
    expect(givenDoseKeys([{ data: { dose_index: '2' } }]).has('2')).toBe(true)
  })

  it('handles an empty list', () => {
    expect(givenDoseKeys([]).size).toBe(0)
    expect(givenDoseKeys(undefined).size).toBe(0)
  })
})

describe('isButtonDoseTracker', () => {
  it('is true for vitamin_d and for dose in button mode', () => {
    expect(isButtonDoseTracker({ tracker_type: 'vitamin_d' })).toBe(true)
    expect(isButtonDoseTracker({ tracker_type: 'dose', config: {} })).toBe(true)
  })

  it('is false for a dose tracker set to the simple stamp display', () => {
    expect(isButtonDoseTracker({ tracker_type: 'dose', config: { display_mode: 'simple' } })).toBe(false)
  })

  it('is false for other tracker types', () => {
    expect(isButtonDoseTracker({ tracker_type: 'feeding' })).toBe(false)
    expect(isButtonDoseTracker(null)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// sleepSessions — previously written three times, and two of the copies
// disagreed about what a repeated 'start' means.
// ─────────────────────────────────────────────────────────────────────────────

const ev = (type, h, m = 0) => ({
  data: { type },
  occurred_at: new Date(2026, 6, 15, h, m).toISOString(),
})

describe('pairSleepEvents', () => {
  it('pairs each start with its end', () => {
    const { sessions, openStart } = pairSleepEvents([ev('start', 1), ev('end', 3)])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].ms).toBe(2 * 3600000)
    expect(openStart).toBeNull()
  })

  it('sorts out-of-order events before pairing', () => {
    const { sessions } = pairSleepEvents([ev('end', 3), ev('start', 1)])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].ms).toBe(2 * 3600000)
  })

  it('treats a repeated start as a re-tap, not a second nap', () => {
    // The old SleepCard paired each start with whatever came next, which turned
    // this into two bogus sessions and corrupted the day's total.
    const { sessions } = pairSleepEvents([ev('start', 1), ev('start', 2), ev('end', 4)])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].ms).toBe(2 * 3600000)   // measured from the LAST start
  })

  it('ignores an end with nothing open', () => {
    const { sessions } = pairSleepEvents([ev('end', 1), ev('start', 2), ev('end', 3)])
    expect(sessions).toHaveLength(1)
  })

  it('reports a trailing start as still asleep', () => {
    const { sessions, openStart } = pairSleepEvents([ev('start', 1), ev('end', 2), ev('start', 5)])
    expect(sessions).toHaveLength(1)
    expect(openStart).not.toBeNull()
    expect(openStart.getHours()).toBe(5)
  })

  it('handles empty and malformed input', () => {
    expect(pairSleepEvents([]).sessions).toEqual([])
    expect(pairSleepEvents(undefined).sessions).toEqual([])
    expect(pairSleepEvents([{ data: {}, occurred_at: new Date().toISOString() }]).sessions).toEqual([])
  })
})

describe('sleepStats', () => {
  const now = new Date(2026, 6, 15, 12, 0).getTime()

  it('totals completed naps', () => {
    const s = sleepStats([ev('start', 1), ev('end', 3), ev('start', 5), ev('end', 6)], { now })
    expect(s.totalMs).toBe(3 * 3600000)
    expect(s.longestMs).toBe(2 * 3600000)
    expect(s.isSleeping).toBe(false)
  })

  it('counts an in-progress nap up to now when live', () => {
    const s = sleepStats([ev('start', 10)], { now, live: true })
    expect(s.isSleeping).toBe(true)
    expect(s.currentMs).toBe(2 * 3600000)
    expect(s.totalMs).toBe(2 * 3600000)
  })

  it('does NOT run an open nap forward on a past day', () => {
    // Viewing yesterday, a nap left open back then must not report the hours
    // since — that produced absurd totals in the day navigator.
    const s = sleepStats([ev('start', 10)], { now, live: false })
    expect(s.isSleeping).toBe(true)
    expect(s.currentMs).toBe(0)
    expect(s.totalMs).toBe(0)
  })

  it('adds the live nap only once, even with earlier orphan starts', () => {
    const s = sleepStats([ev('start', 1), ev('start', 10)], { now, live: true })
    expect(s.totalMs).toBe(2 * 3600000)
  })

  it('reports null for the longest nap when none completed', () => {
    expect(sleepStats([], { now }).longestMs).toBeNull()
  })
})
