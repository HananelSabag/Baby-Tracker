# BabyTracker 👶

> **מעקב חכם אחרי התינוק שלך — בעברית, בזמן אמת, בחינם**
> 🔗 [baby-tracker-two-liart.vercel.app](https://baby-tracker-two-liart.vercel.app)

A full-featured Hebrew RTL PWA for tracking a newborn's daily activities.
Built with love for real family use — real-time sync, multi-child support, and a beautiful cream & brown design system.

---

## ✨ What's New — v2.0

| Feature | Details |
|---|---|
| **FAB Menu** | Floating action button replaces center nav slot — quick access to all actions |
| **Home Display Control** | Edit mode: drag to reorder + eye toggle to show/hide any tracker |
| **Interactive Dose Chips** | Tap to give a dose, tap again to undo — directly from the HeroCard |
| **Profile Bottom Sheet** | Tap your avatar → full banner photo with quick change & profile access |
| **Standalone Notifications** | Dedicated `/notifications` page — no longer buried in settings |
| **Family Profile Page** | Separate family management: children, members, family code |
| **Safe Back Navigation** | All sub-pages navigate back correctly (swipe-back friendly on iOS) |
| **Bug Fixes** | DOSE reports, history child filter, hidden tracker consistency |

---

## Features

### Tracking
- **Feedings** — quick preset buttons (30/60/90/120/150/180ml), 1-tap save, last feeding with urgency color
- **Diapers** — inline quick-type buttons (💧 wet / 💩 dirty / ✌️ both), 1-tap save
- **Sleep** — one-tap start/stop with live timer, session history, and daily total
- **Vitamin D & Doses** — configurable daily doses with custom labels; interactive chips on HeroCard
- **Growth** — weight, height, head circumference with WHO percentile tracking
- **Custom Trackers** — 4-archetype wizard: dose buttons, amount, event (timestamp-only), freetext with custom fields

### Home Screen
- **HeroCard** — feeding summary, sleep status, dose chips all in one glanceable card
- **Edit Mode** — long-press or tap ✏️ to enter drag-to-reorder + visibility toggle mode
- **Day Navigator** — browse history day by day from the home screen
- **Smart Grouping** — compact custom trackers auto-pair into 2-column grid

### Family & Profiles
- **Multi-child** — events tagged per child, quick child switcher
- **Real-time sync** — both parents see updates instantly via Supabase Realtime
- **Family Code** — invite family members with a shareable code
- **Role System** — אבא/אמא roles locked if already taken by another member

### Reports & History
- **Weekly Reports** — bar charts for feeding, sleep, diapers; dose compliance grid; event counts
- **History Page** — full event log grouped by date, edit/delete any event
- **Notifications Feed** — live bell icon with last 3 events from the other parent

### UX
- **Hebrew RTL** — fully localized, Rubik font, cream & brown design system
- **PWA** — installable on Android & iPhone, works offline-ready
- **Push Notifications** — configurable dose reminders & diaper alerts
- **Upgrade Popup** — one-time animated changelog shown to all users on new versions

---

## Tech Stack

| Layer | Technology |
|---|---|
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

50 unit tests across 5 test files, run with Vitest:

| File | What it tests |
|---|---|
| `utils.test.js` | `generateFamilyCode`, `generateDeviceToken`, `formatMl`, `cn`, `formatDateLabel`, `groupEventsByDay`, `goBack` |
| `strings.test.js` | `t()` i18n accessor — correct translations, fallback to key path |
| `whoGrowthData.test.js` | WHO growth curves — interpolation, `ageInMonths`, weight/height percentile labels |
| `useToast.test.jsx` | `showToast`, auto-dismiss after 4s, `dismissToast` |
| `constants.test.js` | TRACKER_TYPES, ROLES, PARENT_ROLES, FIELD_TYPES, TRACKER_ARCHETYPES |

Time-dependent tests use `vi.useFakeTimers()` for deterministic results.
GitHub Actions runs all tests + production build on every push to `main`. Vercel only deploys if CI passes.

---

## Project Structure

```
src/
├── i18n/he.json              # All UI strings in Hebrew
├── lib/                      # Constants, Supabase client, utils
├── hooks/                    # useAuth, useAppContext, useEvents, useTrackers, ...
├── components/
│   ├── layout/               # AppLayout, BottomNav (with FAB)
│   ├── ui/                   # Button, Card, Toast, BottomSheet, UpgradePopup, ...
│   ├── forms/                # AddFeedingForm, AddDiaperForm, AddCustomEventForm, ...
│   └── trackers/             # FeedingCard, DiaperCard, VitaminDCard, SleepCard,
│                             #   GrowthCard, HeroCard, CustomTrackerCard
└── pages/                    # Auth, Setup, Home, History, Reports, Trackers,
                              #   Profile, Family, Notifications, Privacy, Admin
```

---

## Changelog

### v2.0 (April 2026)
- FAB menu with 2-col card grid
- Home edit mode: drag reorder + visibility toggle
- Interactive dose/vitamin chips on HeroCard
- Profile avatar bottom sheet with banner photo
- Standalone NotificationsPage + FamilyPage
- Safe back navigation with `goBack()` utility
- iOS swipe-back fix on main scroll container
- DOSE simple-mode reports fixed (bar chart instead of compliance grid)
- HistoryPage hidden tracker + child filter fixes
- Role locking for parent roles in ProfilePage

### v1.x (2025)
- Initial release: feeding, diaper, sleep, vitamin D, growth tracking
- Real-time Supabase sync, Google OAuth, multi-child support
- Weekly reports with Recharts, push notifications, PWA install

---

## Author

**Hananel Sabag**
© 2025–2026 Hananel Sabag. All rights reserved.

Built as a personal tool — now shared with all parents 💛
🔗 [baby-tracker-two-liart.vercel.app](https://baby-tracker-two-liart.vercel.app)
