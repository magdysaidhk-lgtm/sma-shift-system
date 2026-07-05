export type Role = 'admin' | 'shift_manager' | 'supervisor' | 'view_only'

export type MonthStatus = 'draft' | 'published' | 'locked'

export interface ShiftType {
  code: string
  description: string
  color: string
  textColor: string
  startHour: number | null
  endHour: number | null
  isWorkable: boolean
  needsConfirmation: boolean
}

export interface Employee {
  id: string
  name: string
  jobRole: string | null
  groupName: string | null
  status: 'active' | 'paused' | 'on_leave'
  nationalId: string | null
  workNumber: string | null
  personalPhone: string | null
  email: string | null
  joinDate: string | null
  level: number
  allowedShiftCodes: string[] | null // null/empty = all shift types allowed
  acceptsNightShift: boolean
  unavailableDays: number[]
  fixedRestDay: number | null
  adminNotes: string | null
  deletedAt: string | null
}

export interface Month {
  id: string
  year: number
  month: number
  status: MonthStatus
  createdBy: string | null
  deletedAt: string | null
}

/** shifts: day-of-month (1-31) -> shift code */
export interface MonthRoster {
  monthId: string
  employeeId: string
  shifts: Record<number, string>
}

export interface Settings {
  allowedRestDays: number[]
  peakStartH: number
  peakEndH: number
}

export interface ChangeRequest {
  id: string
  requestedBy: string
  monthId: string
  employeeId: string
  day: number
  requestedCode: string
  requestType: 'shift_change' | 'leave_request'
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy: string | null
  reviewedAt: string | null
  note: string | null
  createdAt: string
}

export interface AuditLogEntry {
  id: string
  userId: string | null
  userName: string | null
  actionType: string
  tableName: string
  recordId: string | null
  employeeId: string | null
  monthId: string | null
  day: number | null
  before: unknown
  after: unknown
  createdAt: string
}

export interface UserProfile {
  id: string
  role: Role
  displayName: string
  employeeId: string | null
}
