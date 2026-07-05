import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate, pushAudit } from './mock/store'
import type { Month, MonthStatus, UserProfile } from '../types/domain'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMonth(row: any): Month {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    status: row.status,
    createdBy: row.created_by,
    deletedAt: row.deleted_at,
  }
}

export async function listMonths(): Promise<Month[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('months')
      .select('*')
      .is('deleted_at', null)
      .order('year')
      .order('month')
    if (error) throw error
    return (data ?? []).map(rowToMonth)
  }
  return getDB()
    .months.filter((m) => !m.deletedAt)
    .sort((a, b) => a.year - b.year || a.month - b.month)
}

export async function getMonth(year: number, month: number): Promise<Month | null> {
  const months = await listMonths()
  return months.find((m) => m.year === year && m.month === month) ?? null
}

export async function createMonth(year: number, month: number, actor: UserProfile): Promise<Month> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('months')
      .insert({ year, month, status: 'draft', created_by: actor.id })
      .select()
      .single()
    if (error) throw error
    return rowToMonth(data)
  }
  return mutate((db) => {
    const m: Month = {
      id: crypto.randomUUID(),
      year,
      month,
      status: 'draft',
      createdBy: actor.id,
      deletedAt: null,
    }
    db.months.push(m)
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: 'insert',
      tableName: 'months',
      recordId: m.id,
      employeeId: null,
      monthId: m.id,
      day: null,
      before: null,
      after: m,
    })
    return m
  })
}

export async function setMonthStatus(monthId: string, status: MonthStatus, actor: UserProfile): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('months').update({ status }).eq('id', monthId)
    if (error) throw error
    return
  }
  mutate((db) => {
    const m = db.months.find((mm) => mm.id === monthId)
    if (!m) return
    const before = { ...m }
    m.status = status
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: 'update',
      tableName: 'months',
      recordId: monthId,
      employeeId: null,
      monthId,
      day: null,
      before,
      after: m,
    })
  })
}

export async function deleteMonth(monthId: string, actor: UserProfile): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('months')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', monthId)
    if (error) throw error
    return
  }
  mutate((db) => {
    const m = db.months.find((mm) => mm.id === monthId)
    if (!m) return
    const before = { ...m }
    m.deletedAt = new Date().toISOString()
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: 'delete',
      tableName: 'months',
      recordId: monthId,
      employeeId: null,
      monthId,
      day: null,
      before,
      after: m,
    })
  })
}
