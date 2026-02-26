# BabyTracker 👶

A personal PWA for tracking a newborn's daily activities — feedings, diapers, vitamins, and more.
Built with love for family use, with real-time sync between parents.

---

## Features

- **Feedings** — log time + amount (ml) with quick presets; see last feeding at a glance
- **Diapers** — wet / dirty / both; full daily breakdown with counts
- **Sleep** — one-tap start/stop with live timer, session history, and daily total
- **Vitamin D & Doses** — configurable daily doses with custom labels (morning / evening / etc.)
- **Custom Trackers** — 5-step wizard to create any tracker you need (dose buttons or simple event)
- **Weekly Reports** — bar charts for feeding, sleep, diapers, and dose trackers; Vitamin D compliance grid; week navigator
- **Home Screen Control** — show/hide any tracker per your preference; full visibility toggle
- **Day Navigator** — browse history day by day from the home screen
- **Multi-child** — each child is a separate entity; events are tagged per child
- **Real-time sync** — both parents see updates instantly via Supabase Realtime
- **Notification bell** — live feed of the last 3 events by the other parent, with unread badge
- **Hebrew RTL UI** — fully localized, Rubik font, cream & brown design system
- **PWA** — installable on Android & iPhone, works offline-ready

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6 + Tailwind CSS 3 |
| Backend | Supabase (Postgres + Realtime + Auth + Storage) |
| Auth | Google OAuth via Supabase |
| Charts | Recharts |
| Dates | date-fns |
| Routing | React Router v6 |
| Hosting | Vercel (auto-deploy from GitHub `main`) |
| PWA | vite-plugin-pwa |
| Font | Rubik |
| Testing | Vitest + @testing-library/react |
| CI/CD | GitHub Actions (test + build on every push) |

---

## Getting Started

```bash
# Install dependencies
npm install

# Create .env.local with your Supabase credentials
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Run locally
npm run dev

# Run tests (watch mode)
npm test

# Run tests once (used in CI)
npm run test:run

# Production build
npm run build
```

---

## Testing

33 unit tests across 4 test files, run with Vitest:

| File | What it tests |
|------|--------------|
| `utils.test.js` | `generateFamilyCode`, `generateDeviceToken`, `formatMl`, `cn`, `formatDateLabel`, `groupEventsByDay` |
| `strings.test.js` | `t()` i18n accessor — correct translations, fallback to key path |
| `whoGrowthData.test.js` | WHO growth curves — interpolation, `ageInMonths`, weight/height percentile labels |
| `useToast.test.jsx` | `showToast`, auto-dismiss after 4s, `dismissToast` |

Time-dependent tests (`formatDateLabel`, `groupEventsByDay`, `useToast`) use `vi.useFakeTimers()` to freeze the clock and produce deterministic results.

GitHub Actions runs all tests + a production build on every push to `main`. Vercel only deploys if the CI pipeline passes.

---

## Project Structure

```
src/
├── i18n/he.json              # All UI strings in Hebrew
├── lib/                      # Constants, Supabase client, utils
├── hooks/                    # useAuth, useAppContext, useEvents, useTrackers, ...
├── components/
│   ├── layout/               # AppLayout, BottomNav
│   ├── ui/                   # Button, Card, Toast, BottomSheet, ...
│   └── trackers/             # FeedingCard, DiaperCard, VitaminDCard, SleepCard, CustomTrackerCard
└── pages/                    # Auth, Setup, Home, History, Reports, Trackers, Profile, Admin
```

---

## Author

**Hananel Sabag**
© 2025–2026 Hananel Sabag. All rights reserved.

This project was built as a personal tool for family use.
Not open for redistribution without explicit permission.
