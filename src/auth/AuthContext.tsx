import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient'
import { getDevRole, setDevRole, getDevUserProfile } from './devSession'
import type { Role, UserProfile } from '../types/domain'

interface AuthState {
  loading: boolean
  user: UserProfile | null
  isDevMode: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  setDevRole: (role: Role) => void
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, role, display_name, employee_id')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    role: data.role,
    displayName: data.display_name,
    employeeId: data.employee_id,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(getDevUserProfile())
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id
      setUser(uid ? await fetchProfile(uid) : null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user.id
      setUser(uid ? await fetchProfile(uid) : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) return null
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signOut() {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    setUser(null)
  }

  function changeDevRole(role: Role) {
    setDevRole(role)
    setUser(getDevUserProfile())
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        user,
        isDevMode: !isSupabaseConfigured,
        signIn,
        signOut,
        setDevRole: changeDevRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { getDevRole }
