import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate } from './mock/store'
import type { ChangeRequest, UserProfile } from '../types/domain'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRequest(row: any): ChangeRequest {
  return {
    id: row.id,
    requestedBy: row.requested_by,
    monthId: row.month_id,
    employeeId: row.employee_id,
    day: row.day,
    requestedCode: row.requested_code,
    requestType: row.request_type,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    note: row.note,
    createdAt: row.created_at,
  }
}

export async function listChangeRequests(): Promise<ChangeRequest[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('change_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(rowToRequest)
  }
  return getDB().changeRequests
}

export async function createChangeRequest(
  input: Pick<ChangeRequest, 'monthId' | 'employeeId' | 'day' | 'requestedCode' | 'requestType' | 'note'>,
  actor: UserProfile,
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('change_requests').insert({
      requested_by: actor.id,
      month_id: input.monthId,
      employee_id: input.employeeId,
      day: input.day,
      requested_code: input.requestedCode,
      request_type: input.requestType,
      note: input.note,
    })
    if (error) throw error
    return
  }
  mutate((db) => {
    db.changeRequests.unshift({
      id: crypto.randomUUID(),
      requestedBy: actor.id,
      monthId: input.monthId,
      employeeId: input.employeeId,
      day: input.day,
      requestedCode: input.requestedCode,
      requestType: input.requestType,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      note: input.note,
      createdAt: new Date().toISOString(),
    })
  })
}

export async function reviewChangeRequest(
  id: string,
  status: 'approved' | 'rejected',
  actor: UserProfile,
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('change_requests')
      .update({ status, reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return
  }
  mutate((db) => {
    const req = db.changeRequests.find((r) => r.id === id)
    if (!req) return
    req.status = status
    req.reviewedBy = actor.id
    req.reviewedAt = new Date().toISOString()
  })
}
