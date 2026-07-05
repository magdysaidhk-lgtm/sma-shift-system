import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext'
import { listAssignmentsForMonth, type RosterMap } from '../services/shiftAssignments'
import { deleteMonth } from '../services/months'
import { useAuth } from '../auth/AuthContext'
import { useDialog } from '../context/DialogContext'
import { hourInRange, hourLabel, monthLabel, realTodayKey } from '../utils/dates'

export default function Dashboard() {
  const { user } = useAuth()
  const { employees, shiftTypes, months, currentMonth, setCurrentMonthId, reloadMonths } = useAppData()
  const { confirm, alert } = useDialog()
  const navigate = useNavigate()
  const [todayRoster, setTodayRoster] = useState<RosterMap>({})

  const { year: todayYear, month: todayMonth } = realTodayKey()
  const todayMonthRow = months.find((m) => m.year === todayYear && m.month === todayMonth) ?? null
  const now = new Date()

  useEffect(() => {
    if (!todayMonthRow) {
      setTodayRoster({})
      return
    }
    listAssignmentsForMonth(todayMonthRow.id).then(setTodayRoster)
  }, [todayMonthRow?.id])

  const shiftByCode = new Map(shiftTypes.map((s) => [s.code, s]))
  const onNow = employees.filter((e) => {
    const code = todayRoster[e.id]?.[now.getDate()]
    const s = code ? shiftByCode.get(code) : undefined
    return s && s.startHour != null && hourInRange(now.getHours(), s.startHour, s.endHour)
  })

  let sick = 0
  let absent = 0
  if (currentMonth && currentMonth.year === todayYear && currentMonth.month === todayMonth) {
    employees.forEach((e) => {
      const code = todayRoster[e.id]?.[now.getDate()]
      if (code === 'Y') sick++
      if (code === 'ABS') absent++
    })
  }

  const cards = [
    { num: employees.length, lbl: 'إجمالي أعضاء الفريق' },
    { num: months.length, lbl: 'عدد الشهور المحفوظة' },
    { num: sick, lbl: 'إجازة مرضية اليوم', cls: sick > 0 ? 'warn' : '' },
    { num: absent, lbl: 'غياب اليوم', cls: absent > 0 ? 'danger' : '' },
  ]

  async function handleDeleteMonth(id: string) {
    if (months.length <= 1) {
      await alert('مينفعش تحذف الشهر الوحيد الموجود.')
      return
    }
    const m = months.find((mm) => mm.id === id)
    if (!m || !user) return
    const ok = await confirm(`تأكيد حذف "${monthLabel(m.year, m.month)}" بكل بياناته؟ الإجراء ده نهائي.`)
    if (!ok) return
    await deleteMonth(id, user)
    await reloadMonths()
  }

  return (
    <section>
      <div className="now-card">
        <div className="title">
          مين شغال دلوقتي — {now.toLocaleDateString('ar-EG')} — الساعة {hourLabel(now.getHours())}
        </div>
        <div className="now-people">
          {!todayMonthRow ? (
            <div className="now-person">لسه معملتش جدول للشهر الحالي</div>
          ) : onNow.length === 0 ? (
            <div className="now-person">لا يوجد موظفون مسجلون في الشيفت الحالي</div>
          ) : (
            onNow.map((e) => {
              const code = todayRoster[e.id]?.[now.getDate()]
              const s = code ? shiftByCode.get(code) : undefined
              return (
                <div className="now-person" key={e.id}>
                  <b>{e.name}</b>
                  {code} — {s?.description}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="stats-row">
        {cards.map((c) => (
          <div className={`stat-card ${c.cls || ''}`} key={c.lbl}>
            <div className="num">{c.num}</div>
            <div className="lbl">{c.lbl}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="panel-title"><span className="bar"></span>إجراءات سريعة</div>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn secondary" onClick={() => navigate('/grid')}>📅 فتح الجدول العام</button>
          <button className="btn secondary" onClick={() => navigate('/generate')}>⚙️ توليد شهر جديد</button>
          <button className="btn secondary" onClick={() => navigate('/filter')}>🔍 فلترة بشيفت</button>
          <button className="btn secondary" onClick={() => navigate('/grid')}>🩺 تسجيل إجازة / غياب</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><span className="bar"></span>الشهور المتاحة</div>
        <div style={{ marginTop: 8 }}>
          {months.map((m) => (
            <div className="month-row" key={m.id}>
              <span className={`name ${m.id === currentMonth?.id ? 'current' : ''}`}>
                {monthLabel(m.year, m.month)}
                {m.year === todayYear && m.month === todayMonth ? ' (الشهر الحالي)' : ''}
              </span>
              <div className="row">
                <button
                  className="btn ghost"
                  onClick={() => {
                    setCurrentMonthId(m.id)
                    navigate('/grid')
                  }}
                >
                  فتح
                </button>
                <button className="btn danger" onClick={() => handleDeleteMonth(m.id)}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
