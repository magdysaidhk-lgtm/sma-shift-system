import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate } from './mock/store'

export async function listJobRoles(): Promise<string[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('job_roles').select('name').order('name')
    if (error) throw error
    return (data ?? []).map((r) => r.name)
  }
  return getDB().jobRoles
}

export async function addJobRole(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('job_roles').insert({ name: trimmed })
    if (error) throw error
    return
  }
  mutate((db) => {
    if (!db.jobRoles.includes(trimmed)) db.jobRoles.push(trimmed)
  })
}

export async function deleteJobRole(name: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('job_roles').delete().eq('name', name)
    if (error) throw error
    return
  }
  mutate((db) => {
    db.jobRoles = db.jobRoles.filter((r) => r !== name)
  })
}
