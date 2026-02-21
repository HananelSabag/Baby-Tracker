import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './hooks/useAppContext'
import { AppLayout } from './components/layout/AppLayout'
import { FullPageSpinner } from './components/ui/Spinner'
import { AuthPage } from './pages/AuthPage'
import { SetupPage } from './pages/SetupPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminPage } from './pages/AdminPage'
import { ADMIN_EMAIL } from './lib/constants'

function AppRoutes() {
  const { user, identity, isAuthLoading, isSetupDone } = useApp()

  // Show spinner while resolving auth session (handles refresh token recovery too)
  if (isAuthLoading) return <FullPageSpinner />

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
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        {isAdmin && <Route path="/admin" element={<AdminPage />} />}
        {/* Fallback to home */}
        <Route path="*" element={<HomePage />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
