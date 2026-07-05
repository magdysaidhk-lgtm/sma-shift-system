import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate, pushAudit } from './mock/store'
import type { UserProfile } from '../types/domain'

/** employeeId -> day -> shift code */
export type RosterMap = Record<string, Record<number, string>>

export async function listAssignmentsForMonth(monthId: string): Promise<RosterMap> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('shift_assignments')
      .select('employee_id, day, shift_code')
      .eq('month_id', monthId)
    if (error) throw error
    const map: RosterMap = {}
    for (const row of data ?? []) {
      if (!map[row.employee_id]) map[row.employee_id] = {}
      if (row.shift_code) map[row.employee_id][row.day] = row.shift_code
    }
    return map
  }
  const db = getDB()
  const map: RosterMap = {}
  db.assignments
    .filter((a) => a.monthId === monthId)
    .forEach((a) => {
      if (!map[a.employeeId]) map[a.employeeId] = {}
      if (a.shiftCode) map[a.employeeId][a.day] = a.shiftCode
    })
  return map
}

export async function setAssignment(
  monthId: string,
  employeeId: string,
  day: number,
  code: string | null,
  actor: UserProfile,
): Promise<void> {
  if (isSupabaseConfigured) {
    if (code === null) {
      const { error } = await supabase
        .from('shift_assignments')
        .delete()
        .eq('month_id', monthId)
        .eq('employee_id', employeeId)
        .eq('day', day)
      if (error) throw error
      return
    }
    const { error } = await supabase
      .from('shift_assignments')
      .upsert(
        { month_id: monthId, employee_id: employeeId, day, shift_code: code },
        { onConflict: 'month_id,employee_id,day' },
      )
    if (error) throw error
    return
  }
  mutate((db) => {
    const existing = db.assignments.find(
      (a) => a.monthId === monthId && a.employeeId === employeeId && a.day === day,
    )
    const before = existing ? { ...existing } : null
    if (code === null) {
      db.assignments = db.assignments.filter((a) => a !== existing)
    } else if (existing) {
      existing.shiftCode = code
    } else {
      db.assignments.push({ id: crypto.randomUUID(), monthId, employeeId, day, shiftCode: code })
    }
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: existing ? (code === null ? 'delete' : 'update') : 'insert',
      tableName: 'shift_assignments',
      recordId: existing?.id ?? null,
      employeeId,
      monthId,
      day,
      before,
      after: code === null ? null : { monthId, employeeId, day, shiftCode: code },
    })
  })
}

/** Bulk-write a freshly generated month's roster in one go (used by "حفظ الشهر"). */
export async function saveGeneratedRoster(
  monthId: string,
  roster: RosterMap,
  actor: UserProfile,
): Promise<void> {
  if (isSupabaseConfigured) {
    const rows = Object.entries(roster).flatMap(([employeeId, days]) =>
      Object.entries(days).map(([day, code]) => ({
        month_id: monthId,
        employee_id: employeeId,
        day: Number(day),
        shift_code: code,
      })),
    )
    if (rows.length === 0) return
    const { error } = await supabase
      .from('shift_assignments')
      .upsert(rows, { onConflict: 'month_id,employee_id,day' })
    if (error) throw error
    return
  }
  mutate((db) => {
    Object.entries(roster).forEach(([employeeId, days]) => {
      Object.entries(days).forEach(([dayStr, code]) => {
        const day = Number(dayStr)
        const existing = db.assignments.find(
          (a) => a.monthId === monthId && a.employeeId === employeeId && a.day === day,
        )
        if (existing) existing.shiftCode = code
        else db.assignments.push({ id: crypto.randomUUID(), monthId, employeeId, day, shiftCode: code })
      })
    })
    pushAudit(db, {
      userId: actor.id,
      userName: actor.displayName,
      actionType: 'generate_month',
      tableName: 'shift_assignments',
      recordId: null,
      employeeId: null,
      monthId,
      day: null,
      before: null,
      after: { employeeCount: Object.keys(roster).length },
    })
  })
}
