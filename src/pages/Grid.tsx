import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../auth/AuthContext'
import { useDialog } from '../context/DialogContext'
import { setAssignment } from '../services/shiftAssignments'
import CellEditModal from '../components/CellEditModal'
import { AR_DAYS, AR_DAYS_SHORT, daysInMonth, monthLabel, weekdayOf } from '../utils/dates'

type GridPreset = 'today' | 'week' | 'month' | 'custom'

function currentWeekRange(y: number, m: number): [number, number] {
  const nd = daysInMonth(y, m)
  const today = new Date()
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m
  const anchorDay = isThisMonth ? today.getDate() : 1
  const wd = weekdayOf(y, m, anchorDay)
  const start = anchorDay - wd
  const end = start + 6
  return [Math.max(1, start), Math.min(nd, end)]
}

/** Mirrors the RLS policy on shift_assignments so the UI matches what the DB will actually allow. */
function editPermission(role: string, monthStatus: string | undefined): 'full' | 'sick_only' | 'none' {
  if (role === 'admin') return 'full'
  if (role === 'shift_manager') return monthStatus === 'draft' ? 'full' : 'sick_only'
  return 'none'
}

export default function Grid() {
  const { user } = useAuth()
  const { employees, shiftTypes, currentMonth, roster, reloadRoster } = useAppData()
  const { alert } = useDialog()
  const [preset, setPreset] = useState<GridPreset>('month')
  const [customFrom, setCustomFrom] = useState(1)
  const [customTo, setCustomTo] = useState(31)
  const [quickFilterCode, setQuickFilterCode] = useState('')
  const [sickPanelOpen, setSickPanelOpen] = useState(false)
  const [sickEmpId, setSickEmpId] = useState('')
  const [sickType, setSickType] = useState<'Y' | 'ABS'>('Y')
  const [sickDate, setSickDate] = useState(1)
  const [modalCtx, setModalCtx] = useState<{ employeeId: string; day: number } | null>(null)

  const year = currentMonth?.year ?? new Date().getFullYear()
  const month = currentMonth?.month ?? new Date().getMonth() + 1
  const nd = daysInMonth(year, month)

  const [from, to] = useMemo(() => {
    if (preset === 'today') {
      const today = new Date()
      const d = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : 1
      return [d, d]
    }
    if (preset === 'week') return currentWeekRange(year, month)
    if (preset === 'custom') return [Math.max(1, Math.min(customFrom, nd)), Math.max(1, Math.min(customTo, nd))]
    return [1, nd]
  }, [preset, year, month, nd, customFrom, customTo])

  const shiftByCode = new Map(shiftTypes.map((s) => [s.code, s]))
  const isWeekMode = to - from <= 7
  const perm = editPermission(user?.role ?? 'view_only', currentMonth?.status)

  const days: number[] = []
  for (let d = from; d <= to; d++) days.push(d)

  async function handleSelect(code: string | null) {
    if (!modalCtx || !user || !currentMonth) return
    if (perm === 'none') return
    if (perm === 'sick_only' && code !== 'Y' && code !== 'ABS' && code !== null) {
      await alert('الشهر ده منشور/مغلق — تقدر بس تسجل إجازة/غياب من غير Admin.')
      return
    }
    await setAssignment(currentMonth.id, modalCtx.employeeId, modalCtx.day, code, user)
    setModalCtx(null)
    await reloadRoster()
  }

  async function registerSickLeave() {
    if (!user || !currentMonth || !sickEmpId) return
    await setAssignment(currentMonth.id, sickEmpId, sickDate, sickType, user)
    await reloadRoster()
    const emp = employees.find((e) => e.id === sickEmpId)
    await alert(`تم تسجيل ${sickType === 'Y' ? 'إجازة مرضية' : 'غياب'} لـ ${emp?.name ?? ''} يوم ${sickDate}.`)
  }

  return (
    <section>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="panel-title">
              <span className="bar"></span>
              <span>{currentMonth ? monthLabel(currentMonth.year, currentMonth.month) : ''}</span>
            </div>
            <div className="muted">اضغط على أي خانة لتسجيل شيفت أو إجازة أو غياب ليوم بعينه</div>
          </div>
          <button className="btn secondary" onClick={() => window.print()}>🖨️ طباعة / PDF</button>
        </div>

        <div className="toolbar-block">
          <span className="label">عرض المدة</span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="seg">
              {(['today', 'week', 'month', 'custom'] as GridPreset[]).map((p) => (
                <button key={p} className={preset === p ? 'active' : ''} onClick={() => setPreset(p)}>
                  {{ today: 'اليوم', week: 'الأسبوع الحالي', month: 'الشهر كامل', custom: 'مدة مخصصة' }[p]}
                </button>
              ))}
            </div>
            <div className="field">
              <label>تصفية سريعة بشيفت</label>
              <select value={quickFilterCode} onChange={(e) => setQuickFilterCode(e.target.value)}>
                <option value="">بدون تصفية — إظهار الكل</option>
                {shiftTypes.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} — {s.description}</option>
                ))}
              </select>
            </div>
          </div>
          {preset === 'custom' && (
            <div className="row" style={{ marginTop: 10 }}>
              <div className="field">
                <label>من يوم</label>
                <input type="number" min={1} max={nd} value={customFrom} onChange={(e) => setCustomFrom(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>إلى يوم</label>
                <input type="number" min={1} max={nd} value={customTo} onChange={(e) => setCustomTo(Number(e.target.value))} />
              </div>
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={() => setSickPanelOpen((v) => !v)}>🩺 تسجيل إجازة مرضية / غياب</button>
        </div>

        {sickPanelOpen && (
          <div className="toolbar-block">
            <div className="row">
              <div className="field">
                <label>الشخص</label>
                <select value={sickEmpId} onChange={(e) => setSickEmpId(e.target.value)} style={{ minWidth: 170 }}>
                  <option value="">اختر...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>النوع</label>
                <select value={sickType} onChange={(e) => setSickType(e.target.value as 'Y' | 'ABS')}>
                  <option value="Y">🩺 إجازة مرضية</option>
                  <option value="ABS">🚫 غياب</option>
                </select>
              </div>
              <div className="field">
                <label>اليوم</label>
                <input type="number" min={1} max={nd} value={sickDate} onChange={(e) => setSickDate(Number(e.target.value))} />
              </div>
            </div>
            <button className="btn secondary" style={{ marginTop: 10 }} onClick={registerSickLeave} disabled={!sickEmpId}>
              تسجيل
            </button>
          </div>
        )}

        <div className="legend">
          {shiftTypes.map((s) => (
            <span className="chip" key={s.code} style={{ background: `${s.color}22`, color: s.color === '#FFE599' ? '#8a6d00' : s.color }}>
              <span className="dot" style={{ background: s.color }}></span>{s.code} — {s.description}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="wrap-scroll">
          <table className={`grid ${isWeekMode ? 'week-mode' : ''}`}>
            <thead>
              <tr>
                <th className="name-col">الاسم</th>
                <th className="role-col">الدور</th>
                {days.map((d) => (
                  <th key={d} title={AR_DAYS[weekdayOf(year, month, d)]}>
                    {d}<br /><span style={{ fontWeight: 800, fontSize: 11 }}>{AR_DAYS_SHORT[weekdayOf(year, month, d)]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="name-col">{emp.name}</td>
                  <td className="role-col">{emp.jobRole || ''}</td>
                  {days.map((d) => {
                    const code = roster[emp.id]?.[d]
                    const dim = quickFilterCode && code !== quickFilterCode ? ' dim' : ''
                    const s = code ? shiftByCode.get(code) : undefined
                    const clickable = perm !== 'none'
                    return (
                      <td
                        key={d}
                        className={`shift-cell ${clickable ? 'editable' : ''} ${!s ? 'empty' : ''}${dim}`}
                        style={s ? { background: s.color, color: s.textColor } : undefined}
                        title={s?.description}
                        onClick={() => clickable && setModalCtx({ employeeId: emp.id, day: d })}
                      >
                        {s ? (
                          <>
                            {code}
                            {isWeekMode && <span className="time-sub">{s.description}</span>}
                          </>
                        ) : '–'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CellEditModal
        open={Boolean(modalCtx)}
        title={
          modalCtx
            ? `${employees.find((e) => e.id === modalCtx.employeeId)?.name ?? ''} — ${modalCtx.day} ${monthLabel(year, month)}`
            : ''
        }
        shiftTypes={perm === 'sick_only' ? shiftTypes.filter((s) => s.code === 'Y' || s.code === 'ABS') : shiftTypes}
        currentCode={modalCtx ? roster[modalCtx.employeeId]?.[modalCtx.day] : undefined}
        onSelect={handleSelect}
        onClose={() => setModalCtx(null)}
      />
    </section>
  )
}
