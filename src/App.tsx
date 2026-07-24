import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AppDataProvider } from './context/AppDataContext'
import { DialogProvider } from './context/DialogContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Grid from './pages/Grid'
import Coverage from './pages/Coverage'
import Profiles from './pages/Profiles'
import FilterByShift from './pages/FilterByShift'
import Generate from './pages/Generate'
import Rules from './pages/Rules'
import AuditLog from './pages/AuditLog'
import Accounts from './pages/Accounts'
import MyProfile from './pages/MyProfile'
import Hierarchy from './pages/Hierarchy'

function App() {
  const { loading, user } = useAuth()

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل...</div>
  if (!user) return <Login />

  return (
    <DialogProvider>
      <AppDataProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={user.role === 'supervisor' ? <Navigate to="/grid" replace /> : <Dashboard />} />
            <Route path="grid" element={<Grid />} />
            <Route path="coverage" element={<Coverage />} />
            <Route path="profiles" element={<Profiles />} />
            <Route path="filter" element={<FilterByShift />} />
            <Route path="generate" element={<Generate />} />
            <Route path="rules" element={<Rules />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="my-profile" element={<MyProfile />} />
            <Route path="hierarchy" element={<Hierarchy />} />
          </Route>
        </Routes>
      </AppDataProvider>
    </DialogProvider>
  )
}

export default App
