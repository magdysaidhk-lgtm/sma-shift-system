import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate } from './mock/store'

export interface BackupPayload {
  exportedAt: string
  version: 1
  tables: {
    employees: unknown[]
    shiftTypes: unknown[]
    months: unknown[]
    shiftAssignments: unknown[]
    settings: unknown[]
    changeRequests: unknown[]
    // audit_log is intentionally excluded — it's an append-only history,
    // not application state, and re-importing it would corrupt that history.
  }
}

export async function exportBackup(): Promise<BackupPayload> {
  if (isSupabaseConfigured) {
    const [employees, shiftTypes, months, shiftAssignments, settings, changeRequests] = await Promise.all([
      supabase.from('employees').select('*'),
      supabase.from('shift_types').select('*'),
      supabase.from('months').select('*'),
      supabase.from('shift_assignments').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('change_requests').select('*'),
    ])
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      tables: {
        employees: employees.data ?? [],
        shiftTypes: shiftTypes.data ?? [],
        months: months.data ?? [],
        shiftAssignments: shiftAssignments.data ?? [],
        settings: settings.data ?? [],
        changeRequests: changeRequests.data ?? [],
      },
    }
  }
  const db = getDB()
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    tables: {
      employees: db.employees,
      shiftTypes: db.shiftTypes,
      months: db.months,
      shiftAssignments: db.assignments,
      settings: [db.settings],
      changeRequests: db.changeRequests,
    },
  }
}

export function downloadBackup(payload: BackupPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sma-shift-backup-${payload.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Admin-only, destructive: replaces current application data with the backup's contents. */
export async function importBackup(payload: BackupPayload): Promise<void> {
  if (payload.version !== 1) throw new Error('نسخة ملف النسخة الاحتياطية غير مدعومة')

  if (isSupabaseConfigured) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = payload.tables as any
    if (t.shiftTypes.length) await supabase.from('shift_types').upsert(t.shiftTypes)
    if (t.settings.length) await supabase.from('settings').upsert(t.settings)
    if (t.employees.length) await supabase.from('employees').upsert(t.employees)
    if (t.months.length) await supabase.from('months').upsert(t.months)
    if (t.shiftAssignments.length) await supabase.from('shift_assignments').upsert(t.shiftAssignments)
    if (t.changeRequests.length) await supabase.from('change_requests').upsert(t.changeRequests)
    return
  }

  mutate((db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = payload.tables as any
    db.employees = t.employees
    db.shiftTypes = t.shiftTypes
    db.months = t.months
    db.assignments = t.shiftAssignments
    db.settings = t.settings[0] ?? db.settings
    db.changeRequests = t.changeRequests
    // audit_log is preserved as-is, not overwritten by import.
  })
}
