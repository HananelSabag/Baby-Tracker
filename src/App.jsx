import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider, useApp } from './hooks/useAppContext'
import { AppLayout } from './components/layout/AppLayout'
import { SetupPage } from './pages/SetupPage'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'

function AppRoutes() {
  const { isSetupDone } = useApp()

  if (!isSetupDone) {
    return <SetupPage />
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
