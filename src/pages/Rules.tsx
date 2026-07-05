import { useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useAuth } from '../auth/AuthContext'
import { useDialog } from '../context/DialogContext'
import { upsertShiftType, deleteShiftType } from '../services/shiftTypes'
import { updateSettings } from '../services/settingsService'
import { AR_DAYS, pad2 } from '../utils/dates'
import type { ShiftType } from '../types/domain'

function timeVal(h: number | null) {
  return h != null ? `${pad2(h)}:00` : ''
}

export default function Rules() {
  const { user } = useAuth()
  const { shiftTypes, settings, reloadShiftTypes, reloadSettings } = useAppData()
  const { alert } = useDialog()
  const isAdmin = user?.role === 'admin'

  const [newCode, setNewCode] = useState('')
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState('#8e44ad')
  const [restDays, setRestDays] = useState<Set<number>>(new Set(settings.allowedRestDays))
  const [peakFrom, setPeakFrom] = useState(timeVal(settings.peakStartH))
  const [peakTo, setPeakTo] = useState(timeVal(settings.peakEndH))

  async function editField(code: string, patch: Partial<ShiftType>) {
    const s = shiftTypes.find((st) => st.code === code)
    if (!s) return
    await upsertShiftType({ ...s, ...patch })
    await reloadShiftTypes()
  }

  async function handleDelete(code: string) {
    await deleteShiftType(code)
    await reloadShiftTypes()
  }

  async function handleAdd() {
    const code = newCode.trim().toUpperCase()
    if (!code) return alert('لازم تكتب رمز للشيفت')
    if (shiftTypes.some((s) => s.code === code)) return alert('الرمز ده مستخدم بالفعل')
    let startHour: number | null = null
    let endHour: number | null = null
    if (newFrom && newTo) {
      startHour = Number(newFrom.split(':')[0])
      endHour = Number(newTo.split(':')[0])
    }
    await upsertShiftType({
      code,
      description: newDesc.trim() || code,
      color: newColor,
      textColor: '#ffffff',
      startHour,
      endHour,
      isWorkable: true,
      needsConfirmation: false,
    })
    await reloadShiftTypes()
    setNewCode(''); setNewFrom(''); setNewTo(''); setNewDesc('')
    await alert(`تمت إضافة شيفت "${code}" بنجاح.`)
  }

  function toggleRestDay(day: number) {
    setRestDays((prev) => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  async function saveRestDays() {
    if (restDays.size === 0) return alert('لازم تسيب يوم واحد على الأقل مسموح فيه راحة.')
    await updateSettings({ allowedRestDays: [...restDays].sort() })
    await reloadSettings()
    await alert('تم حفظ أيام الراحة المسموحة.')
  }

  async function savePeak() {
    if (!peakFrom || !peakTo) return alert('لازم تحدد من وإلى الساعة')
    await updateSettings({ peakStartH: Number(peakFrom.split(':')[0]), peakEndH: Number(peakTo.split(':')[0]) })
    await reloadSettings()
    await alert('تم حفظ نافذة وقت الضغط.')
  }

  return (
    <section>
      <div className="panel">
        <div className="panel-title"><span className="bar"></span>تعريف الشيفتات</div>
        <div className="muted">دي القائمة اللي بيتم التوليد والتصفية والتغطية بناءً عليها.{!isAdmin && ' (للقراءة فقط — Admin فقط يقدر يعدّل)'}</div>
        <div style={{ marginTop: 12 }}>
          <table className="grid" style={{ minWidth: 600 }}>
            <thead>
              <tr><th>الرمز</th><th>الوصف</th><th>من الساعة</th><th>إلى الساعة</th><th>اللون</th>{isAdmin && <th>حذف</th>}</tr>
            </thead>
            <tbody>
              {shiftTypes.map((s) => (
                <tr key={s.code}>
                  <td style={{ fontWeight: 800 }}>{s.code}{s.needsConfirmation ? ' ⚠️' : ''}</td>
                  <td>
                    <input type="text" defaultValue={s.description} disabled={!isAdmin} style={{ width: 180 }}
                      onBlur={(e) => e.target.value !== s.description && editField(s.code, { description: e.target.value })} />
                  </td>
                  <td>
                    <input type="time" defaultValue={timeVal(s.startHour)} disabled={!isAdmin}
                      onBlur={(e) => editField(s.code, { startHour: e.target.value ? Number(e.target.value.split(':')[0]) : null })} />
                  </td>
                  <td>
                    <input type="time" defaultValue={timeVal(s.endHour)} disabled={!isAdmin}
                      onBlur={(e) => editField(s.code, { endHour: e.target.value ? Number(e.target.value.split(':')[0]) : null })} />
                  </td>
                  <td>
                    <input type="color" defaultValue={/^#/.test(s.color) ? s.color : '#888888'} disabled={!isAdmin}
                      onBlur={(e) => editField(s.code, { color: e.target.value })} />
                  </td>
                  {isAdmin && <td><button className="btn danger" onClick={() => handleDelete(s.code)}>حذف</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && (
          <div className="row" style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="field"><label>رمز جديد</label><input type="text" style={{ width: 80 }} value={newCode} onChange={(e) => setNewCode(e.target.value)} /></div>
            <div className="field"><label>من الساعة</label><input type="time" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} /></div>
            <div className="field"><label>إلى الساعة</label><input type="time" value={newTo} onChange={(e) => setNewTo(e.target.value)} /></div>
            <div className="field"><label>الوصف</label><input type="text" style={{ width: 170 }} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></div>
            <div className="field"><label>اللون</label><input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} /></div>
            <button className="btn secondary" onClick={handleAdd}>إضافة شيفت</button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title"><span className="bar"></span>أيام الراحة المسموح توزيعها تلقائيًا</div>
        <div className="muted">التوليد التلقائي لأيام الراحة هيختار بس من الأيام المفعّلة هنا.</div>
        <div className="row" style={{ marginTop: 12 }}>
          {AR_DAYS.map((dn, di) => (
            <label key={di} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--line)', padding: '7px 12px', borderRadius: 8, background: '#fff' }}>
              <input type="checkbox" disabled={!isAdmin} checked={restDays.has(di)} onChange={() => toggleRestDay(di)} />{dn}
            </label>
          ))}
        </div>
        {isAdmin && <button className="btn ghost" style={{ marginTop: 10 }} onClick={saveRestDays}>حفظ</button>}
      </div>

      <div className="panel">
        <div className="panel-title"><span className="bar"></span>نافذة وقت الضغط (التغطية اليومية)</div>
        <div className="muted">الساعات دي هي اللي بتتظلل في تبويب "التغطية اليومية" وبيتم التنبيه لو التغطية فيها ضعيفة.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="field"><label>من الساعة</label><input type="time" disabled={!isAdmin} value={peakFrom} onChange={(e) => setPeakFrom(e.target.value)} /></div>
          <div className="field"><label>إلى الساعة</label><input type="time" disabled={!isAdmin} value={peakTo} onChange={(e) => setPeakTo(e.target.value)} /></div>
          {isAdmin && <button className="btn ghost" onClick={savePeak}>حفظ</button>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><span className="bar"></span>قواعد التوليد</div>
        <ul style={{ margin: '8px 0 0', paddingInlineStart: 20, fontSize: 13, color: 'var(--muted)', lineHeight: 2 }}>
          <li>كل شخص بيشتغل نفس نوع الشيفت أسبوع كامل، ويتغيّر بس في اليوم اللي بعد يوم راحته مباشرة.</li>
          <li>الأشخاص في نفس الدور بياخدوا أيام راحة مختلفة عن بعض من ضمن الأيام المفعّلة فوق.</li>
          <li>الترتيب بياخد بعين الاعتبار مستوى كل شخص عشان يوزّع الخبرات على الشيفتات المختلفة.</li>
          <li>لو حد ثابت على شيفت معيّن، بيتفعّله من تبويب "توليد شهر جديد".</li>
          <li>أول شيفت في الشهر الجديد بيكمل من بعد آخر شيفت اشتغله الشخص في الشهر اللي قبله.</li>
          <li>ممنوع أكثر من 6 أيام عمل متتالية بدون راحة، وممنوع شيفت صباحي (F) مباشرة بعد شيفت ليلي (N/N3) — يظهر تحذير في تقرير المراجعة.</li>
          <li>N7 لا يُستخدم تلقائيًا في التوليد حتى يتأكد توقيته — متاح فقط للتعيين اليدوي في الجدول.</li>
        </ul>
      </div>
    </section>
  )
}
