import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../auth/AuthContext'
import { useDialog } from '../context/DialogContext'
import { createEmployee, updateEmployee, softDeleteEmployee } from '../services/employees'
import { exportEmployeesToExcel, parseEmployeesExcel } from '../services/employeesExcel'
import { summarizeShifts } from '../utils/exportView'
import ExportPortal from '../components/ExportPortal'
import { daysInMonth, monthLabel, AR_DAYS, weekdayOf } from '../utils/dates'
import type { Employee } from '../types/domain'

function countShifts(shifts: Record<number, string> | undefined) {
  const counts: Record<string, number> = {}
  Object.values(shifts ?? {}).forEach((c) => {
    counts[c] = (counts[c] || 0) + 1
  })
  return counts
}

/** Returns the set of values that appear on more than one employee for the given field. */
function findDuplicateValues(employees: Employee[], field: 'workNumber' | 'groupName'): Set<string> {
  const counts = new Map<string, number>()
  employees.forEach((e) => {
    const v = e[field]?.trim()
    if (v) counts.set(v, (counts.get(v) || 0) + 1)
  })
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([v]) => v))
}

export default function Profiles() {
  const { user } = useAuth()
  const { employees, shiftTypes, jobRoles, currentMonth, roster, reloadEmployees } = useAppData()
  const { confirm, alert } = useDialog()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Employee>>({})
  const [exportFrom, setExportFrom] = useState(1)
  const [exportTo, setExportTo] = useState(31)
  const [exportPreset, setExportPreset] = useState('full')
  const [exportMessage, setExportMessage] = useState('')
  const excelInputRef = useRef<HTMLInputElement>(null)

  const canManage = user?.role === 'admin'
  const shiftByCode = new Map(shiftTypes.map((s) => [s.code, s]))
  const year = currentMonth?.year ?? new Date().getFullYear()
  const month = currentMonth?.month ?? new Date().getMonth() + 1
  const nd = daysInMonth(year, month)

  const dupWorkNumbers = useMemo(() => findDuplicateValues(employees, 'workNumber'), [employees])
  const dupGroupNames = useMemo(() => findDuplicateValues(employees, 'groupName'), [employees])

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

  async function handleExportExcel() {
    await exportEmployeesToExcel(employees)
  }

  async function handleImportExcel(file: File) {
    if (!user) return
    let rows
    try {
      rows = await parseEmployeesExcel(file)
    } catch {
      await alert('تعذّر قراءة ملف الإكسل — تأكد إنه بنفس تنسيق نموذج التصدير.')
      return
    }
    if (rows.length === 0) {
      await alert('الملف فاضي أو مفيهوش صفوف صالحة.')
      return
    }

    const byWorkNumber = new Map(employees.filter((e) => e.workNumber?.trim()).map((e) => [e.workNumber!.trim(), e]))
    const byName = new Map(employees.map((e) => [e.name.trim(), e]))
    let updateCount = 0
    let createCount = 0
    rows.forEach((row) => {
      const match = (row.workNumber && byWorkNumber.get(row.workNumber)) || byName.get(row.name.trim())
      if (match) updateCount++
      else createCount++
    })

    const ok = await confirm(`هيتم تحديث ${updateCount} موظف وإضافة ${createCount} موظف جديد. تأكيد المتابعة؟`)
    if (!ok) return

    for (const row of rows) {
      const match = (row.workNumber && byWorkNumber.get(row.workNumber)) || byName.get(row.name.trim())
      const patch: Partial<Employee> & { name: string } = {
        name: row.name,
        jobRole: row.jobRole,
        level: row.level,
        nationalId: row.nationalId,
        workNumber: row.workNumber,
        groupName: row.groupName,
        fixedRestDay: row.fixedRestDay,
      }
      if (match) await updateEmployee(match.id, patch, user)
      else await createEmployee(patch, user)
    }
    await reloadEmployees()
    await alert('تم استيراد بيانات الموظفين بنجاح.')
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
            {canManage && (
              <>
                <button className="btn ghost" onClick={handleExportExcel}>⬇️ تصدير Excel</button>
                <button className="btn ghost" onClick={() => excelInputRef.current?.click()}>⬆️ استيراد Excel</button>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImportExcel(file)
                    e.target.value = ''
                  }}
                />
                <button className="btn secondary" onClick={handleAdd}>+ إضافة موظف جديد</button>
              </>
            )}
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
                    <option value="">بدون</option>
                    {jobRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>اسم الجروب / الواتساب</label>
                  <input type="text" value={draft.groupName ?? ''} onChange={(e) => setDraft((d) => ({ ...d, groupName: e.target.value }))} />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>رقم الشخصي</label>
                  <input type="text" value={draft.personalPhone ?? ''} onChange={(e) => setDraft((d) => ({ ...d, personalPhone: e.target.value }))} />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>رقم الشغل</label>
                  <input type="text" value={draft.workNumber ?? ''} onChange={(e) => setDraft((d) => ({ ...d, workNumber: e.target.value }))} />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>يوم الإجازة الثابت</label>
                  <select
                    value={draft.fixedRestDay ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, fixedRestDay: e.target.value === '' ? null : Number(e.target.value) }))}
                  >
                    <option value="">بدون</option>
                    {AR_DAYS.map((dn, di) => <option key={di} value={di}>{dn}</option>)}
                  </select>
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
          const isDupWork = Boolean(emp.workNumber?.trim() && dupWorkNumbers.has(emp.workNumber.trim()))
          const isDupGroup = Boolean(emp.groupName?.trim() && dupGroupNames.has(emp.groupName.trim()))
          return (
            <div className={`card ${selected.has(emp.id) ? 'selected' : ''}`} key={emp.id}>
              <label className="pick">
                <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)} />
              </label>
              {(isDupWork || isDupGroup) && (
                <span
                  className="chip"
                  style={{ background: '#fbe7ea', color: 'var(--danger)', marginBottom: 6 }}
                  title={[
                    isDupWork ? 'رقم الشغل ده مستخدم مع موظف/موظفين تانيين' : '',
                    isDupGroup ? 'اسم الجروب/الواتساب ده مشترك مع موظف/موظفين تانيين' : '',
                  ].filter(Boolean).join(' — ')}
                >
                  ⚠️ {isDupWork && isDupGroup ? 'رقم وجروب مكررين' : isDupWork ? 'رقم شغل مكرر' : 'جروب مشترك'}
                </span>
              )}
              <h3>{emp.name}</h3>
              <div className="role">{emp.jobRole || 'بدون دور محدد'}{emp.groupName ? ` • ${emp.groupName}` : ''}</div>
              <div className="level">{'★'.repeat(emp.level || 3)}{'☆'.repeat(5 - (emp.level || 3))}</div>
              {(emp.personalPhone || emp.workNumber || emp.fixedRestDay != null) && (
                <div className="muted" style={{ marginBottom: 8, lineHeight: 1.9 }}>
                  {emp.personalPhone && <>📱 شخصي: {emp.personalPhone}<br /></>}
                  {emp.workNumber && <>☎️ شغل: {emp.workNumber}<br /></>}
                  {emp.fixedRestDay != null && <>🗓️ إجازته الثابتة: {AR_DAYS[emp.fixedRestDay]}</>}
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

      <div className="toolbar-sticky no-print" style={{ flexWrap: 'wrap' }}>
        <span className="muted">{selected.size} شخص محدد</span>
        <div className="row" style={{ flexWrap: 'wrap' }}>
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
          <div className="field" style={{ minWidth: 220 }}>
            <label>رسالة تُطبع أعلى الصفحة (اختياري)</label>
            <input type="text" value={exportMessage} onChange={(e) => setExportMessage(e.target.value)} placeholder="مثال: جدول شهر مارس — راجع أيام راحتك" />
          </div>
          <button className="btn secondary" onClick={exportSelected} disabled={selected.size === 0}>
            📄 تصدير / طباعة المحدد
          </button>
        </div>
      </div>

      {/* Print-only export view */}
      <ExportPortal>
        {[...selected].map((id) => {
          const emp = employees.find((e) => e.id === id)
          if (!emp) return null
          const shifts = roster[id] ?? {}
          const rows: ReactNode[] = []
          for (let d = exportFrom; d <= exportTo; d++) {
            const code = shifts[d]
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
          const { workCounts, leaveCounts } = summarizeShifts(shifts, shiftTypes)
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
              {exportMessage && (
                <p style={{ background: '#f6f8fb', border: '1px solid #e6e9f0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  {exportMessage}
                </p>
              )}
              <table className="export-table">
                <thead><tr><th>التاريخ</th><th>اليوم</th><th>الشيفت</th><th>التوقيت</th></tr></thead>
                <tbody>{rows}</tbody>
              </table>
              <div style={{ marginTop: 12, fontSize: 12.5 }}>
                <b>أيام العمل:</b>{' '}
                {workCounts.length === 0 ? 'لا يوجد' : workCounts.map(([code, n]) => `${code}: ${n} يوم`).join(' — ')}
              </div>
              <div style={{ marginTop: 4, fontSize: 12.5 }}>
                <b>أيام الإجازة/الراحة:</b>{' '}
                {leaveCounts.length === 0 ? 'لا يوجد' : leaveCounts.map(([code, n]) => `${code}: ${n} يوم`).join(' — ')}
              </div>
              <div className="export-summary" style={{ marginTop: 10 }}>
                {shiftTypes.map((s) => (
                  <span className="item" key={s.code}>{s.code} = {s.description}</span>
                ))}
              </div>
            </div>
          )
        })}
      </ExportPortal>
    </section>
  )
}
