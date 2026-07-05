import type { Employee, ShiftType, Month, Settings, ChangeRequest, AuditLogEntry, UserProfile } from '../../types/domain'
import { SEED_SHIFT_TYPES, SEED_SETTINGS, SEED_FEB_2026, SEED_JOB_ROLES, seedEmployees } from './seed'

export interface ShiftAssignmentRow {
  id: string
  monthId: string
  employeeId: string
  day: number
  shiftCode: string | null
}

export interface MockDB {
  employees: Employee[]
  shiftTypes: ShiftType[]
  jobRoles: string[]
  months: Month[]
  assignments: ShiftAssignmentRow[]
  settings: Settings
  changeRequests: ChangeRequest[]
  auditLog: AuditLogEntry[]
  accounts: UserProfile[]
}

const STORAGE_KEY = 'sma_v2_mock_db'

function buildInitialState(): MockDB {
  const employees = seedEmployees()
  const monthId = crypto.randomUUID()
  const months: Month[] = [
    { id: monthId, year: 2026, month: 2, status: 'published', createdBy: null, deletedAt: null },
  ]
  const assignments: ShiftAssignmentRow[] = []
  employees.forEach((emp, idx) => {
    const seed = SEED_FEB_2026[idx]
    Object.entries(seed.shifts).forEach(([day, code]) => {
      assignments.push({ id: crypto.randomUUID(), monthId, employeeId: emp.id, day: Number(day), shiftCode: code })
    })
  })
  return {
    employees,
    shiftTypes: SEED_SHIFT_TYPES.map((s) => ({ ...s })),
    jobRoles: [...SEED_JOB_ROLES],
    months,
    assignments,
    settings: { ...SEED_SETTINGS },
    changeRequests: [],
    auditLog: [],
    accounts: [],
  }
}

function load(): MockDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockDB
      if (!parsed.jobRoles) parsed.jobRoles = [...SEED_JOB_ROLES]
      if (!parsed.accounts) parsed.accounts = []
      return parsed
    }
  } catch {
    /* ignore corrupt storage, fall through to fresh seed */
  }
  const initial = buildInitialState()
  save(initial)
  return initial
}

function save(current: MockDB) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
}

let db: MockDB = load()

export function getDB(): MockDB {
  return db
}

/** Run a synchronous mutation against the mock DB and persist the result. */
export function mutate<T>(fn: (current: MockDB) => T): T {
  const result = fn(db)
  save(db)
  return result
}

export function resetMockDB() {
  db = buildInitialState()
  save(db)
}

export function pushAudit(
  current: MockDB,
  entry: Omit<AuditLogEntry, 'id' | 'createdAt'>,
) {
  current.auditLog.unshift({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  })
}
