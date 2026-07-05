import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { AR_DAYS, daysInMonth, monthLabel, weekdayOf } from '../utils/dates'

type Preset = 'month' | 'week' | 'custom'

function currentWeekRange(y: number, m: number): [number, number] {
  const nd = daysInMonth(y, m)
  const today = new Date()
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m
  const anchorDay = isThisMonth ? today.getDate() : 1
  const wd = weekdayOf(y, m, anchorDay)
  const start = anchorDay - wd
  return [Math.max(1, start), Math.min(nd, start + 6)]
}

export default function FilterByShift() {
  const { employees, shiftTypes, currentMonth, roster } = useAppData()
  const [code, setCode] = useState('')
  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState(1)
  const [customTo, setCustomTo] = useState(31)

  const year = currentMonth?.year ?? new Date().getFullYear()
  const month = currentMonth?.month ?? new Date().getMonth() + 1
  const nd = daysInMonth(year, month)
  const activeCode = code || shiftTypes[0]?.code || ''

  const [from, to] = useMemo(() => {
    if (preset === 'week') return currentWeekRange(year, month)
    if (preset === 'custom') return [Math.max(1, Math.min(customFrom, nd)), Math.max(1, Math.min(customTo, nd))]
    return [1, nd]
  }, [preset, year, month, nd, customFrom, customTo])

  const s = shiftTypes.find((st) => st.code === activeCode)
  const matches = employees
    .map((emp) => {
      const days: number[] = []
      for (let d = from; d <= to; d++) if (roster[emp.id]?.[d] === activeCode) days.push(d)
      return { emp, days }
    })
    .filter((m) => m.days.length > 0)

  const rangeLabel = from === 1 && to === nd ? '' : ` (من ${from} إلى ${to})`

  return (
    <section>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="panel-title">
            <span className="bar"></span>فلترة بشيفت — {currentMonth ? monthLabel(currentMonth.year, currentMonth.month) : ''}
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <div className="field">
            <label>اختر الشيفت</label>
            <select value={activeCode} onChange={(e) => setCode(e.target.value)}>
              {shiftTypes.map((st) => <option key={st.code} value={st.code}>{st.code} — {st.description}</option>)}
            </select>
          </div>
          <div className="seg">
            {(['month', 'week', 'custom'] as Preset[]).map((p) => (
              <button key={p} className={preset === p ? 'active' : ''} onClick={() => setPreset(p)}>
                {{ month: 'الشهر كامل', week: 'الأسبوع الحالي', custom: 'مدة مخصصة' }[p]}
              </button>
            ))}
          </div>
          {matches.length > 0 && (
            <button className="btn ghost no-print" onClick={() => window.print()}>🖨️ طباعة / PDF</button>
          )}
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

      <div className="panel">
        <strong className="panel-title">
          الأشخاص في شيفت "{activeCode}" — {s?.description}{rangeLabel} ({matches.length} شخص)
        </strong>
        <div style={{ marginTop: 10 }}>
          {matches.length === 0 ? (
            <div className="muted" style={{ padding: '10px 0' }}>لا يوجد أحد على هذا الشيفت في المدة المحددة</div>
          ) : (
            matches.map(({ emp, days }) => (
              <div className="filter-emp-row" key={emp.id}>
                <div className="filter-emp-name">{emp.name}</div>
                <div className="filter-emp-role">{emp.jobRole || ''}</div>
                <div className="filter-emp-count">{days.length} يوم</div>
                <div className="filter-days">
                  {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((d) => {
                    const on = days.includes(d)
                    return (
                      <span
                        key={d}
                        className={`filter-day-dot ${on ? '' : 'off'}`}
                        style={on && s ? { background: s.color, color: s.textColor } : undefined}
                        title={`${d} ${AR_DAYS[weekdayOf(year, month, d)]}`}
                      >
                        {d}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
