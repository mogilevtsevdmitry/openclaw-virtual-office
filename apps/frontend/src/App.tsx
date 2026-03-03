import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LocaleProvider } from './i18n/LocaleContext'
import { LoginForm } from '@features/auth/LoginForm'
import { PrivateRoute } from '@features/auth/PrivateRoute'
import { OfficeApp } from '@features/office/OfficeApp'
import { DashboardLayout } from './components/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { AgentsPage } from './pages/AgentsPage'
import { AgentDetailPage } from './pages/AgentDetailPage'
import { WorkPage } from './pages/WorkPage'
import { AuditPage } from './pages/AuditPage'
import { ChatPage } from './pages/ChatPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { DesertCatRunnerPage } from './pages/DesertCatRunnerPage'
import './App.css'

function App() {
  return (
    <LocaleProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route element={<PrivateRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/:id" element={<AgentDetailPage />} />
            <Route path="/work" element={<WorkPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/office" element={<OfficeApp />} />
            <Route path="/game" element={<DesertCatRunnerPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </LocaleProvider>
  )
}

export default App
