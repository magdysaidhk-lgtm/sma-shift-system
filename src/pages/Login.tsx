import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { toAuthEmail } from '../auth/usernameAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const msg = await signIn(toAuthEmail(email), password)
    setBusy(false)
    if (msg) setError(msg)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ width: 360 }}>
        <div className="panel-title">
          <span className="bar"></span>تسجيل الدخول — نظام شيفتات سوبر مسلم أكاديمي
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div className="field">
            <label>البريد الإلكتروني أو اسم المستخدم</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>كلمة المرور</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="muted" style={{ color: 'var(--danger)' }}>{error}</div>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
