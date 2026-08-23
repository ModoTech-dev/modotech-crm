import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { MessagesPage } from './pages/MessagesPage'
import { CustomersPage } from './pages/CustomersPage'
import { ReportsPage } from './pages/ReportsPage'
import { AgentsPage } from './pages/AgentsPage'
import { DepartmentsPage } from './pages/DepartmentsPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { BroadcastsPage } from './pages/BroadcastsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/leads" element={<CustomersPage statusFilter="LEAD" title="Leads" />} />
            <Route path="/broadcasts" element={<BroadcastsPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
