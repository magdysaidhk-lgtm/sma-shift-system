import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate } from './mock/store'
import type { Role, UserProfile } from '../types/domain'

export async function listAccounts(): Promise<UserProfile[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('users')
      .select('id, role, display_name, employee_id')
      .order('display_name')
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      role: row.role,
      displayName: row.display_name,
      employeeId: row.employee_id,
    }))
  }
  return getDB().accounts
}

export interface InviteAccountInput {
  email: string
  displayName: string
  role: Role
  employeeId: string | null
  /** Fallback when email delivery isn't configured: creates the account with this temp password instead of sending an invite email. */
  password?: string
}

export async function inviteAccount(input: InviteAccountInput): Promise<void> {
  if (isSupabaseConfigured) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: input,
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return
  }
  mutate((db) => {
    db.accounts.push({
      id: crypto.randomUUID(),
      role: input.role,
      displayName: input.displayName,
      employeeId: input.employeeId,
    })
  })
}

export async function updateAccountRole(id: string, role: Role): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('users').update({ role }).eq('id', id)
    if (error) throw error
    return
  }
  mutate((db) => {
    const acc = db.accounts.find((a) => a.id === id)
    if (acc) acc.role = role
  })
}

export async function removeAccount(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error
    return
  }
  mutate((db) => {
    db.accounts = db.accounts.filter((a) => a.id !== id)
  })
}
