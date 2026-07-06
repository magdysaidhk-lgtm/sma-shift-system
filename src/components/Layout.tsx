import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { monthLabel } from '../utils/dates'
import type { Role } from '../types/domain'

const DASHBOARD = { to: '/', label: 'الرئيسية' }
const GRID = { to: '/grid', label: 'الجدول العام' }
const COVERAGE = { to: '/coverage', label: 'التغطية اليومية' }
const PROFILES = { to: '/profiles', label: 'الفريق والملفات' }
const FILTER = { to: '/filter', label: 'فلترة بشيفت' }
const GENERATE = { to: '/generate', label: 'توليد شهر جديد' }
const RULES = { to: '/rules', label: 'القواعد' }
const AUDIT_LOG = { to: '/audit-log', label: 'سجل التعديلات' }
const ACCOUNTS = { to: '/accounts', label: 'الحسابات' }

const TABS_BY_ROLE: Record<Role, { to: string; label: string }[]> = {
  admin: [DASHBOARD, GRID, COVERAGE, PROFILES, FILTER, GENERATE, RULES, AUDIT_LOG, ACCOUNTS],
  shift_manager: [DASHBOARD, GRID, COVERAGE],
  supervisor: [GRID, COVERAGE],
  view_only: [DASHBOARD, GRID, COVERAGE, PROFILES, FILTER, AUDIT_LOG],
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'مدير عام',
  shift_manager: 'مدير شيفت',
  supervisor: 'مشرف',
  view_only: 'عرض فقط',
}

const STATUS_LABELS = { draft: 'مسودة', published: 'منشور', locked: 'مغلق' } as const

export default function Layout() {
  const { user, isDevMode, signOut, setDevRole } = useAuth()
  const { months, currentMonth, setCurrentMonthId } = useAppData()
  const tabs = TABS_BY_ROLE[user?.role ?? 'view_only']

  return (
    <>
      <header className="app">
        <div className="brand">
          <img src="/logo.png" alt="Super Muslim Academy" className="brand-logo" />
          <div>
            <h1>نظام إدارة شيفتات سوبر مسلم أكاديمي</h1>
            <div className="sub">الرئيسية • الجدول • التغطية اليومية • الفريق • التوليد</div>
          </div>
        </div>
        <div className="row no-print" style={{ alignItems: 'center' }}>
          {currentMonth && (
            <span className={`month-status ${currentMonth.status}`}>{STATUS_LABELS[currentMonth.status]}</span>
          )}
          <select value={currentMonth?.id ?? ''} onChange={(e) => setCurrentMonthId(e.target.value)}>
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {monthLabel(m.year, m.month)}
              </option>
            ))}
          </select>
          {isDevMode && (
            <select
              title="وضع تجريبي بدون Supabase — بدّل الدور لاختبار الصلاحيات"
              value={user?.role}
              onChange={(e) => setDevRole(e.target.value as Role)}
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  تجربة: {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}
          {user?.role === 'supervisor' && (
            <NavLink to="/my-profile" className="icon-btn" title="ملفي الشخصي">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </NavLink>
          )}
          {!isDevMode && (
            <button className="icon-btn logout-btn" onClick={signOut} title="تسجيل الخروج">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>خروج</span>
            </button>
          )}
        </div>
      </header>

      <nav className="tabs no-print">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div id="appView">
        <main>
          <Outlet />
        </main>
      </div>

      {/* Target for ExportPortal — must stay OUTSIDE #appView, see ExportPortal.tsx */}
      <div id="exportView"></div>
    </>
  )
}
