import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './hooks/useAppContext'
import { AccessibilityProvider } from './context/AccessibilityContext'
import { AppLayout } from './components/layout/AppLayout'
import { FullPageSpinner } from './components/ui/Spinner'
import { AuthPage } from './pages/AuthPage'
import { SetupPage } from './pages/SetupPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { ReportsPage } from './pages/ReportsPage'
import { ControlCenterPage } from './pages/ControlCenterPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminPage } from './pages/AdminPage'
import { ADMIN_EMAIL } from './lib/constants'
import { PushPromoPopup } from './components/PushPromoPopup'
import { PrivacyPage } from './pages/PrivacyPage'
import { FamilyPage } from './pages/FamilyPage'
import { AccessibilityPage } from './pages/AccessibilityPage'

function AppRoutes() {
  const { user, identity, isAuthLoading, isSetupDone } = useApp()
  const location = useLocation()

  // Show spinner while resolving auth session (handles refresh token recovery too)
  if (isAuthLoading) return <FullPageSpinner />

  // Public pages — accessible without login
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
        <Route path="/trackers" element={<ControlCenterPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
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
      <AccessibilityProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  )
}
