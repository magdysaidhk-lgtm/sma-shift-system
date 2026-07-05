import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../auth/AuthContext'
import { useDialog } from '../context/DialogContext'
import {
  buildGenConfig, generateSchedule, spreadRestDaysByRole, buildReviewReport, defaultWorkableCodes,
  type GenConfig,
} from '../services/generation'
import { listAssignmentsForMonth, saveGeneratedRoster, type RosterMap } from '../services/shiftAssignments'
import { getMonth, createMonth, setMonthStatus } from '../services/months'
import CellEditModal from '../components/CellEditModal'
import { AR_DAYS, AR_MONTHS, daysInMonth, weekdayOf } from '../utils/dates'

export default function Generate() {
  const { user } = useAuth()
  const { employees, shiftTypes, settings, currentMonth, reloadMonths } = useAppData()
  const { alert, confirm } = useDialog()
  const navigate = useNavigate()

  const nextDefault = (() => {
    const cy = currentMonth?.year ?? new Date().getFullYear()
    const cm = currentMonth?.month ?? new Date().getMonth() + 1
    let nm = cm + 1, ny = cy
    if (nm > 12) { nm = 1; ny++ }
    return { year: ny, month: nm }
  })()

  const [targetYear, setTargetYear] = useState(nextDefault.year)
  const [targetMonth, setTargetMonth] = useState(nextDefault.month)
  const [configs, setConfigs] = useState<GenConfig[] | null>(null)
  const [roster, setRoster] = useState<RosterMap | null>(null)
  const [modalCtx, setModalCtx] = useState<{ employeeId: string; day: number } | null>(null)
  const [showIssues, setShowIssues] = useState(true)
  const [busy, setBusy] = useState(false)

  const canGenerate = user?.role === 'admin' || user?.role === 'shift_manager'
  const workCodes = defaultWorkableCodes(shiftTypes)
  const nd = daysInMonth(targetYear, targetMonth)

  async function handlePrep() {
    if (!currentMonth) return
    const prevRoster = await listAssignmentsForMonth(currentMonth.id)
    const cfgs = buildGenConfig(employees, prevRoster, targetYear, targetMonth, settings, shiftTypes)
    setConfigs(cfgs)
    setRoster(null)
  }

  function updateConfig(idx: number, patch: Partial<GenConfig>) {
    setConfigs((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  function toggleCode(idx: number, code: string, checked: boolean) {
    setConfigs((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const codes = checked ? [...next[idx].codes, code] : next[idx].codes.filter((c) => c !== code)
      next[idx] = { ...next[idx], codes }
      return next
    })
  }

  function handleSpreadRestDays() {
    setConfigs((prev) => (prev ? spreadRestDaysByRole([...prev], settings.allowedRestDays) : prev))
  }

  function handleGenerate() {
    if (!configs) return
    setRoster(generateSchedule(targetYear, targetMonth, configs))
  }

  const report = roster
    ? buildReviewReport(roster, employees, targetYear, targetMonth, settings, shiftTypes)
    : null

  async function ensureTargetMonth() {
    if (!user) return null
    let m = await getMonth(targetYear, targetMonth)
    if (!m) m = await createMonth(targetYear, targetMonth, user)
    return m
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!roster || !user) return
    setBusy(true)
    try {
      const m = await ensureTargetMonth()
      if (!m) return
      await saveGeneratedRoster(m.id, roster, user)
      await setMonthStatus(m.id, status, user)
      await reloadMonths()
      await alert(status === 'published' ? 'تم اعتماد الشهر الجديد ونشره.' : 'تم حفظ الشهر كمسودة.')
      navigate('/grid')
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove() {
    if (report && report.issues.some((i) => i.severity === 'critical')) {
      const ok = await confirm('فيه تحذيرات حرجة في تقرير المراجعة (أيام متتالية / صباحي بعد ليلي / عجز تغطية). تأكيد الاعتماد رغم ذلك؟')
      if (!ok) return
    }
    await handleSave('published')
  }

  return (
    <section>
      <div className="panel">
        <div className="row">
          <div className="field">
            <label>الشهر</label>
            <select value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))}>
              {AR_MONTHS.map((mn, i) => <option key={i} value={i + 1}>{mn}</option>)}
            </select>
          </div>
          <div className="field">
            <label>السنة</label>
            <input type="number" style={{ width: 90 }} value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} />
          </div>
          {canGenerate ? (
            <>
              <button className="btn secondary" onClick={handlePrep}>تجهيز قائمة الفريق</button>
              {configs && <button className="btn ghost" onClick={handleSpreadRestDays}>🔁 توزيع أيام الراحة تلقائيًا حسب الدور</button>}
            </>
          ) : (
            <span className="muted">توليد الشهر متاح فقط لـ Admin أو Shift Manager.</span>
          )}
        </div>
        <p className="note">
          كل شخص افتراضيًا بيشتغل كل الشيفتات — تقدر تشيل اللي مش عايزه من عنده بس. أيام الراحة بتتوزع تلقائيًا بحيث كل شخص
          في دوره ليه يوم راحة مختلف عن زمايله. لو حد ثابت على شيفت معين، فعّل "شيفت ثابت" له.
          N7 مستبعد تلقائيًا من التوليد لحد ما يتأكد توقيته.
        </p>
      </div>

      {configs && (
        <div>
          {configs.map((g, idx) => (
            <div className={`gen-emp ${g.fixed ? 'is-fixed' : ''}`} key={g.employeeId}>
              <div className="top">
                <label>
                  <input type="checkbox" checked={g.include} onChange={(e) => updateConfig(idx, { include: e.target.checked })} />
                  {' '}<b>{g.name}</b> <span className="muted">{g.jobRole || ''}</span>
                </label>
                <div className="row" style={{ gap: 12 }}>
                  <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <label className="muted">المستوى:</label>
                    <select value={g.level} onChange={(e) => updateConfig(idx, { level: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{'★'.repeat(l)}{'☆'.repeat(5 - l)}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <label className="muted">يوم الراحة:</label>
                    <select value={g.restDay} onChange={(e) => updateConfig(idx, { restDay: Number(e.target.value) })}>
                      {AR_DAYS.map((dn, di) => <option key={di} value={di}>{dn}{di === 0 || di === 6 ? ' (يوم ضغط)' : ''}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="code-pick">
                <label style={{ background: g.fixed ? '#fff0cc' : '#fff', fontWeight: 700 }}>
                  <input type="checkbox" checked={g.fixed} onChange={(e) => updateConfig(idx, { fixed: e.target.checked })} />شيفت ثابت
                </label>
                {g.fixed ? (
                  <select value={g.fixedCode} onChange={(e) => updateConfig(idx, { fixedCode: e.target.value })}>
                    {workCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  workCodes.map((c) => {
                    const shiftDef = shiftTypes.find((s) => s.code === c)
                    return (
                      <label key={c} style={{ background: g.codes.includes(c) ? `${shiftDef?.color}33` : '#fff' }}>
                        <input type="checkbox" checked={g.codes.includes(c)} onChange={(e) => toggleCode(idx, c, e.target.checked)} />{c}
                      </label>
                    )
                  })
                )}
                {g.lastShift && <span className="muted">آخر شيفت الشهر ده: <b>{g.lastShift}</b></span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {configs && (
        <div className="toolbar-sticky no-print">
          <span className="muted">بعد التوليد تقدر تعدّل أي خانة بالضغط عليها</span>
          <div className="row">
            <button className="btn secondary" onClick={handleGenerate}>⚙️ توليد الشهر</button>
            {roster && (
              <button className="btn ghost" onClick={() => setShowIssues((v) => !v)}>
                🔎 مراجعة الأخطاء {report ? `(${report.issues.length})` : ''}
              </button>
            )}
            {roster && <button className="btn ghost" disabled={busy} onClick={() => handleSave('draft')}>💾 حفظ كمسودة</button>}
            {roster && <button className="btn" disabled={busy} onClick={handleApprove}>✅ اعتماد الجدول</button>}
          </div>
        </div>
      )}

      {roster && report && showIssues && (
        <div className="panel">
          <div className="panel-title"><span className="bar"></span>تقرير المراجعة</div>
          {report.issues.length === 0 ? (
            <div className="muted" style={{ marginTop: 8 }}>✅ لا توجد مشاكل مكتشفة.</div>
          ) : (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {report.issues.map((issue, i) => (
                <div key={i} className="muted" style={{ color: issue.severity === 'critical' ? 'var(--danger)' : 'var(--warn)' }}>
                  {issue.severity === 'critical' ? '⛔' : '⚠️'} {issue.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {roster && (
        <div className="panel">
          <div className="panel-title"><span className="bar"></span>معاينة الشهر الجديد</div>
          <div className="wrap-scroll" style={{ marginTop: 10 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th className="name-col">الاسم</th>
                  {Array.from({ length: nd }, (_, i) => i + 1).map((d) => (
                    <th key={d} title={AR_DAYS[weekdayOf(targetYear, targetMonth, d)]}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {configs?.filter((g) => g.include).map((g) => (
                  <tr key={g.employeeId}>
                    <td className="name-col">{g.name}</td>
                    {Array.from({ length: nd }, (_, i) => i + 1).map((d) => {
                      const code = roster[g.employeeId]?.[d]
                      const s = code ? shiftTypes.find((st) => st.code === code) : undefined
                      return (
                        <td
                          key={d}
                          className={`shift-cell editable ${!s ? 'empty' : ''}`}
                          style={s ? { background: s.color, color: s.textColor } : undefined}
                          onClick={() => setModalCtx({ employeeId: g.employeeId, day: d })}
                        >
                          {code || '–'}
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
        title={modalCtx ? `${configs?.find((g) => g.employeeId === modalCtx.employeeId)?.name ?? ''} — يوم ${modalCtx.day}` : ''}
        shiftTypes={shiftTypes}
        currentCode={modalCtx && roster ? roster[modalCtx.employeeId]?.[modalCtx.day] : undefined}
        onSelect={(code) => {
          if (!modalCtx) return
          setRoster((prev) => {
            if (!prev) return prev
            const next = { ...prev, [modalCtx.employeeId]: { ...prev[modalCtx.employeeId] } }
            if (code === null) delete next[modalCtx.employeeId][modalCtx.day]
            else next[modalCtx.employeeId][modalCtx.day] = code
            return next
          })
          setModalCtx(null)
        }}
        onClose={() => setModalCtx(null)}
      />
    </section>
  )
}
