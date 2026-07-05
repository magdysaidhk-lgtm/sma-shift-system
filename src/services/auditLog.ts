import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB } from './mock/store'
import type { AuditLogEntry } from '../types/domain'

export interface AuditLogFilters {
  userId?: string
  employeeId?: string
  monthId?: string
  actionType?: string
  fromDate?: string // ISO date
  toDate?: string // ISO date
}

export async function listAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  if (isSupabaseConfigured) {
    let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false })
    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters.monthId) query = query.eq('month_id', filters.monthId)
    if (filters.actionType) query = query.eq('action_type', filters.actionType)
    if (filters.fromDate) query = query.gte('created_at', filters.fromDate)
    if (filters.toDate) query = query.lte('created_at', filters.toDate)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: null,
      actionType: row.action_type,
      tableName: row.table_name,
      recordId: row.record_id,
      employeeId: row.employee_id,
      monthId: row.month_id,
      day: row.day,
      before: row.before,
      after: row.after,
      createdAt: row.created_at,
    }))
  }
  let entries = getDB().auditLog
  if (filters.userId) entries = entries.filter((e) => e.userId === filters.userId)
  if (filters.employeeId) entries = entries.filter((e) => e.employeeId === filters.employeeId)
  if (filters.monthId) entries = entries.filter((e) => e.monthId === filters.monthId)
  if (filters.actionType) entries = entries.filter((e) => e.actionType === filters.actionType)
  if (filters.fromDate) entries = entries.filter((e) => e.createdAt >= filters.fromDate!)
  if (filters.toDate) entries = entries.filter((e) => e.createdAt <= filters.toDate!)
  return entries
}
