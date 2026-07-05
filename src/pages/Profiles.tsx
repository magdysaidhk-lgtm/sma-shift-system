import { useState, type ReactNode } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../auth/AuthContext'
import { useDialog } from '../context/DialogContext'
import { createEmployee, updateEmployee, softDeleteEmployee } from '../services/employees'
import { daysInMonth, monthLabel, AR_DAYS, weekdayOf } from '../utils/dates'
import type { Employee } from '../types/domain'

const ROLE_OPTIONS = ['م . شيفت', 'اشراف', 'تدريب', '']

function countShifts(shifts: Record<number, string> | undefined) {
  const counts: Record<string, number> = {}
  Object.values(shifts ?? {}).forEach((c) => {
    counts[c] = (counts[c] || 0) + 1
  })
  return counts
}

export default function Profiles() {
  const { user } = useAuth()
  const { employees, shiftTypes, currentMonth, roster, reloadEmployees } = useAppData()
  const { confirm } = useDialog()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Employee>>({})
  const [exportFrom, setExportFrom] = useState(1)
  const [exportTo, setExportTo] = useState(31)
  const [exportPreset, setExportPreset] = useState('full')

  const canManage = user?.role === 'admin'
  const shiftByCode = new Map(shiftTypes.map((s) => [s.code, s]))
  const year = currentMonth?.year ?? new Date().getFullYear()
  const month = currentMonth?.month ?? new Date().getMonth() + 1
  const nd = daysInMonth(year, month)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setDraft({ ...emp })
  }

  async function saveEdit() {
    if (!editingId || !user) return
    await updateEmployee(editingId, draft, user)
    setEditingId(null)
    await reloadEmployees()
  }

  async function handleAdd() {
    if (!user) return
    const emp = await createEmployee({ name: 'موظف جديد', level: 3 }, user)
    await reloadEmployees()
    startEdit(emp)
  }

  async function handleDelete(emp: Employee) {
    if (!user) return
    const ok = await confirm(`تأكيد حذف "${emp.name}" من الفريق؟`)
    if (!ok) return
    await softDeleteEmployee(emp.id, user)
    await reloadEmployees()
  }

  function applyExportPreset(preset: string) {
    setExportPreset(preset)
    const ranges: Record<string, [number, number]> = {
      full: [1, nd], w1: [1, 7], w2: [8, 14], w3: [15, 21], w4: [22, Math.min(28, nd)],
    }
    if (preset !== 'custom' && ranges[preset]) {
      setExportFrom(ranges[preset][0])
      setExportTo(Math.min(ranges[preset][1], nd))
    }
  }

  function exportSelected() {
    window.print()
  }

  return (
    <section>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="panel-title"><span className="bar"></span>الفريق ({employees.length})</div>
          <div className="row">
            <button className="btn ghost" onClick={() => setSelected(new Set(employees.map((e) => e.id)))}>تحديد الكل</button>
            <button className="btn ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</button>
            {canManage && <button className="btn secondary" onClick={handleAdd}>+ إضافة موظف جديد</button>}
          </div>
        </div>
      </div>

      <div className="cards">
        {employees.map((emp) => {
          if (editingId === emp.id) {
            return (
              <div className="card" key={emp.id}>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>الاسم</label>
                  <input type="text" value={draft.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>الدور</label>
                  <select value={draft.jobRole ?? ''} onChange={(e) => setDraft((d) => ({ ...d, jobRole: e.target.value }))}>
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r || 'بدون'}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>رقم الشخصي</label>
                  <input type="text" value={draft.personalPhone ?? ''} onChange={(e) => setDraft((d) => ({ ...d, personalPhone: e.target.value }))} />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>رقم الشغل</label>
                  <input type="text" value={draft.workNumber ?? ''} onChange={(e) => setDraft((d) => ({ ...d, workNumber: e.target.value }))} />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>مستوى الأداء</label>
                  <select value={draft.level ?? 3} onChange={(e) => setDraft((d) => ({ ...d, level: Number(e.target.value) }))}>
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l}>{'★'.repeat(l)}{'☆'.repeat(5 - l)}</option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <button className="btn secondary" onClick={saveEdit}>حفظ</button>
                  <button className="btn ghost" onClick={() => setEditingId(null)}>إلغاء</button>
                </div>
              </div>
            )
          }

          const counts = countShifts(roster[emp.id])
          const rows = Object.entries(counts).sort((a, b) => b[1] - a[1])
          return (
            <div className={`card ${selected.has(emp.id) ? 'selected' : ''}`} key={emp.id}>
              <label className="pick">
                <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)} />
              </label>
              <h3>{emp.name}</h3>
              <div className="role">{emp.jobRole || 'بدون دور محدد'}</div>
              <div className="level">{'★'.repeat(emp.level || 3)}{'☆'.repeat(5 - (emp.level || 3))}</div>
              {(emp.personalPhone || emp.workNumber) && (
                <div className="muted" style={{ marginBottom: 8, lineHeight: 1.9 }}>
                  {emp.personalPhone && <>📱 شخصي: {emp.personalPhone}<br /></>}
                  {emp.workNumber && <>☎️ شغل: {emp.workNumber}</>}
                </div>
              )}
              {rows.length === 0 ? (
                <div className="muted">لا توجد بيانات</div>
              ) : (
                rows.map(([code, n]) => {
                  const s = shiftByCode.get(code)
                  return (
                    <div className="count-row" key={code}>
                      <span className="badge"><span className="dot" style={{ background: s?.color ?? '#999' }}></span>{code}</span>
                      <span>{n} يوم</span>
                    </div>
                  )
                })
              )}
              {canManage && (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn ghost" onClick={() => startEdit(emp)}>✏️ تعديل</button>
                  <button className="btn danger" onClick={() => handleDelete(emp)}>🗑️ حذف</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="toolbar-sticky no-print">
        <span className="muted">{selected.size} شخص محدد</span>
        <div className="row">
          <div className="field">
            <label>المدة</label>
            <select value={exportPreset} onChange={(e) => applyExportPreset(e.target.value)}>
              <option value="full">الشهر كامل</option>
              <option value="w1">أسبوع 1</option>
              <option value="w2">أسبوع 2</option>
              <option value="w3">أسبوع 3</option>
              <option value="w4">أسبوع 4</option>
              <option value="custom">مدة مخصصة</option>
            </select>
          </div>
          <div className="field">
            <label>من يوم</label>
            <input type="number" min={1} max={nd} value={exportFrom} onChange={(e) => setExportFrom(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>إلى يوم</label>
            <input type="number" min={1} max={nd} value={exportTo} onChange={(e) => setExportTo(Number(e.target.value))} />
          </div>
          <button className="btn secondary" onClick={exportSelected} disabled={selected.size === 0}>
            📄 تصدير / طباعة المحدد
          </button>
        </div>
      </div>

      {/* Print-only export view */}
      <div id="exportView">
        {[...selected].map((id) => {
          const emp = employees.find((e) => e.id === id)
          if (!emp) return null
          const shifts = roster[id] ?? {}
          const counts: Record<string, number> = {}
          const rows: ReactNode[] = []
          for (let d = exportFrom; d <= exportTo; d++) {
            const code = shifts[d]
            if (code) counts[code] = (counts[code] || 0) + 1
            const s = code ? shiftByCode.get(code) : undefined
            rows.push(
              <tr key={d}>
                <td>{d} {monthLabel(year, month).replace('جدول شهر ', '').split(' - ')[0]}</td>
                <td>{AR_DAYS[weekdayOf(year, month, d)]}</td>
                <td>{code ? <b style={{ color: s?.color === '#FFE599' ? '#8a6d00' : s?.color }}>{code}</b> : '—'}</td>
                <td>{code && s ? s.description : ''}</td>
              </tr>,
            )
          }
          return (
            <div className="export-page" key={id}>
              <div className="export-head">
                <div>
                  <h2>{emp.name}</h2>
                  <div className="muted">{emp.jobRole || ''}</div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div><b>{monthLabel(year, month)}</b></div>
                  <div className="muted">سوبر مسلم أكاديمي</div>
                </div>
              </div>
              <table className="export-table">
                <thead><tr><th>التاريخ</th><th>اليوم</th><th>الشيفت</th><th>التوقيت</th></tr></thead>
                <tbody>{rows}</tbody>
              </table>
              <div className="export-summary">
                {Object.entries(counts).map(([code, n]) => (
                  <span className="item" key={code}>{code}: {n} يوم</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
