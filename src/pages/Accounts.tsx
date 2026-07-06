import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { useDialog } from '../context/DialogContext'
import { listAccounts, inviteAccount, updateAccountRole, removeAccount } from '../services/accounts'
import { isPlainUsername, toAuthEmail } from '../auth/usernameAuth'
import type { Role, UserProfile } from '../types/domain'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'مدير عام',
  shift_manager: 'مدير شيفت',
  supervisor: 'مشرف',
  view_only: 'عرض فقط',
}

export default function Accounts() {
  const { user, isDevMode } = useAuth()
  const { employees } = useAppData()
  const { alert, confirm } = useDialog()
  const [accounts, setAccounts] = useState<UserProfile[]>([])
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<Role>('view_only')
  const [employeeId, setEmployeeId] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const isAdmin = user?.role === 'admin'

  async function reload() {
    setAccounts(await listAccounts())
  }

  useEffect(() => {
    if (isAdmin) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <section>
        <div className="panel">
          <div className="panel-title"><span className="bar"></span>الحسابات</div>
          <div className="muted">الصفحة دي متاحة لـ Admin فقط.</div>
        </div>
      </section>
    )
  }

  const isUsernameOnly = isPlainUsername(email.trim())
  const willUsePassword = usePassword || isUsernameOnly

  async function handleInvite() {
    if (!email.trim() || !displayName.trim()) {
      await alert('لازم تكتب البريد الإلكتروني أو اسم المستخدم، والاسم.')
      return
    }
    if (willUsePassword && !password.trim()) {
      await alert('لازم تحدد كلمة مرور.')
      return
    }
    setBusy(true)
    try {
      await inviteAccount({
        email: toAuthEmail(email),
        displayName: displayName.trim(),
        role,
        employeeId: employeeId || null,
        password: willUsePassword ? password : undefined,
      })
      await reload()
      setEmail(''); setDisplayName(''); setRole('view_only'); setEmployeeId(''); setPassword(''); setUsePassword(false)
      await alert(
        willUsePassword
          ? `تم إنشاء الحساب. ابعت للشخص: ${isUsernameOnly ? `اسم المستخدم "${email.trim()}"` : `الإيميل "${email.trim()}"`} + كلمة المرور اللي حددتها.`
          : 'تم إرسال دعوة بالبريد الإلكتروني بنجاح.',
      )
    } catch (e) {
      await alert(`تعذّر إضافة الحساب: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleRoleChange(id: string, newRole: Role) {
    await updateAccountRole(id, newRole)
    await reload()
  }

  async function handleRemove(acc: UserProfile) {
    const ok = await confirm(`تأكيد إزالة صلاحية "${acc.displayName}"؟ الحساب نفسه هيفضل موجود في Supabase Auth، بس هيفقد الوصول للنظام.`)
    if (!ok) return
    await removeAccount(acc.id)
    await reload()
  }

  return (
    <section>
      <div className="panel">
        <div className="panel-title"><span className="bar"></span>إضافة حساب جديد</div>
        {isDevMode && (
          <div className="note" style={{ marginBottom: 12 }}>
            وضع تجريبي بدون Supabase — الحسابات هنا شكلية للاختبار فقط، مش حسابات دخول حقيقية.
          </div>
        )}
        <div className="row">
          <div className="field">
            <label>البريد الإلكتروني (أو اسم مستخدم لو مفيش إيميل حقيقي)</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} style={{ minWidth: 220 }} />
          </div>
          <div className="field"><label>الاسم</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div className="field">
            <label>الدور</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>ربط بموظف (اختياري)</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">بدون</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
        </div>
        {isUsernameOnly ? (
          <div className="note" style={{ marginTop: 10 }}>
            كتبت اسم مستخدم (من غير @) — هيتعمل حساب بكلمة مرور مباشرة بدون إيميل حقيقي. ابعت اسم المستخدم وكلمة المرور للشخص يدويًا.
          </div>
        ) : (
          <label className="row" style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', gap: 6 }}>
            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
            إنشاء بكلمة مرور مباشرة بدل إرسال دعوة بالبريد (لو الإيميل مش شغال)
          </label>
        )}
        {willUsePassword && (
          <div className="field" style={{ marginTop: 8 }}>
            <label>كلمة المرور</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: 200 }} />
          </div>
        )}
        <button className="btn secondary" style={{ marginTop: 12 }} disabled={busy} onClick={handleInvite}>
          {busy ? 'جارٍ الإضافة...' : '+ إضافة الحساب'}
        </button>
      </div>

      <div className="panel">
        <div className="panel-title"><span className="bar"></span>الحسابات الحالية ({accounts.length})</div>
        <div className="wrap-scroll" style={{ marginTop: 10 }}>
          <table className="grid">
            <thead>
              <tr><th>الاسم</th><th>الدور</th><th>الموظف المرتبط</th><th>إزالة</th></tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td>{acc.displayName}</td>
                  <td>
                    <select value={acc.role} onChange={(e) => handleRoleChange(acc.id, e.target.value as Role)} disabled={acc.id === user?.id}>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td>{employees.find((e) => e.id === acc.employeeId)?.name ?? '—'}</td>
                  <td>
                    <button className="btn danger" disabled={acc.id === user?.id} onClick={() => handleRemove(acc)}>إزالة</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
