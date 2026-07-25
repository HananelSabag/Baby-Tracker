import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// jsdom has no layout, so recharts' ResponsiveContainer would render an empty
// box and warn. Swap it for a plain div — we're verifying the page's content
// and that it mounts at all, not the SVG geometry.
vi.mock('recharts', async () => {
  const Passthrough = ({ children }) => <div>{children}</div>
  const Nothing = () => null
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    Line: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
    Tooltip: Nothing,
    CartesianGrid: Nothing,
  }
})

const CHILD = {
  id: 'c1',
  name: 'הראל',
  gender: 'male',
  avatar_url: null,
  // ~6 months old relative to the fixed clock below.
  birth_date: '2026-01-10',
}

vi.mock('../hooks/useAppContext', () => ({
  useApp: () => ({ identity: { familyId: 'fam1', activeChildId: 'c1' } }),
}))
vi.mock('../hooks/useChildren', () => ({
  useChildren: () => ({ children: [CHILD] }),
}))
vi.mock('../hooks/useTrackers', () => ({
  useTrackers: () => ({ trackers: [] }),
}))
vi.mock('../hooks/useFamily', () => ({
  useFamilyMembers: () => ([
    { id: 'm1', display_name: 'אבא' },
    { id: 'm2', display_name: 'אמא' },
  ]),
}))

const summary = {
  overview: {
    totalEvents: 120,
    firstDate: new Date(2026, 5, 1),
    daysSinceFirst: 44,
    activeDays: 40,
    byMember: { m1: 80, m2: 40 },
  },
  feeding: {
    count: 60, totalMl: 7200, avgMlPerFeed: 120,
    recentPerDay: 6, recentMlPerDay: 720,
    typicalGapMs: 3 * 3600000,
    lastAt: new Date(2026, 6, 15, 9, 0),
    nextEstimate: new Date(2026, 6, 15, 12, 0),
    sampleSize: 20,
  },
  diaper: {
    count: 40, recentPerDay: 5, wetPerDay: 4,
    breakdown: { wet: 30, dirty: 6, both: 4 },
  },
  sleep: {
    sessionCount: 20, recentAvgHoursPerDay: 13.5, recentNapsPerDay: 3,
    longestMs: 6 * 3600000, perDayMs: {}, hasData: true,
  },
  growth: {
    points: [{ at: new Date(2026, 6, 1), weightKg: 7.5, heightCm: 66, headCm: null }],
    count: 1,
    latestWeight: { at: new Date(2026, 6, 1), weightKg: 7.5, heightCm: 66, headCm: null },
    latestHeight: { at: new Date(2026, 6, 1), weightKg: 7.5, heightCm: 66, headCm: null },
    latestHead: null,
  },
  windowDays: 14,
  loading: false,
  truncated: false,
}

vi.mock('../hooks/useChildSummary', () => ({
  useChildSummary: () => summary,
  RECENT_WINDOW_DAYS: 14,
}))

// Imported after the mocks are registered.
const { ChildSummaryPage } = await import('../pages/ChildSummaryPage')

function renderPage() {
  return render(<MemoryRouter><ChildSummaryPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0))
})
afterEach(() => { vi.useRealTimers() })

describe('ChildSummaryPage', () => {
  it('mounts and shows the child in the title', () => {
    renderPage()
    expect(screen.getByText(/הסיפור של הראל/)).toBeInTheDocument()
  })

  it('reports the family\'s own totals', () => {
    renderPage()
    expect(screen.getByText(/120 דיווחים לאורך 40 ימים/)).toBeInTheDocument()
  })

  it('splits logging credit between members', () => {
    renderPage()
    expect(screen.getByText('אבא')).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()   // 80 / 120
    expect(screen.getByText('33%')).toBeInTheDocument()   // 40 / 120
  })

  it('shows the AASM sleep band for a 6-month-old, with its source', () => {
    renderPage()
    expect(screen.getByText(/12–16 שעות ל-24 שעות כולל תנומות/)).toBeInTheDocument()
    expect(screen.getByText(/AASM 2016/)).toBeInTheDocument()
  })

  it('frames the next-feed figure as the family\'s own rhythm, not a need', () => {
    renderPage()
    expect(screen.getByText(/המרווח האופייני שלכם/)).toBeInTheDocument()
    expect(screen.getByText(/לא של מה שהתינוק\/ת צריך\/ה/)).toBeInTheDocument()
  })

  it('states the CDC 75% criterion next to the milestone list', () => {
    renderPage()
    // getAllByText: the phrase is inside a <strong>, so it matches both that
    // element and its enclosing paragraph.
    expect(screen.getAllByText(/75% מהילדים ומעלה/).length).toBeGreaterThan(0)
    // We never assess the child — say so explicitly.
    expect(screen.getAllByText(/לא הערכה של הראל/).length).toBeGreaterThan(0)
  })

  it('always renders the sources block and the disclaimer', () => {
    renderPage()
    expect(screen.getByText('מקורות')).toBeInTheDocument()
    expect(screen.getByText(/אינה הערכה רפואית/)).toBeInTheDocument()
    // Cited twice on purpose: inline under the growth chart, and again in the
    // sources block at the bottom.
    expect(screen.getAllByText(/WHO Child Growth Standards/).length).toBe(2)
  })
})
