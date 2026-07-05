import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate, pushAudit } from './mock/store'
import type { Employee, UserProfile } from '../types/domain'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    name: row.name,
    jobRole: row.job_role,
    groupName: row.group_name,
    status: row.status,
    nationalId: row.national_id,
    workNumber: row.work_number,
    personalPhone: row.personal_phone,
    email: row.email,
    joinDate: row.join_date,
    level: row.level,
    allowedShiftCodes: row.allowed_shift_codes,
    acceptsNightShift: row.accepts_night_shift,
    unavailableDays: row.unavailable_days ?? [],
    fixedRestDay: row.fixed_rest_day,
    adminNotes: row.admin_notes,
    deletedAt: row.deleted_at,
  }
}

export async function listEmployees(includeDeleted = false): Promise<Employee[]> {
  if (isSupabaseConfigured) {
    let query = supabase.from('employees').select('*').order('name')
    if (!includeDeleted) query = query.is('deleted_at', null)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(rowToEmployee)
  }
  const db = getDB()
  return db.employees.filter((e) => includeDeleted || !e.deletedAt)
}

export async function createEmployee(
  partial: Partial<Employee> & { name: string },
  actor: UserProfile,
): Promise<Employee> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('employees')
      .insert({ name: partial.name, job_role: partial.jobRole ?? null, level: partial.level ?? 3 })
      .select()
      .single()
    if (error) throw error
    return rowToEmployee(data)
  }
  return mutate((db) => {
    const emp: Employee = {
      id: crypto.randomUUID(),
      name: partial.name,
      jobRole: partial.jobRole ?? null,
      groupName: null,
      status: 'active',
      nationalId: null,
      workNumber: null,
      personalPhone: null,
      email: null,
      joinDate: null,
      level: partial.level ?? 3,
      allowedShiftCodes: null,
      acceptsNightShift: true,
      unavailableDays: [],
      fixedRestDay: null,
      adminNotes: null,
      deletedAt: null,
    }
    db.employees.push(emp)
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: 'insert',
      tableName: 'employees',
      recordId: emp.id,
      employeeId: emp.id,
      monthId: null,
      day: null,
      before: null,
      after: emp,
    })
    return emp
  })
}

export async function updateEmployee(id: string, patch: Partial<Employee>, actor: UserProfile): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('employees')
      .update({
        name: patch.name,
        job_role: patch.jobRole,
        group_name: patch.groupName,
        personal_phone: patch.personalPhone,
        work_number: patch.workNumber,
        national_id: patch.nationalId,
        level: patch.level,
        status: patch.status,
        fixed_rest_day: patch.fixedRestDay,
        admin_notes: patch.adminNotes,
      })
      .eq('id', id)
    if (error) throw error
    return
  }
  mutate((db) => {
    const emp = db.employees.find((e) => e.id === id)
    if (!emp) return
    const before = { ...emp }
    Object.assign(emp, patch)
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: 'update',
      tableName: 'employees',
      recordId: id,
      employeeId: id,
      monthId: null,
      day: null,
      before,
      after: emp,
    })
  })
}

export async function softDeleteEmployee(id: string, actor: UserProfile): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return
  }
  mutate((db) => {
    const emp = db.employees.find((e) => e.id === id)
    if (!emp) return
    const before = { ...emp }
    emp.deletedAt = new Date().toISOString()
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: 'delete',
      tableName: 'employees',
      recordId: id,
      employeeId: id,
      monthId: null,
      day: null,
      before,
      after: null,
    })
  })
}
