import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './hooks/useAppContext'
import { AppLayout } from './components/layout/AppLayout'
import { FullPageSpinner } from './components/ui/Spinner'
import { AuthPage } from './pages/AuthPage'
import { SetupPage } from './pages/SetupPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { ReportsPage } from './pages/ReportsPage'
import { TrackersPage } from './pages/TrackersPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminPage } from './pages/AdminPage'
import { ADMIN_EMAIL } from './lib/constants'
import { PushPromoPopup } from './components/PushPromoPopup'
import { PrivacyPage } from './pages/PrivacyPage'

function AppRoutes() {
  const { user, identity, isAuthLoading, isSetupDone } = useApp()
  const location = useLocation()

  // Show spinner while resolving auth session (handles refresh token recovery too)
  if (isAuthLoading) return <FullPageSpinner />

  // Privacy page is public — accessible without login
  if (location.pathname === '/privacy') return <PrivacyPage />

  // Not logged in → sign-in page
  if (!user) return <AuthPage />

  // Logged in but no family yet → family setup
  if (!isSetupDone) return <SetupPage />

  const isAdmin = identity.email === ADMIN_EMAIL

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/trackers" element={<TrackersPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        {isAdmin && <Route path="/admin" element={<AdminPage />} />}
        {/* Fallback to home */}
        <Route path="*" element={<HomePage />} />
      </Routes>
      <PushPromoPopup familyId={identity.familyId} memberId={identity.memberId} />
    </AppLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
