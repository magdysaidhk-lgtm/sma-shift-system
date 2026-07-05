import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Grid from './pages/Grid'
import Coverage from './pages/Coverage'
import Profiles from './pages/Profiles'
import FilterByShift from './pages/FilterByShift'
import Generate from './pages/Generate'
import Rules from './pages/Rules'
import AuditLog from './pages/AuditLog'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="grid" element={<Grid />} />
        <Route path="coverage" element={<Coverage />} />
        <Route path="profiles" element={<Profiles />} />
        <Route path="filter" element={<FilterByShift />} />
        <Route path="generate" element={<Generate />} />
        <Route path="rules" element={<Rules />} />
        <Route path="audit-log" element={<AuditLog />} />
      </Route>
    </Routes>
  )
}

export default App
