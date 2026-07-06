import { useEffect, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { daysInMonth, hourInRange, hourLabel, realTodayKey } from '../utils/dates'

export default function Coverage() {
  const { employees, shiftTypes, settings, currentMonth, roster } = useAppData()
  const year = currentMonth?.year ?? new Date().getFullYear()
  const month = currentMonth?.month ?? new Date().getMonth() + 1
  const nd = daysInMonth(year, month)
  const { year: ty, month: tm } = realTodayKey()
  const isRealTodayMonth = year === ty && month === tm

  const [day, setDay] = useState(isRealTodayMonth ? new Date().getDate() : 1)
  const [nameSearch, setNameSearch] = useState('')
  const [hourFrom, setHourFrom] = useState(0)
  const [hourTo, setHourTo] = useState(23)
  useEffect(() => {
    setDay(isRealTodayMonth ? new Date().getDate() : 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth?.id])

  const shiftByCode = new Map(shiftTypes.map((s) => [s.code, s]))
  const hourCounts = new Array(24).fill(0)
  const allRows = employees.map((emp) => {
    const code = roster[emp.id]?.[day]
    const s = code ? shiftByCode.get(code) : undefined
    const covers = new Array(24).fill(false)
    if (s && s.startHour != null && s.endHour != null) {
      for (let h = 0; h < 24; h++) {
        if (hourInRange(h, s.startHour, s.endHour)) {
          covers[h] = true
          hourCounts[h]++
        }
      }
    }
    return { emp, code, s, covers }
  })
  const nameQuery = nameSearch.trim().toLowerCase()
  const rows = nameQuery ? allRows.filter((r) => r.emp.name.toLowerCase().includes(nameQuery)) : allRows

  const from = Math.max(0, Math.min(hourFrom, hourTo))
  const to = Math.min(23, Math.max(hourFrom, hourTo))
  const visibleHours: number[] = []
  for (let h = from; h <= to; h++) visibleHours.push(h)

  const peakHours: number[] = []
  for (let h = 0; h < 24; h++) if (hourInRange(h, settings.peakStartH, settings.peakEndH)) peakHours.push(h)
  const minPeakCoverage = peakHours.length ? Math.min(...peakHours.map((h) => hourCounts[h])) : 0

  return (
    <section>
      <div className="panel">
        <div className="panel-title"><span className="bar"></span>مين موجود في كل ساعة (تغطية بالساعة)</div>
        <div className="muted">المنطقة المظلّلة هي وقت الضغط الأكبر — راجعها كويس عند التوزيع. الفلاتر تحت كلها اختيارية وتقدر تجمّع بينها بحرية.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field">
            <label>اليوم</label>
            <input type="number" min={1} max={nd} value={day} onChange={(e) => setDay(Number(e.target.value))} />
          </div>
          {isRealTodayMonth && (
            <button className="btn ghost" onClick={() => setDay(new Date().getDate())}>اليوم</button>
          )}
          <div className="field">
            <label>بحث بالاسم</label>
            <input type="text" placeholder="اسم الموظف..." value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} style={{ minWidth: 160 }} />
          </div>
          <div className="field">
            <label>من الساعة</label>
            <select value={hourFrom} onChange={(e) => setHourFrom(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>إلى الساعة</label>
            <select value={hourTo} onChange={(e) => setHourTo(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          {(nameSearch || from !== 0 || to !== 23) && (
            <button className="btn ghost" onClick={() => { setNameSearch(''); setHourFrom(0); setHourTo(23) }}>
              إلغاء كل الفلاتر
            </button>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="wrap-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th className="name-col">الاسم</th>
                <th className="role-col">الشيفت</th>
                {visibleHours.map((h) => (
                  <th key={h} className={hourInRange(h, settings.peakStartH, settings.peakEndH) ? 'peak' : ''}>
                    {hourLabel(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!nameQuery && (
                <tr>
                  <td className="name-col" style={{ fontWeight: 800 }}>عدد المتواجدين</td>
                  <td className="role-col"></td>
                  {visibleHours.map((h) => (
                    <td
                      key={h}
                      className={hourInRange(h, settings.peakStartH, settings.peakEndH) ? 'peak-col' : ''}
                      style={{ fontWeight: 800, color: hourCounts[h] === 0 ? '#d6455a' : undefined }}
                    >
                      {hourCounts[h]}
                    </td>
                  ))}
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.emp.id}>
                  <td className="name-col">{r.emp.name}</td>
                  <td className="role-col">
                    {r.code ? <span style={{ color: r.s ? (r.s.color === '#FFE599' ? '#8a6d00' : r.s.color) : '#999' }}>{r.code}</span> : '—'}
                  </td>
                  {visibleHours.map((h) => {
                    const on = r.covers[h]
                    return (
                      <td
                        key={h}
                        className={`shift-cell ${on ? '' : 'empty'} ${!on && hourInRange(h, settings.peakStartH, settings.peakEndH) ? 'peak-col' : ''}`}
                        style={on && r.s ? { background: r.s.color, color: r.s.textColor } : undefined}
                      >
                        {on ? '' : '–'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!nameQuery && (
          <div className="hint" style={{ marginTop: 10 }}>
            {minPeakCoverage === 0
              ? `⚠️ فيه ساعة أو أكتر في وقت الضغط من غير أي تغطية خالص ليوم ${day}.`
              : minPeakCoverage === 1
                ? `⚠️ أقل تغطية في وقت الضغط هي شخص واحد بس ليوم ${day} — ممكن تحتاج تدعيم.`
                : `✅ وقت الضغط مغطّى بـ ${minPeakCoverage} شخص على الأقل طول الوقت ده ليوم ${day}.`}
          </div>
        )}
      </div>
    </section>
  )
}
