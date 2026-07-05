import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { monthLabel } from '../utils/dates'
import type { Role } from '../types/domain'

const TABS = [
  { to: '/', label: 'الرئيسية' },
  { to: '/grid', label: 'الجدول العام' },
  { to: '/coverage', label: 'التغطية اليومية' },
  { to: '/profiles', label: 'الفريق والملفات' },
  { to: '/filter', label: 'فلترة بشيفت' },
  { to: '/generate', label: 'توليد شهر جديد' },
  { to: '/rules', label: 'القواعد' },
  { to: '/audit-log', label: 'سجل التعديلات' },
]

const ADMIN_TAB = { to: '/accounts', label: 'الحسابات' }

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

  return (
    <>
      <header className="app">
        <div className="brand">
          <div className="logo">SM</div>
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
          {!isDevMode && (
            <button className="icon-btn" onClick={signOut} title="تسجيل الخروج">
              ⏻
            </button>
          )}
        </div>
      </header>

      <nav className="tabs no-print">
        {[...TABS, ...(user?.role === 'admin' ? [ADMIN_TAB] : [])].map((tab) => (
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
