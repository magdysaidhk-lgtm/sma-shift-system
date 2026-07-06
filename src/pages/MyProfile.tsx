import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { useDialog } from '../context/DialogContext'
import { updateEmployee } from '../services/employees'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient'
import { toAuthEmail, fromAuthEmail, isPlainUsername } from '../auth/usernameAuth'

export default function MyProfile() {
  const { user } = useAuth()
  const { employees, reloadEmployees } = useAppData()
  const { alert } = useDialog()
  const emp = employees.find((e) => e.id === user?.employeeId)

  const [name, setName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (emp) {
      setName(emp.name)
      setNationalId(emp.nationalId ?? '')
    }
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data }) => setEmail(fromAuthEmail(data.user?.email ?? '')))
    }
  }, [emp])

  if (!emp || !user) {
    return (
      <section>
        <div className="panel">
          <div className="panel-title"><span className="bar"></span>ملفي الشخصي</div>
          <div className="muted">حسابك مش مرتبط بموظف في النظام — كلّم الـ Admin.</div>
        </div>
      </section>
    )
  }

  async function handleSave() {
    if (!emp || !user) return
    setBusy(true)
    try {
      await updateEmployee(emp.id, { name: name.trim(), nationalId: nationalId.trim() || null }, user)
      await reloadEmployees()
      if (isSupabaseConfigured && email.trim()) {
        const { data } = await supabase.auth.getUser()
        const newAuthEmail = toAuthEmail(email)
        if (data.user?.email !== newAuthEmail) {
          const { error } = await supabase.auth.updateUser({ email: newAuthEmail })
          if (error) {
            await alert(`تم حفظ الاسم والرقم الشخصي، لكن تغيير البريد/اسم المستخدم فشل: ${error.message}`)
            return
          }
          await alert(
            isPlainUsername(email.trim())
              ? 'تم الحفظ. لأنك بدون إيميل حقيقي، التغيير محتاج تأكيد يدوي من الـ Admin — كلّمه.'
              : 'تم الحفظ. هيوصلك رابط تأكيد على الإيميل الجديد — لازم تأكده الأول قبل ما يتفعّل.',
          )
          return
        }
      }
      await alert('تم حفظ التعديلات بنجاح.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="panel">
        <div className="panel-title"><span className="bar"></span>ملفي الشخصي</div>
        <div className="muted">تقدر تعدّل اسمك ورقمك الشخصي وإيميل الدخول بس. باقي البيانات (رقم الشغل، الدور، المستوى...) بيتحكم فيها الـ Admin.</div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>الاسم</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>الرقم الشخصي</label>
            <input type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          </div>
          <div className="field">
            <label>إيميل تسجيل الدخول</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>رقم الشغل (ثابت — Admin فقط)</label>
            <input type="text" value={emp.workNumber ?? ''} disabled />
          </div>
          <div className="field">
            <label>الدور (Admin فقط)</label>
            <input type="text" value={emp.jobRole ?? ''} disabled />
          </div>
        </div>
        <button className="btn secondary" style={{ marginTop: 14 }} disabled={busy} onClick={handleSave}>
          {busy ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </section>
  )
}
