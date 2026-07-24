import { useState } from 'react'
import { useAppData } from '../context/AppDataContext'

export default function Hierarchy() {
  const { employees, jobRoles } = useAppData()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const noRoleLabel = 'بدون دور محدد'
  const groups = new Map<string, typeof employees>()
  jobRoles.forEach((r) => groups.set(r, []))
  groups.set(noRoleLabel, [])
  employees.forEach((emp) => {
    const key = emp.jobRole && groups.has(emp.jobRole) ? emp.jobRole : noRoleLabel
    groups.get(key)!.push(emp)
  })

  function toggle(role: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(role) ? next.delete(role) : next.add(role)
      return next
    })
  }

  return (
    <section>
      <div className="panel">
        <div className="panel-title"><span className="bar"></span>التسلسل الهرمي — توزيع الفريق</div>
        <div className="muted">إجمالي عدد الموظفين، وعدد كل دور وظيفي، مع إمكانية عرض الأسماء.</div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="num">{employees.length}</div>
          <div className="lbl">إجمالي أعضاء الفريق</div>
        </div>
        {[...groups.entries()].filter(([, list]) => list.length > 0).map(([role, list]) => (
          <div className="stat-card" key={role}>
            <div className="num">{list.length}</div>
            <div className="lbl">{role}</div>
          </div>
        ))}
      </div>

      {[...groups.entries()].filter(([, list]) => list.length > 0).map(([role, list]) => (
        <div className="panel" key={role}>
          <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggle(role)}>
            <div className="panel-title">
              <span className="bar"></span>{role} ({list.length})
            </div>
            <button className="btn ghost">{expanded.has(role) ? 'إخفاء الأسماء ▲' : 'عرض الأسماء ▼'}</button>
          </div>
          {expanded.has(role) && (
            <div className="row" style={{ marginTop: 10 }}>
              {list.map((emp) => (
                <span className="chip" key={emp.id} style={{ background: 'var(--panel-alt)', color: 'var(--ink)' }}>
                  {emp.name}{emp.groupName ? ` — ${emp.groupName}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
