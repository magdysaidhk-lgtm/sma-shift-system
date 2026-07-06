import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../auth/AuthContext'
import { useDialog } from '../context/DialogContext'
import { setAssignment, listAssignmentsForMonth, type RosterMap } from '../services/shiftAssignments'
import CellEditModal from '../components/CellEditModal'
import ExportPortal from '../components/ExportPortal'
import NameSearchInput from '../components/NameSearchInput'
import { AR_DAYS, AR_DAYS_SHORT, daysInMonth, monthLabel, weekdayOf } from '../utils/dates'
import type { Month } from '../types/domain'

type GridPreset = 'today' | 'week' | 'month' | 'custom'

interface MonthBlock {
  year: number
  month: number
  fromDay: number
  toDay: number
  monthRecord: Month | null
  roster: RosterMap
}

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

/** Splits an arbitrary [from,to] date range into one entry per calendar month it touches. */
function eachMonthInRange(fromISO: string, toISO: string): { year: number; month: number; fromDay: number; toDay: number }[] {
  const [fy, fm, fd] = fromISO.split('-').map(Number)
  const [ty, tm, td] = toISO.split('-').map(Number)
  const spans: { year: number; month: number; fromDay: number; toDay: number }[] = []
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    const isFirst = y === fy && m === fm
    const isLast = y === ty && m === tm
    spans.push({
      year: y,
      month: m,
      fromDay: isFirst ? fd : 1,
      toDay: isLast ? td : daysInMonth(y, m),
    })
    m++
    if (m > 12) { m = 1; y++ }
    if (spans.length >= 12) break // sane cap
  }
  return spans
}

/** Mirrors the RLS policy on shift_assignments so the UI matches what the DB will actually allow. */
function editPermission(role: string, monthStatus: string | undefined): 'full' | 'sick_only' | 'none' {
  if (role === 'admin') return 'full'
  if (role === 'shift_manager') return monthStatus === 'draft' ? 'full' : 'sick_only'
  return 'none'
}

export default function Grid() {
  const { user } = useAuth()
  const { employees, shiftTypes, months, currentMonth, roster, reloadRoster } = useAppData()
  const { alert } = useDialog()
  const [preset, setPreset] = useState<GridPreset>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customBlocks, setCustomBlocks] = useState<MonthBlock[]>([])
  const [quickFilterCode, setQuickFilterCode] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [sickPanelOpen, setSickPanelOpen] = useState(false)
  const [sickEmpId, setSickEmpId] = useState('')
  const [sickType, setSickType] = useState<'Y' | 'ABS'>('Y')
  const [sickDate, setSickDate] = useState(1)
  const [modalCtx, setModalCtx] = useState<{ employeeId: string; day: number; monthId: string; perm: 'full' | 'sick_only' | 'none' } | null>(null)
  const [printMessage, setPrintMessage] = useState('')

  const year = currentMonth?.year ?? new Date().getFullYear()
  const month = currentMonth?.month ?? new Date().getMonth() + 1
  const nd = daysInMonth(year, month)

  const isCustomRange = preset === 'custom' && Boolean(dateFrom) && Boolean(dateTo) && dateFrom <= dateTo

  const [from, to] = useMemo(() => {
    if (preset === 'today') {
      const today = new Date()
      const d = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : 1
      return [d, d]
    }
    if (preset === 'week') return currentWeekRange(year, month)
    return [1, nd]
  }, [preset, year, month, nd])

  async function loadCustomBlocks() {
    if (!isCustomRange) return
    const spans = eachMonthInRange(dateFrom, dateTo)
    const blocks = await Promise.all(
      spans.map(async (s): Promise<MonthBlock> => {
        const monthRecord = months.find((m) => m.year === s.year && m.month === s.month) ?? null
        const blockRoster = monthRecord ? await listAssignmentsForMonth(monthRecord.id) : {}
        return { ...s, monthRecord, roster: blockRoster }
      }),
    )
    setCustomBlocks(blocks)
  }

  useEffect(() => {
    if (isCustomRange) loadCustomBlocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomRange, dateFrom, dateTo, months])

  const shiftByCode = new Map(shiftTypes.map((s) => [s.code, s]))
  const isWeekMode = to - from <= 7
  const perm = editPermission(user?.role ?? 'view_only', currentMonth?.status)
  const visibleEmployees = useMemo(() => {
    const q = nameSearch.trim().toLowerCase()
    return q ? employees.filter((e) => e.name.toLowerCase().includes(q)) : employees
  }, [employees, nameSearch])

  const days: number[] = []
  for (let d = from; d <= to; d++) days.push(d)

  async function handleSelect(code: string | null) {
    if (!modalCtx || !user) return
    if (modalCtx.perm === 'none') return
    if (modalCtx.perm === 'sick_only' && code !== 'Y' && code !== 'ABS' && code !== null) {
      await alert('الشهر ده منشور/مغلق — تقدر بس تسجل إجازة/غياب من غير Admin.')
      return
    }
    await setAssignment(modalCtx.monthId, modalCtx.employeeId, modalCtx.day, code, user)
    setModalCtx(null)
    if (currentMonth && modalCtx.monthId === currentMonth.id) await reloadRoster()
    if (isCustomRange) await loadCustomBlocks()
  }

  async function registerSickLeave() {
    if (!user || !currentMonth || !sickEmpId) return
    await setAssignment(currentMonth.id, sickEmpId, sickDate, sickType, user)
    await reloadRoster()
    const emp = employees.find((e) => e.id === sickEmpId)
    await alert(`تم تسجيل ${sickType === 'Y' ? 'إجازة مرضية' : 'غياب'} لـ ${emp?.name ?? ''} يوم ${sickDate}.`)
  }

  function currentModalRosterCode() {
    if (!modalCtx) return undefined
    if (currentMonth && modalCtx.monthId === currentMonth.id) return roster[modalCtx.employeeId]?.[modalCtx.day]
    const block = customBlocks.find((b) => b.monthRecord?.id === modalCtx.monthId)
    return block?.roster[modalCtx.employeeId]?.[modalCtx.day]
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
          <div className="row" style={{ alignItems: 'center' }}>
            <input
              type="text"
              placeholder="رسالة تُطبع أعلى الجدول (اختياري)"
              value={printMessage}
              onChange={(e) => setPrintMessage(e.target.value)}
              style={{ minWidth: 220 }}
            />
            <button className="btn secondary" onClick={() => window.print()}>🖨️ طباعة / PDF</button>
          </div>
        </div>

        <div className="toolbar-block">
          <span className="label">عرض المدة</span>
          <div className="seg">
            {(['today', 'week', 'month', 'custom'] as GridPreset[]).map((p) => (
              <button key={p} className={preset === p ? 'active' : ''} onClick={() => setPreset(p)}>
                {{ today: 'اليوم', week: 'الأسبوع الحالي', month: 'الشهر كامل', custom: 'مدة مخصصة' }[p]}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="row" style={{ marginTop: 10 }}>
              <div className="field">
                <label>من تاريخ</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="field">
                <label>إلى تاريخ</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="muted" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
                لو المدة عدّت أكتر من شهر، كل شهر هيظهر في جدول منفصل بعنوانه.
              </div>
            </div>
          )}
        </div>

        <div className="filters-grid">
          <div className="field">
            <label>بحث بالاسم</label>
            <NameSearchInput id="grid-employee-names" employees={employees} value={nameSearch} onChange={setNameSearch} />
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

      {isCustomRange ? (
        customBlocks.map((block) => {
          const blockPerm = editPermission(user?.role ?? 'view_only', block.monthRecord?.status)
          const blockDays: number[] = []
          for (let d = block.fromDay; d <= block.toDay; d++) blockDays.push(d)
          return (
            <div className="panel" key={`${block.year}-${block.month}`}>
              <div className="panel-title" style={{ marginBottom: 10 }}>
                <span className="bar"></span>{monthLabel(block.year, block.month)}
                <span className="muted" style={{ fontWeight: 500 }}>(من {block.fromDay} إلى {block.toDay})</span>
              </div>
              {!block.monthRecord ? (
                <div className="muted">لا يوجد جدول محفوظ لهذا الشهر.</div>
              ) : (
                <div className="wrap-scroll">
                  <table className="grid">
                    <thead>
                      <tr>
                        <th className="name-col">الاسم</th>
                        <th className="role-col">الدور</th>
                        {blockDays.map((d) => (
                          <th key={d} title={AR_DAYS[weekdayOf(block.year, block.month, d)]}>
                            {d}<br /><span style={{ fontWeight: 800, fontSize: 11 }}>{AR_DAYS_SHORT[weekdayOf(block.year, block.month, d)]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEmployees.map((emp) => (
                        <tr key={emp.id}>
                          <td className="name-col">{emp.name}</td>
                          <td className="role-col">{emp.jobRole || ''}</td>
                          {blockDays.map((d) => {
                            const code = block.roster[emp.id]?.[d]
                            const dim = quickFilterCode && code !== quickFilterCode ? ' dim' : ''
                            const s = code ? shiftByCode.get(code) : undefined
                            const clickable = blockPerm !== 'none'
                            return (
                              <td
                                key={d}
                                className={`shift-cell ${clickable ? 'editable' : ''} ${!s ? 'empty' : ''}${dim}`}
                                style={s ? { background: s.color, color: s.textColor } : undefined}
                                title={s?.description}
                                onClick={() => clickable && block.monthRecord && setModalCtx({ employeeId: emp.id, day: d, monthId: block.monthRecord.id, perm: blockPerm })}
                              >
                                {s ? code : '–'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })
      ) : (
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
                {visibleEmployees.map((emp) => (
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
                          onClick={() => clickable && currentMonth && setModalCtx({ employeeId: emp.id, day: d, monthId: currentMonth.id, perm })}
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
      )}

      <CellEditModal
        open={Boolean(modalCtx)}
        title={
          modalCtx
            ? `${employees.find((e) => e.id === modalCtx.employeeId)?.name ?? ''} — يوم ${modalCtx.day}`
            : ''
        }
        shiftTypes={modalCtx?.perm === 'sick_only' ? shiftTypes.filter((s) => s.code === 'Y' || s.code === 'ABS') : shiftTypes}
        currentCode={currentModalRosterCode()}
        onSelect={handleSelect}
        onClose={() => setModalCtx(null)}
      />

      {/* Print-only export view — a clean paginated table instead of printing the interactive grid. */}
      <ExportPortal>
        {isCustomRange ? (
          customBlocks.map((block) => {
            const blockDays: number[] = []
            for (let d = block.fromDay; d <= block.toDay; d++) blockDays.push(d)
            return (
              <div className="export-page" key={`${block.year}-${block.month}`}>
                <div className="export-head">
                  <h2>{monthLabel(block.year, block.month)}</h2>
                  <div className="muted">سوبر مسلم أكاديمي</div>
                </div>
                {printMessage && <p style={{ background: '#f6f8fb', border: '1px solid #e6e9f0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>{printMessage}</p>}
                {block.monthRecord && (
                  <table className="export-table" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>الدور</th>
                        {blockDays.map((d) => <th key={d}>{d}<br />{AR_DAYS_SHORT[weekdayOf(block.year, block.month, d)]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEmployees.map((emp) => (
                        <tr key={emp.id}>
                          <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{emp.name}</td>
                          <td>{emp.jobRole || ''}</td>
                          {blockDays.map((d) => {
                            const code = block.roster[emp.id]?.[d]
                            const s = code ? shiftByCode.get(code) : undefined
                            return <td key={d} style={{ textAlign: 'center', background: s?.color, color: s?.textColor, fontWeight: 700 }}>{code || '–'}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })
        ) : (
          <div className="export-page">
            <div className="export-head">
              <div>
                <h2>{monthLabel(year, month)}</h2>
                <div className="muted">الجدول العام{(from !== 1 || to !== nd) ? ` — من ${from} إلى ${to}` : ''}</div>
              </div>
              <div className="muted">سوبر مسلم أكاديمي</div>
            </div>
            {printMessage && (
              <p style={{ background: '#f6f8fb', border: '1px solid #e6e9f0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                {printMessage}
              </p>
            )}
            <table className="export-table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الدور</th>
                  {days.map((d) => <th key={d}>{d}<br />{AR_DAYS_SHORT[weekdayOf(year, month, d)]}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{emp.name}</td>
                    <td>{emp.jobRole || ''}</td>
                    {days.map((d) => {
                      const code = roster[emp.id]?.[d]
                      const s = code ? shiftByCode.get(code) : undefined
                      return (
                        <td key={d} style={{ textAlign: 'center', background: s?.color, color: s?.textColor, fontWeight: 700 }}>
                          {code || '–'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="export-summary">
              {shiftTypes.map((s) => (
                <span className="item" key={s.code}>{s.code} = {s.description}</span>
              ))}
            </div>
          </div>
        )}
      </ExportPortal>
    </section>
  )
}
