import { useEffect, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { listAuditLog } from '../services/auditLog'
import type { AuditLogEntry } from '../types/domain'
import { monthLabel } from '../utils/dates'

const ACTION_LABELS: Record<string, string> = {
  insert: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  generate_month: 'توليد شهر',
}

export default function AuditLog() {
  const { employees, months } = useAppData()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [monthId, setMonthId] = useState('')
  const [actionType, setActionType] = useState('')

  useEffect(() => {
    listAuditLog({
      employeeId: employeeId || undefined,
      monthId: monthId || undefined,
      actionType: actionType || undefined,
    }).then(setEntries)
  }, [employeeId, monthId, actionType])

  const empName = new Map(employees.map((e) => [e.id, e.name]))
  const monthName = new Map(months.map((m) => [m.id, monthLabel(m.year, m.month)]))

  return (
    <section>
      <div className="panel">
        <div className="panel-title"><span className="bar"></span>سجل التعديلات</div>
        <div className="muted">كل عملية إضافة/تعديل/حذف/توليد شهر تُسجَّل هنا تلقائيًا، بلا استثناء.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label>الشخص</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">الكل</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>الشهر</label>
            <select value={monthId} onChange={(e) => setMonthId(e.target.value)}>
              <option value="">الكل</option>
              {months.map((m) => <option key={m.id} value={m.id}>{monthLabel(m.year, m.month)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>نوع العملية</label>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
              <option value="">الكل</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="wrap-scroll">
          <table className="grid" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>الوقت</th>
                <th>نوع العملية</th>
                <th>الجدول</th>
                <th>الشخص</th>
                <th>الشهر</th>
                <th>اليوم</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="muted">لا توجد سجلات مطابقة</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleString('ar-EG')}</td>
                    <td>{ACTION_LABELS[e.actionType] ?? e.actionType}</td>
                    <td>{e.tableName}</td>
                    <td>{e.employeeId ? empName.get(e.employeeId) ?? '—' : '—'}</td>
                    <td>{e.monthId ? monthName.get(e.monthId) ?? '—' : '—'}</td>
                    <td>{e.day ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
