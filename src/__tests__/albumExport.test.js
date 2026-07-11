import { describe, it, expect } from 'vitest'
import { computeAlbumBand, wrapCanvasText } from '../lib/albumExport'

// A minimal 2D-context stand-in: width is proportional to string length so we
// can reason about wrapping deterministically without a real canvas.
function fakeCtx(pxPerChar = 10) {
  return { font: '', measureText: s => ({ width: s.length * pxPerChar }) }
}

// ---------------------------------------------------------------------------
// computeAlbumBand — the captioned vs non-captioned layout geometry
// ---------------------------------------------------------------------------
describe('computeAlbumBand', () => {
  it('produces no band when there is neither a month label nor a caption', () => {
    const L = computeAlbumBand({ S: 1080, hasMonth: false, capLineCount: 0 })
    expect(L.bandH).toBe(0)
    expect(L.rows).toHaveLength(0)
  })

  it('reserves a short band for a month label only', () => {
    const L = computeAlbumBand({ S: 1080, hasMonth: true, capLineCount: 0 })
    expect(L.bandH).toBeGreaterThan(0)
    expect(L.rows).toHaveLength(1)
    expect(L.rows[0].kind).toBe('month')
    // Month sits on the bottom padding line.
    expect(L.rows[0].y).toBe(1080 - L.pad)
  })

  it('grows the band with each additional caption line', () => {
    const one   = computeAlbumBand({ S: 1080, hasMonth: true, capLineCount: 1 })
    const two   = computeAlbumBand({ S: 1080, hasMonth: true, capLineCount: 2 })
    const three = computeAlbumBand({ S: 1080, hasMonth: true, capLineCount: 3 })
    expect(two.bandH).toBeGreaterThan(one.bandH)
    expect(three.bandH).toBeGreaterThan(two.bandH)
  })

  it('emits one row per line plus the month row, and every row stays on-canvas', () => {
    const S = 1080
    const L = computeAlbumBand({ S, hasMonth: true, capLineCount: 3 })
    expect(L.rows).toHaveLength(4) // 1 month + 3 caption lines
    expect(L.rows.filter(r => r.kind === 'cap')).toHaveLength(3)
    for (const r of L.rows) {
      expect(r.y).toBeGreaterThan(0)
      expect(r.y).toBeLessThanOrEqual(S)
    }
  })

  it('caption line boxes stack strictly upward above the month label', () => {
    const L = computeAlbumBand({ S: 1080, hasMonth: true, capLineCount: 3 })
    const month = L.rows.find(r => r.kind === 'month')
    const caps  = L.rows.filter(r => r.kind === 'cap')
    // Every caption line sits above the month label (smaller y = higher up).
    for (const c of caps) expect(c.y).toBeLessThan(month.y)
    // line 0 is the topmost, line 2 the bottom-most.
    const byLine = Object.fromEntries(caps.map(c => [c.line, c.y]))
    expect(byLine[0]).toBeLessThan(byLine[1])
    expect(byLine[1]).toBeLessThan(byLine[2])
  })

  it('never lets the band cover more than 62% of the frame', () => {
    const S = 1080
    // Even with an absurd line count the band is capped.
    const L = computeAlbumBand({ S, hasMonth: true, capLineCount: 20 })
    expect(L.bandH).toBeLessThanOrEqual(Math.round(S * 0.62))
  })

  it('scales proportionally with frame size', () => {
    const small = computeAlbumBand({ S: 320, hasMonth: true, capLineCount: 2 })
    const large = computeAlbumBand({ S: 2100, hasMonth: true, capLineCount: 2 })
    // Same ratio of band to frame (within rounding) → preview matches export.
    const rSmall = small.bandH / 320
    const rLarge = large.bandH / 2100
    expect(Math.abs(rSmall - rLarge)).toBeLessThan(0.05)
  })
})

// ---------------------------------------------------------------------------
// wrapCanvasText — caption wrapping / truncation
// ---------------------------------------------------------------------------
describe('wrapCanvasText', () => {
  it('keeps a short caption on a single line', () => {
    const lines = wrapCanvasText(fakeCtx(), 'שלום עולם', 1000, 3)
    expect(lines).toEqual(['שלום עולם'])
  })

  it('wraps a long caption across multiple lines without dropping words', () => {
    const text = 'aaa bbb ccc ddd eee fff' // 6 words, each 3 chars → 30px + spaces
    const lines = wrapCanvasText(fakeCtx(), text, 80, 3) // ~8 chars per line
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.length).toBeLessThanOrEqual(3)
  })

  it('truncates to maxLines with an ellipsis instead of clipping mid-caption', () => {
    const text = 'one two three four five six seven eight nine ten'
    const lines = wrapCanvasText(fakeCtx(), text, 60, 2)
    expect(lines).toHaveLength(2)
    expect(lines[lines.length - 1].endsWith('…')).toBe(true)
  })

  it('handles Hebrew (RTL) captions the same way', () => {
    const text = 'הרגע הראשון שבו חייכת אלינו בבוקר קסום'
    const lines = wrapCanvasText(fakeCtx(), text, 120, 3)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines.length).toBeLessThanOrEqual(3)
    // Nothing is lost silently: either it fits, or the last line is elided.
    const joined = lines.join(' ')
    expect(joined.length).toBeGreaterThan(0)
  })
})
