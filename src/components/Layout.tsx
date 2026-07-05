import { NavLink, Outlet } from 'react-router-dom'

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

export default function Layout() {
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
      </header>

      <nav className="tabs no-print">
        {TABS.map((tab) => (
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
    </>
  )
}
